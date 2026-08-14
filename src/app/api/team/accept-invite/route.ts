import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createAdminSupabase, createServiceSupabase } from '@/lib/supabase/server'
import { redeemInvitation } from '@/lib/invitations'

/**
 * POST /api/team/accept-invite — redeem an invitation token.
 *
 * The caller is anonymous by definition: they have no account yet, that is the
 * point. Holding an unexpired token is the authorisation, so the token is
 * re-validated here against the database rather than trusted from the page that
 * rendered the form.
 *
 * The account is created with the Auth admin API and `email_confirm: true`
 * rather than a public `signUp`. An invitation delivered to that mailbox already
 * proves control of the address, so a second confirmation round-trip would only
 * strand the new cashier on a "check your email" screen.
 */
export const runtime = 'nodejs'

const bodySchema = z.object({
  token: z.string().uuid(),
  fullName: z.string().trim().min(1).max(120),
  // Supabase's own default minimum is 6; 8 is the shortest worth asking for.
  password: z.string().min(8).max(128),
})

type ErrorCode = 'BAD_REQUEST' | 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_USED' | 'EMAIL_TAKEN' | 'SERVER_ERROR'

const MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'အချက်အလက် မပြည့်စုံပါ။ (Please fill in every field.)',
  INVALID_TOKEN: 'ဖိတ်ခေါ်လွှာ မမှန်ကန်ပါ။ (This invitation link is not valid.)',
  EXPIRED: 'ဖိတ်ခေါ်လွှာ သက်တမ်းကုန်ဆုံးပါပြီ။ (This invitation has expired.)',
  ALREADY_USED: 'ဖိတ်ခေါ်လွှာကို အသုံးပြုပြီးဖြစ်ပါသည်။ (This invitation has already been used.)',
  EMAIL_TAKEN:
    'ဤအီးမေးလ်နှင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။ ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။ (An account already exists — please sign in instead.)',
  SERVER_ERROR: 'စနစ်အမှား ဖြစ်ပွားပါသည်။ ခဏအကြာ ပြန်ကြိုးစားပါ။ (Something went wrong — please try again.)',
}

function fail(code: ErrorCode, status: number, detail?: string) {
  return NextResponse.json({ success: false, code, message: MESSAGES[code], detail }, { status })
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('BAD_REQUEST', 400, parsed.error.message)

  const { token, fullName, password } = parsed.data

  let service: ReturnType<typeof createServiceSupabase>
  let admin: ReturnType<typeof createAdminSupabase>
  try {
    service = createServiceSupabase()
    admin = createAdminSupabase()
  } catch (error) {
    return fail('SERVER_ERROR', 500, error instanceof Error ? error.message : undefined)
  }

  // ── 1. Re-validate the token server-side ─────────────────────────────────
  const { data: membership, error: lookupError } = await service
    .from('memberships')
    .select('id,tenant_id,status,user_id,invited_email,invite_expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (lookupError) return fail('SERVER_ERROR', 500, lookupError.message)
  if (!membership || !membership.invited_email) return fail('INVALID_TOKEN', 404)
  if (membership.status !== 'invited' || membership.user_id) return fail('ALREADY_USED', 409)
  if (membership.invite_expires_at && new Date(membership.invite_expires_at) < new Date()) {
    return fail('EXPIRED', 410)
  }

  const email = membership.invited_email

  // ── 2. Create the auth user ──────────────────────────────────────────────
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError) {
    // Someone signed up with this address between the invite and the click. The
    // sign-up trigger will have claimed the invitation already, so sending them
    // to sign in is the correct outcome rather than an error to recover from.
    if (/already (been )?registered|already exists|email_exists/i.test(createError.message)) {
      return fail('EMAIL_TAKEN', 409)
    }
    return fail('SERVER_ERROR', 500, createError.message)
  }

  const userId = created.user?.id
  if (!userId) return fail('SERVER_ERROR', 500, 'Auth user was created without an id.')

  // ── 3. Bind the invitation to the new user ───────────────────────────────
  // Shared with the Google path in /auth/callback; see lib/invitations.ts for
  // why the already-claimed case counts as success.
  const redeemed = await redeemInvitation({ token, userId, userEmail: email })

  if (!redeemed.ok) {
    // Deleting the account is only safe when it really is orphaned.
    // `memberships.user_id` is ON DELETE CASCADE through `public.users`, so
    // removing the auth user takes any membership with it — including one the
    // sign-up trigger may have legitimately created a moment ago. Check first,
    // and leave the account alone if it belongs to a business.
    const { count } = await service
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (!count) {
      await admin.auth.admin.deleteUser(userId)
    }

    return fail('SERVER_ERROR', 500, redeemed.detail)
  }

  // The browser signs in with these credentials to establish the session cookie;
  // a server-minted session cannot be handed back through a JSON response.
  return NextResponse.json({
    success: true,
    message: 'အကောင့် ဖွင့်ပြီးပါပြီ။ (Your account is ready.)',
    email,
  })
}
