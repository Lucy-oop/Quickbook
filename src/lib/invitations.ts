import 'server-only'

import { createServiceSupabase } from '@/lib/supabase/server'

/**
 * Binding a redeemed invitation to a user, shared by both ways in:
 * `/api/team/accept-invite` (email + password) and `/auth/callback` (Google).
 *
 * Kept in one place because the interesting part is not the update — it is the
 * reconciliation around it. `tg_handle_new_auth_user` claims invitations by
 * matching email the moment an account is created, so by the time either caller
 * gets here the work may already be done; that has to read as success, not as a
 * failure to recover from.
 */

export type RedeemResult =
  | { ok: true; alreadyClaimed: boolean }
  | { ok: false; code: 'INVALID' | 'EMAIL_MISMATCH'; detail?: string }

export async function redeemInvitation(args: {
  token: string
  userId: string
  /** The address on the account that is redeeming — not the invited address. */
  userEmail: string | null | undefined
}): Promise<RedeemResult> {
  let service: ReturnType<typeof createServiceSupabase>
  try {
    service = createServiceSupabase()
  } catch (error) {
    return { ok: false, code: 'INVALID', detail: error instanceof Error ? error.message : undefined }
  }

  const { data: invitation, error: lookupError } = await service
    .from('memberships')
    .select('id,tenant_id,status,user_id,invited_email,invite_expires_at')
    .eq('invite_token', args.token)
    .maybeSingle()

  if (lookupError) return { ok: false, code: 'INVALID', detail: lookupError.message }
  if (!invitation) return { ok: false, code: 'INVALID', detail: 'no invitation for that token' }

  // THIS ORDER MATTERS. `tg_handle_new_auth_user` claims a matching invitation
  // the instant the account is created — and it sets `invited_email = null` as it
  // does so. Checking for a missing address first therefore rejected every
  // successful sign-up as invalid, and the caller then "cleaned up" by deleting
  // the auth user, which cascaded through public.users into the very membership
  // the trigger had just created. The account creation succeeded and was then
  // destroyed, reported as a 500.
  //
  // A row already active and already pointed at this user is the success case,
  // whatever `invited_email` now says.
  if (invitation.user_id === args.userId && invitation.status === 'active') {
    // The trigger claims the row but leaves `invite_token` on it, so the link
    // stays in the table after it has been used. Nothing can redeem it again —
    // every lookup requires status='invited' and a null user_id — but a spent
    // token should not sit in the database, least of all one that was emailed.
    await service
      .from('memberships')
      .update({ invite_token: null, invite_expires_at: null })
      .eq('id', invitation.id)

    return { ok: true, alreadyClaimed: true }
  }

  // Null address with a different owner means it was redeemed by someone else.
  if (!invitation.invited_email) {
    return { ok: false, code: 'INVALID', detail: 'invitation already redeemed' }
  }

  if (invitation.invite_expires_at && new Date(invitation.invite_expires_at) < new Date()) {
    return { ok: false, code: 'INVALID', detail: 'expired' }
  }

  // The whole point of an invitation addressed to one mailbox is that only that
  // mailbox can redeem it. Without this, a forwarded or leaked link would let
  // any Google account join the business, and the audit trail would name someone
  // who was never invited.
  const invited = invitation.invited_email.trim().toLowerCase()
  const actual = args.userEmail?.trim().toLowerCase() ?? ''
  if (!actual || actual !== invited) {
    return { ok: false, code: 'EMAIL_MISMATCH', detail: invited }
  }

  const { error: acceptError } = await service.rpc('accept_invitation', {
    p_token: args.token,
    p_user_id: args.userId,
  })

  if (!acceptError) return { ok: true, alreadyClaimed: false }

  // P0002 usually means the sign-up trigger got there first. Confirm the
  // membership really is active and pointed at this user before calling it a win.
  const { data: check } = await service
    .from('memberships')
    .select('status,user_id')
    .eq('tenant_id', invitation.tenant_id)
    .eq('user_id', args.userId)
    .maybeSingle()

  if (check?.status === 'active') return { ok: true, alreadyClaimed: true }

  return { ok: false, code: 'INVALID', detail: acceptError.message }
}
