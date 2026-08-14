'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useI18n, localized } from '@/lib/i18n'

interface Props {
  token: string
  email: string
  tenantName: string
  roleEn: string
  roleMy: string | null
  /** Set by /auth/callback when a Google sign-in could not be redeemed. */
  oauthError?: 'email_mismatch' | 'invalid' | 'no_session'
  /** The invited address, echoed back on a mismatch so the fix is obvious. */
  expectedEmail?: string
}

/**
 * Onboarding for an invited staff member.
 *
 * The email is fixed, not an input: it is what the invitation was addressed to
 * and what binds this token to a membership. Letting it be edited would either
 * silently create an account the invitation cannot attach to, or turn the form
 * into a way to mint an account at any address of the invitee's choosing.
 *
 * Two steps, in this order: the route creates the account server-side (it needs
 * the service role to skip email confirmation), then the browser signs in with
 * the same credentials. The session cookie can only be established from here —
 * a server-minted session cannot be returned through JSON.
 */
export function AcceptInviteForm({
  token, email, tenantName, roleEn, roleMy, oauthError, expectedEmail,
}: Props) {
  const router = useRouter()
  const { locale } = useI18n()

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [google, setGoogle] = useState(false)
  const [failure, setFailure] = useState<{ message: string; offerSignIn: boolean } | null>(
    oauthError
      ? {
          message:
            oauthError === 'email_mismatch'
              ? `Google အကောင့်၏ အီးမေးလ်သည် ဖိတ်ခေါ်ထားသော အီးမေးလ်နှင့် မတူပါ။ ကျေးဇူးပြု၍ ${expectedEmail ?? email} ဖြင့် ဝင်ပါ။ (Sign in with the invited address.)`
              : 'Google ဖြင့် အကောင့်ဝင်၍ မရပါ။ (Google sign-in could not be completed.)',
          offerSignIn: false,
        }
      : null,
  )

  const signInWithGoogle = async () => {
    setGoogle(true)
    setFailure(null)
    try {
      const supabase = getSupabaseBrowserClient()
      // The token rides through the OAuth round-trip so the callback can redeem
      // it once the provider has told us which address actually signed in.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?invite=${encodeURIComponent(token)}`,
          queryParams: { login_hint: email },
        },
      })
      if (error) throw error
      // Success navigates away; nothing to do here.
    } catch (error) {
      setGoogle(false)
      setFailure({
        message:
          error instanceof Error && /provider is not enabled/i.test(error.message)
            ? 'Google ဖြင့်ဝင်ရောက်မှု ပြင်ဆင်ထားခြင်း မရှိပါ။ စကားဝှက်ဖြင့် ဆက်လက်လုပ်ဆောင်ပါ။ (Google sign-in is not enabled — use a password instead.)'
            : 'Google ဖြင့် အကောင့်ဝင်၍ မရပါ။ (Google sign-in failed.)',
        offerSignIn: false,
      })
    }
  }

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && confirm !== password

  /**
   * Validation runs on submit, and the button is never disabled for it.
   *
   * It used to be `disabled={!ready}`, where `ready` demanded a name, 8+
   * characters and a matching confirmation. Miss any one of those and the button
   * was inert — no spinner, no message, nothing. And the mismatch warning only
   * appeared once the confirm field had a character in it, so leaving it blank
   * gave a dead button and no explanation whatsoever. A control that refuses to
   * act must say why, so the click now always produces an answer.
   */
  const validate = (): string | null => {
    if (!fullName.trim()) return 'အမည် ထည့်သွင်းပါ။ (Enter your name.)'
    if (password.length < 8) return 'စကားဝှက် အနည်းဆုံး ၈ လုံး ရှိရပါမည်။ (Password must be at least 8 characters.)'
    if (confirm !== password) return 'စကားဝှက် မတူပါ။ (Passwords do not match.)'
    return null
  }

  /**
   * The invited address already has an account.
   *
   * Rather than dead-ending on "please sign in", the password just typed is
   * tried against it: someone who both holds the emailed token and knows the
   * password is the account owner, and this is the same credential check the
   * login page performs — so it opens no new door. On success the invitation is
   * claimed for that existing user and they land on the dashboard.
   */
  const claimAsExistingUser = async (): Promise<boolean> => {
    const supabase = getSupabaseBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setFailure({
        message:
          'ဤအီးမေးလ်နှင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။ စကားဝှက် မမှန်ပါ — အကောင့်ဝင်ပြီး ဖိတ်ခေါ်လွှာကို ပြန်နှိပ်ပါ။ (An account already exists and that password did not match. Sign in, then open the link again.)',
        offerSignIn: true,
      })
      return false
    }

    // Signed in now, so the cookie is set and this route can redeem for them.
    const claim = await fetch('/api/team/claim-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const claimBody = await claim.json().catch(() => null)

    if (!claim.ok || !claimBody?.success) {
      setFailure({
        message: claimBody?.message ?? 'ဖိတ်ခေါ်လွှာ အသုံးပြု၍ မရပါ။ (The invitation could not be applied.)',
        offerSignIn: false,
      })
      return false
    }

    toast.success(claimBody.message ?? 'အဖွဲ့ဝင်ဖြစ်ပါပြီ။')
    router.replace('/dashboard')
    return true
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return

    const invalid = validate()
    if (invalid) {
      setFailure({ message: invalid, offerSignIn: false })
      toast.error(invalid)
      return
    }

    setLoading(true)
    setFailure(null)

    try {
      const response = await fetch('/api/team/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fullName: fullName.trim(), password }),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        // The address already has an account — try to use it rather than stop.
        if (body?.code === 'EMAIL_TAKEN') {
          await claimAsExistingUser()
          return
        }

        const message = body?.message ?? 'အကောင့်ဖွင့်၍ မရပါ။ (Could not create your account.)'
        setFailure({
          message,
          // Only resolvable by signing in, not by retrying here.
          offerSignIn: body?.code === 'ALREADY_USED',
        })
        toast.error(message)
        return
      }

      const supabase = getSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        // The account exists and the invitation is redeemed — only the automatic
        // sign-in failed, so send them to log in rather than implying failure.
        toast.success('အကောင့် ဖွင့်ပြီးပါပြီ။ ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။')
        router.replace('/login')
        return
      }

      toast.success('အကောင့် ဖွင့်ပြီးပါပြီ။')
      // replace() only — a router.refresh() chaser races it and corrupts the
      // in-flight RSC stream. The navigation already carries the new cookies.
      router.replace('/dashboard')
    } catch {
      const message = 'ကွန်ရက်ချိတ်ဆက်မှု မရပါ။ (Could not reach the server — check your connection.)'
      setFailure({ message, offerSignIn: false })
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{tenantName}</CardTitle>
        <CardDescription className="leading-relaxed">
          သင်ကို <strong>{localized(locale, roleEn, roleMy)}</strong> အဖြစ် ဖိတ်ခေါ်ထားပါသည်။
          အကောင့်ဖွင့်ရန် အောက်တွင် ဖြည့်စွက်ပါ။
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {/* Read-only, and disabled so it is not submitted or autofilled over. */}
          <div>
            <Label htmlFor="ai-email">အီးမေးလ် / Email</Label>
            <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted px-3 py-3">
              <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {localized(locale, roleEn, roleMy)}
              </Badge>
            </div>
            <input type="hidden" id="ai-email" value={email} readOnly />
          </div>

          <div>
            <Label htmlFor="ai-name">အမည် / Full name</Label>
            <Input
              id="ai-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12"
              autoComplete="name"
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <div>
            <Label htmlFor="ai-password">စကားဝှက် / Password</Label>
            <Input
              id="ai-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
              autoComplete="new-password"
              disabled={loading}
              required
            />
            <p className={tooShort ? 'mt-1 text-xs text-destructive' : 'mt-1 text-xs text-muted-foreground'}>
              အနည်းဆုံး ၈ လုံး / At least 8 characters
            </p>
          </div>

          <div>
            <Label htmlFor="ai-confirm">စကားဝှက် အတည်ပြုပါ / Confirm password</Label>
            <Input
              id="ai-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12"
              autoComplete="new-password"
              disabled={loading}
              required
            />
            {mismatch && (
              <p className="mt-1 text-xs text-destructive">
                စကားဝှက် မတူပါ / Passwords do not match
              </p>
            )}
          </div>

          {failure && (
            <div className="space-y-2 rounded-md bg-destructive/10 p-3">
              <p className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {failure.message}
              </p>
              {failure.offerSignIn && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/login">အကောင့်ဝင်ရန် / Sign in</Link>
                </Button>
              )}
            </div>
          )}

          {/* Only disabled while a request is genuinely in flight. Incomplete
              input is reported by validate() on click, not by refusing the click. */}
          <Button type="submit" size="lg" className="h-12 w-full" disabled={loading || google}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {loading ? 'အကောင့်ဖွင့်နေပါသည်... / Creating account…' : 'အကောင့်ဖွင့်မည် / Create account'}
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">သို့မဟုတ် / or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Only usable once Google is enabled as a provider in Supabase Auth;
              until then the click reports that rather than failing silently. */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full gap-2"
            onClick={signInWithGoogle}
            disabled={loading || google}
          >
            {google ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
            Google ဖြင့် ဆက်လက်လုပ်ဆောင်ရန်
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Google အကောင့်သည် <strong>{email}</strong> ဖြစ်ရပါမည်။
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

/** Google's mark, inlined — a remote image would be blocked and lucide has no brand icons. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}
