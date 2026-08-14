import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { redeemInvitation } from '@/lib/invitations'

/**
 * Exchanges the PKCE code for a session after an email confirmation, magic link
 * or OAuth sign-in. Supabase sets the auth cookies through the server client's
 * cookie adapter, so the redirect lands already signed in.
 *
 * When an `invite` token rides along — the Google path on /accept-invite — the
 * invitation is redeemed here, once the session exists and the provider has told
 * us which address actually signed in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const inviteToken = searchParams.get('invite')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  if (inviteToken) {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${origin}/accept-invite?token=${inviteToken}&error=no_session`)
    }

    const redeemed = await redeemInvitation({
      token: inviteToken,
      userId: user.id,
      userEmail: user.email,
    })

    if (!redeemed.ok) {
      // Signed in as the wrong person: leaving that session in place would drop
      // them on a dashboard for a business they were never invited to (or none at
      // all), with no hint as to why.
      await supabase.auth.signOut()

      const url = new URL(`${origin}/accept-invite`)
      url.searchParams.set('token', inviteToken)
      url.searchParams.set('error', redeemed.code === 'EMAIL_MISMATCH' ? 'email_mismatch' : 'invalid')
      if (redeemed.code === 'EMAIL_MISMATCH' && redeemed.detail) {
        url.searchParams.set('expected', redeemed.detail)
      }
      return NextResponse.redirect(url)
    }

    return NextResponse.redirect(`${origin}/dashboard`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
