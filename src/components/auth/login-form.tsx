'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { friendlyDbError } from '@/lib/utils'

/**
 * Two ways in, because both are normal in Myanmar:
 *   • email + password — office staff and accountants
 *   • phone + SMS OTP  — shop owners, many of whom have no email address
 *
 * Phone numbers are normalised to E.164 (+95…) before they reach Supabase Auth,
 * since people type them as 09…, 9…, or 0095… interchangeably.
 */
export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const signInWithEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Navigate only — no router.refresh() chaser. The two dispatch competing
      // RSC fetches into the same router transition, and the second stream
      // lands on chunks the first already resolved ("chunk.reason.enqueueModel
      // is not a function"). replace() already sends the cookies Supabase just
      // wrote, so the server renders the signed-in tree on the first request.
      router.replace(next)
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
      const { error } = await supabase.auth.signInWithOtp({ phone: normalizeMyanmarPhone(phone) })
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
      // See signInWithEmail: replace() alone, never followed by refresh().
      router.replace(next)
    } catch (error) {
      toast.error(friendlyDbError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ဝင်ရောက်ရန် / Sign in</CardTitle>
        <CardDescription>လုပ်ငန်းစာရင်းသို့ ဝင်ရောက်ပါ</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="phone">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone" className="gap-1.5">
              <Phone className="size-3.5" /> ဖုန်း
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="size-3.5" /> Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone">
            <form onSubmit={otpSent ? verifyOtp : sendOtp} className="space-y-3">
              <div>
                <Label htmlFor="phone">ဖုန်းနံပါတ်</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
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
                  <Label htmlFor="otp">SMS ကုဒ်</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="h-12 text-center text-lg tracking-[0.5em]"
                    required
                    autoFocus
                  />
                </div>
              )}

              <Button type="submit" size="lg" className="h-12 w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {otpSent ? 'အတည်ပြုမည်' : 'ကုဒ်တောင်းမည်'}
              </Button>

              {otpSent && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setOtpSent(false)}>
                  နံပါတ်ပြင်မည်
                </Button>
              )}
            </form>
          </TabsContent>

          <TabsContent value="email">
            <form onSubmit={signInWithEmail} className="space-y-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                  showLabel="စကားဝှက် ပြရန်"
                  hideLabel="စကားဝှက် ဖုံးရန်"
                  required
                />
              </div>
              <Button type="submit" size="lg" className="h-12 w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          အကောင့်မရှိသေးဘူးလား?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            အကောင့်ဖွင့်မည်
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * 09xxxxxxxxx / 9xxxxxxxxx / 0095… / +95… all mean the same number.
 * Supabase Auth only accepts E.164, so normalise before sending.
 */
export function normalizeMyanmarPhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0095')) return `+${digits.slice(2)}`
  if (digits.startsWith('95')) return `+${digits}`
  if (digits.startsWith('0')) return `+95${digits.slice(1)}`
  return `+95${digits}`
}
