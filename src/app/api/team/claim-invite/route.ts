import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabase } from '@/lib/supabase/server'
import { redeemInvitation } from '@/lib/invitations'

/**
 * POST /api/team/claim-invite — apply an invitation to the user already signed in.
 *
 * The sibling route, `/api/team/accept-invite`, *creates* the account. This one
 * is for the case where the invited address already has one: the invitee signs in
 * with their existing password on the accept page, and the invitation is then
 * claimed for them. Without this they were told "an account already exists,
 * please sign in" and left holding a token with nothing to do.
 *
 * Authenticated by the session cookie, so the caller is whoever just signed in.
 * `redeemInvitation` still checks the token against that user's email, so holding
 * a token is not enough to attach it to an unrelated account.
 */
export const runtime = 'nodejs'

const bodySchema = z.object({ token: z.string().uuid() })

type ErrorCode = 'BAD_REQUEST' | 'UNAUTHENTICATED' | 'EMAIL_MISMATCH' | 'INVALID_TOKEN'

const MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'တောင်းဆိုချက် မမှန်ကန်ပါ။ (Invalid request.)',
  UNAUTHENTICATED: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။ (Please sign in first.)',
  EMAIL_MISMATCH:
    'ဤဖိတ်ခေါ်လွှာသည် အခြားအီးမေးလ်အတွက် ဖြစ်ပါသည်။ (This invitation was sent to a different email address.)',
  INVALID_TOKEN:
    'ဖိတ်ခေါ်လွှာ မမှန်ကန်ပါ သို့မဟုတ် သက်တမ်းကုန်ဆုံးပါပြီ။ (This invitation is no longer valid.)',
}

function fail(code: ErrorCode, status: number, detail?: string) {
  return NextResponse.json({ success: false, code, message: MESSAGES[code], detail }, { status })
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('BAD_REQUEST', 400)

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('UNAUTHENTICATED', 401)

  const redeemed = await redeemInvitation({
    token: parsed.data.token,
    userId: user.id,
    userEmail: user.email,
  })

  if (!redeemed.ok) {
    return redeemed.code === 'EMAIL_MISMATCH'
      ? fail('EMAIL_MISMATCH', 409, redeemed.detail)
      : fail('INVALID_TOKEN', 410, redeemed.detail)
  }

  return NextResponse.json({
    success: true,
    message: 'အဖွဲ့ဝင်ဖြစ်ပါပြီ။ (You have joined the business.)',
    alreadyClaimed: redeemed.alreadyClaimed,
  })
}
