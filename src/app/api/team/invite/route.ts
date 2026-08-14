import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server'
import { verifyEmailDeliverable } from '@/lib/email/verify'
import { sendInvitationEmail } from '@/lib/email/send'
import {
  invitationHtml, invitationSubject, invitationText,
} from '@/lib/email/templates/invitation'

/**
 * POST /api/team/invite — invite a member by email.
 *
 * Node runtime, not Edge: the MX lookup uses `node:dns`, which the Edge runtime
 * does not provide.
 */
export const runtime = 'nodejs'

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().min(1),
  roleKey: z.string().min(1).max(64),
  /** Display name for the staff member; stored on the membership row's invite. */
  fullName: z.string().trim().max(120).optional(),
  warehouseScope: z.array(z.string().uuid()).optional(),
})

type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'BAD_REQUEST'
  | 'INVALID_SYNTAX' | 'EMAIL_NOT_FOUND'
  | 'ALREADY_MEMBER' | 'ALREADY_INVITED'
  | 'SEND_FAILED' | 'NOT_CONFIGURED'

/** Burmese-first messages, because that is what the shop owner reads. */
const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။ (Please sign in.)',
  FORBIDDEN: 'ဝန်ထမ်းဖိတ်ခေါ်ခွင့် မရှိပါ။ (You cannot invite members.)',
  BAD_REQUEST: 'တောင်းဆိုချက် မမှန်ကန်ပါ။ (Invalid request.)',
  INVALID_SYNTAX:
    'အီးမေးလ်ပုံစံ မမှန်ကန်ပါ။ (That is not a valid email address.)',
  EMAIL_NOT_FOUND:
    'အီးမေးလ်လိပ်စာ မမှန်ကန်ပါ သို့မဟုတ် မရှိပါ (Email address does not exist or cannot receive mail).',
  ALREADY_MEMBER: 'ဤအီးမေးလ်သည် အဖွဲ့ဝင်ဖြစ်နေပြီးပါပြီ။ (Already a member.)',
  ALREADY_INVITED:
    'ဖိတ်ခေါ်လွှာ ပို့ထားပြီးဖြစ်ပါသည်။ ပြန်ပို့လိုပါက "ပြန်ပို့မည်" ကိုနှိပ်ပါ။ (Invitation already pending.)',
  SEND_FAILED:
    'အီးမေးလ်ပို့၍ မရပါ။ ခဏအကြာ ပြန်လည်ကြိုးစားပါ။ (Could not send the email — please try again.)',
  NOT_CONFIGURED:
    'အီးမေးလ်စနစ် ပြင်ဆင်ထားခြင်း မရှိပါ။ (Email sending is not configured on the server.)',
}

