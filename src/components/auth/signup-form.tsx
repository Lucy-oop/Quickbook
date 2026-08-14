'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { friendlyDbError } from '@/lib/utils'
import { normalizeMyanmarPhone } from '@/components/auth/login-form'

/**
 * Sign-up only creates the *user*. The business is created afterwards at
 * /onboarding, or skipped entirely when the user was invited to someone else's
 * business — the `tg_handle_new_auth_user` trigger claims any pending
 * invitation matching this email or phone the moment the account exists.
 */
export function SignupForm() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const signUpWithEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      })
      if (error) throw error

      if (data.session) {
        // replace() only — a router.refresh() chaser races it and corrupts the
        // in-flight RSC stream. The navigation already carries the new cookies.
        router.replace('/onboarding')
      } else {
        toast.success('အီးမေးလ်စစ်ဆေးပါ / Check your email to confirm')
      }
    } catch (error) {
      toast.error(friendlyDbError(error))
    } finally {
      setLoading(false)
    }
  }

  const sendOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizeMyanmarPhone(phone),
        options: { data: { full_name: fullName } },
      })
      if (error) throw error
      setOtpSent(true)
      toast.success('ကုဒ်ပို့ပြီးပါပြီ / Code sent')
    } catch (error) {
      toast.error(friendlyDbError(error))
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizeMyanmarPhone(phone),
        token: otp,
        type: 'sms',
      })
      if (error) throw error
      // See signUpWithEmail: replace() alone, never followed by refresh().
      router.replace('/onboarding')
    } catch (error) {
      toast.error(friendlyDbError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>အကောင့်ဖွင့်ရန် / Create account</CardTitle>
        <CardDescription>အခမဲ့ ရက် ၃၀ စမ်းသုံးနိုင်ပါသည်</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="mb-3">
          <Label htmlFor="name">အမည်</Label>
          <Input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className="h-12"
            required
          />
        </div>

        <Tabs defaultValue="phone">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone">ဖုန်း</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value="phone">
            <form onSubmit={otpSent ? verifyOtp : sendOtp} className="space-y-3">
              <div>
                <Label htmlFor="signup-phone">ဖုန်းနံပါတ်</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="09 7xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={otpSent}
                  className="h-12"
                  required
                />
              </div>
              {otpSent && (
                <div>
                  <Label htmlFor="signup-otp">SMS ကုဒ်</Label>
                  <Input
                    id="signup-otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="h-12 text-center text-lg tracking-[0.5em]"
                    required
                    autoFocus
                  />
                </div>
              )}
              <Button type="submit" size="lg" className="h-12 w-full" disabled={loading || !fullName}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {otpSent ? 'အတည်ပြုမည်' : 'ကုဒ်တောင်းမည်'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="email">
            <form onSubmit={signUpWithEmail} className="space-y-3">
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">အနည်းဆုံး ၈ လုံး</p>
              </div>
              <Button type="submit" size="lg" className="h-12 w-full" disabled={loading || !fullName}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          အကောင့်ရှိပြီးသားလား?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            ဝင်ရောက်မည်
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
