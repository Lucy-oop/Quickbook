import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, MailX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerSupabase } from '@/lib/supabase/server'
import { I18nProvider } from '@/lib/i18n'
import { AcceptInviteForm } from '@/components/auth/accept-invite-form'
import type { InvitationLookup, Locale } from '@/types'

/**
 * The invitee has no session, so there is no `session.locale` the way every
 * route under `(app)` has. The business being joined supplies it instead —
 * `invitation_by_token` returns `tenant_locale` for exactly this. Burmese is the
 * fallback when the token is unknown and there is no tenant to ask.
 */
function localeOf(invitation?: InvitationLookup | null): Locale {
  return invitation?.tenant_locale ?? 'my'
}

export const metadata: Metadata = {
  title: 'ဖိတ်ခေါ်လွှာ · Accept invitation',
  // An invitation link is per-person and carries a live token.
  robots: { index: false, follow: false },
}

/**
 * The invitee has no session, so the token is resolved through
 * `invitation_by_token` — a SECURITY DEFINER RPC granted to `anon` that returns
 * only the business name, the offered role and the invited address.
 *
 * Validated again server-side inside `/api/team/accept-invite` on submit: this
 * page decides what to render, not whether the token is usable.
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; expected?: string }>
}) {
  const { token, error: oauthError, expected } = await searchParams

  if (!token || !isUuid(token)) {
    return <InviteProblem reason="not_found" />
  }

  // supabase-js returns RPC failures in `error` rather than throwing, but the
  // surrounding calls can still throw outright — a missing env var, an
  // unreachable database, a DNS failure. An uncaught throw here renders no page
  // at all and the browser reports "missing required error components", which
  // tells the invitee nothing. This screen is reached from an email by someone
  // who does not work here yet, so it has to degrade into something readable.
  let invitation: InvitationLookup | undefined
  let lookupFailed = false

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.rpc('invitation_by_token', { p_token: token })
    if (error) lookupFailed = true
    // RETURNS TABLE arrives as an array of one row.
    invitation = (data as InvitationLookup[] | null)?.[0]
  } catch (cause) {
    // Logged rather than swallowed: an invitee seeing this is a server problem
    // someone needs to know about, and the fallback below hides it from them.
    console.error('[accept-invite] invitation lookup failed', cause)
    lookupFailed = true
  }

  if (lookupFailed || !invitation || !invitation.valid) {
    return (
      <InviteProblem
        reason={(invitation?.reason as ProblemReason | undefined) ?? 'not_found'}
        tenantName={invitation?.tenant_name}
        locale={localeOf(invitation)}
      />
    )
  }

  return (
    <I18nProvider locale={localeOf(invitation)}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-10">
        <AcceptInviteForm
          token={token}
          email={invitation.email ?? ''}
          tenantName={invitation.tenant_name ?? ''}
          roleEn={invitation.role_name_en ?? ''}
          roleMy={invitation.role_name_my}
          oauthError={
            oauthError === 'email_mismatch' || oauthError === 'invalid' || oauthError === 'no_session'
              ? oauthError
              : undefined
          }
          expectedEmail={expected}
        />
      </div>
    </I18nProvider>
  )
}

type ProblemReason = 'not_found' | 'expired' | 'already_used'

const PROBLEM_COPY: Record<ProblemReason, { title: string; body: string }> = {
  not_found: {
    title: 'ဖိတ်ခေါ်လွှာ မတွေ့ပါ',
    body:
      'ဤလင့်ခ် မမှန်ကန်ပါ။ (This invitation link is not valid.) လင့်ခ်အားလုံးကို ကူးယူထားမှုရှိမရှိ စစ်ဆေးပါ။',
  },
  expired: {
    title: 'သက်တမ်းကုန်ဆုံးပါပြီ',
    body:
      'ဤဖိတ်ခေါ်လွှာ သက်တမ်းကုန်ဆုံးပါပြီ။ (This invitation has expired.) ဆိုင်ပိုင်ရှင်ကို ဖိတ်ခေါ်လွှာ ပြန်ပို့ပေးရန် အကြောင်းကြားပါ။',
  },
  already_used: {
    title: 'အသုံးပြုပြီးဖြစ်ပါသည်',
    body:
      'ဤဖိတ်ခေါ်လွှာကို အသုံးပြုပြီးဖြစ်ပါသည်။ (This invitation has already been used.) အကောင့်ရှိပါက အကောင့်ဝင်ပါ။',
  },
}

/**
 * Wrapped in the provider too. Nothing here calls `useI18n`, so it would not
 * throw — but the provider is also what applies `lang` and the Padauk font
 * stack, without which this screen's Burmese renders in a Latin face and clips
 * its stacked diacritics.
 */
function InviteProblem({
  reason, tenantName, locale = 'my',
}: {
  reason: ProblemReason
  tenantName?: string | null
  locale?: Locale
}) {
  const copy = PROBLEM_COPY[reason] ?? PROBLEM_COPY.not_found
  const Icon = reason === 'expired' ? AlertTriangle : MailX

  return (
    <I18nProvider locale={locale}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon className="size-6 text-muted-foreground" aria-hidden />
            </span>
            <CardTitle className="text-lg">{copy.title}</CardTitle>
            <CardDescription className="leading-relaxed">{copy.body}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            {tenantName && (
              <p className="text-center text-sm text-muted-foreground">
                {tenantName}
              </p>
            )}

            {/* There is no in-app way to reach the owner from a signed-out page,
                so the honest action is to send them back to sign in. */}
            <Button asChild className="h-12 w-full">
              <Link href="/login">အကောင့်ဝင်ရန် / Sign in</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              ဆိုင်ပိုင်ရှင်ထံ ဆက်သွယ်၍ ဖိတ်ခေါ်လွှာ အသစ်ပြန်ပို့ပေးရန် တောင်းဆိုပါ။
              <span className="mt-1 block">
                Ask the store owner to send a new invitation.
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </I18nProvider>
  )
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
