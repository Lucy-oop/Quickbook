import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export const metadata: Metadata = { title: 'Create your business · Myanmar ERP' }

/**
 * Deliberately OUTSIDE the (app) route group.
 *
 * (app)/layout.tsx requires an active membership, and a brand-new user has
 * none — routing onboarding through it would bounce between /login and
 * /dashboard forever. This page needs only an authenticated user.
 */
export default async function OnboardingPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Already a member somewhere? Nothing to onboard.
  const { count } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active')

  if ((count ?? 0) > 0) redirect('/dashboard')

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4 py-8">
      <OnboardingWizard />
    </div>
  )
}