function fail(code: ErrorCode, status: number, detail?: string) {
  return NextResponse.json(
    { success: false, code, message: MESSAGES[code], detail },
    { status },
  )
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('UNAUTHENTICATED', 401)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('BAD_REQUEST', 400, parsed.error.message)

  const { tenantId, roleKey, email, fullName, warehouseScope } = parsed.data

  // ── 1. Syntax, then does the domain have a mail server at all ────────────
  const verified = await verifyEmailDeliverable(email)
  if (!verified.ok) return fail(verified.code, 422, verified.detail)
  const recipient = verified.normalized

  // ── 2. Already here? ────────────────────────────────────────────────────
  // RLS scopes these reads to tenants the caller belongs to, so this cannot be
  // used to probe another business's member list.
  //
  // The FK is named explicitly because `memberships` has TWO foreign keys into
  // `users` — `user_id` (who the membership is for) and `invited_by` (who sent
  // it). A bare `users(...)` embed is ambiguous and PostgREST rejects the whole
  // request with PGRST201 rather than guessing.
  const { data: existing, error: existingError } = await supabase
    .from('memberships')
    .select('id,status,user_id,invited_email,user:users!memberships_user_id_fkey(email)')
    .eq('tenant_id', tenantId)

  if (existingError) return fail('FORBIDDEN', 403, existingError.message)

  for (const row of existing ?? []) {
    const rowEmail =
      (row as { user?: { email?: string | null } | null }).user?.email?.toLowerCase() ??
      row.invited_email?.toLowerCase()
    if (rowEmail !== recipient) continue

    if (row.status === 'active' || row.status === 'suspended') return fail('ALREADY_MEMBER', 409)
    if (row.status === 'invited') return fail('ALREADY_INVITED', 409)
    // 'revoked' falls through: re-inviting someone previously removed is allowed.
  }

  // ── 3. Create the invitation ─────────────────────────────────────────────
  // The RPC re-checks `members.invite` and refuses to hand out the owner role,
  // so permission is enforced by the database rather than by this handler.
  const { data: membership, error: inviteError } = await supabase.rpc('invite_member', {
    p_tenant_id: tenantId,
    p_role_key: roleKey,
    p_email: recipient,
    p_phone: null,
    p_warehouse_scope: warehouseScope ?? [],
  })

  if (inviteError) {
    const status = inviteError.code === '42501' ? 403 : 400
    return fail(inviteError.code === '42501' ? 'FORBIDDEN' : 'BAD_REQUEST', status, inviteError.message)
  }

  // An existing account is added outright — no token, so there is nothing to
  // accept and no email worth sending.
  if (membership.status === 'active') {
    return NextResponse.json({
      success: true,
      message: 'အဖွဲ့ဝင်အဖြစ် ထည့်သွင်းပြီးပါပြီ။ (Added to the team — they already had an account.)',
      membershipId: membership.id,
      emailSent: false,
    })
  }

  // ── 4. Send it ───────────────────────────────────────────────────────────
  const [{ data: tenant }, { data: role }, { data: inviter }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase.from('roles').select('name_en,name_my').eq('tenant_id', tenantId).eq('key', roleKey).single(),
    supabase.from('users').select('full_name,email').eq('id', user.id).single(),
  ])

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const acceptUrl = `${appUrl.replace(/\/$/, '')}/accept-invite?token=${membership.invite_token}`
  const expiresAt = membership.invite_expires_at
    ? new Date(membership.invite_expires_at)
    : new Date(Date.now() + 48 * 60 * 60 * 1000)

  const template = {
    tenantName: tenant?.name ?? 'Your workplace',
    roleEn: role?.name_en ?? roleKey,
    roleMy: role?.name_my ?? null,
    inviterName: inviter?.full_name ?? null,
    acceptUrl,
    expiresAt,
  }

  const sent = await sendInvitationEmail({
    to: recipient,
    subject: invitationSubject(template.tenantName),
    html: invitationHtml(template),
    text: invitationText(template),
    replyTo: inviter?.email ?? undefined,
  })

  if (!sent.ok) {
    // The membership row exists but the invitee will never see a link, so the
    // pending invitation is withdrawn rather than left as a phantom the owner has
    // to notice and clean up.
    //
    // Service role, not the caller's client: deleting a membership needs
    // `members.manage`, while inviting only needs `members.invite`, so a role
    // holding just the latter could create an invitation it cannot retract. The
    // row being removed is the one this request just created and whose creation
    // the RPC already authorised.
    try {
      await createServiceSupabase().from('memberships').delete().eq('id', membership.id)
    } catch {
      // No service key configured. The stranded pending invitation is a lesser
      // problem than masking the send failure, which is what the owner needs.
    }
    return fail(sent.code, sent.code === 'EMAIL_NOT_FOUND' ? 422 : 502, sent.detail)
  }

  return NextResponse.json({
    success: true,
    message: 'ဖိတ်ခေါ်လွှာ အောင်မြင်စွာ ပို့ပြီးပါပြီ။',
    membershipId: membership.id,
    // Echoed so the optimistic row in the team list matches what was stored.
    invitedEmail: recipient,
    invitedName: fullName ?? null,
    emailSent: true,
  })
}
