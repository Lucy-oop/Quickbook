import type { Metadata } from 'next'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { PricingPaywall } from '@/components/billing/pricing-paywall'

export const metadata: Metadata = { title: 'Subscribe · Quick Cash' }

/**
 * Reachable whether or not the subscription has lapsed — the escape-hatch list
 * in `(app)/layout.tsx` exempts `/billing`, so an expired tenant lands here
 * instead of being bounced in a redirect loop.
 *
 * No permission gate: a cashier who hits the wall should see why the app stopped
 * working, not a 403. The paywall itself tells a non-owner to ask the owner.
 */
export default async function SubscribePage() {
  const session = await requireSession()

  // The most recent rejection, so the paywall can say WHY a slip was declined
  // rather than silently showing the price list again — which reads as though the
  // payment never arrived. Only surfaced when it is the latest word on the
  // subject: a rejection followed by a fresh pending submission is stale.
  const supabase = await createServerSupabase()
  const { data: latest } = await supabase
    .from('payment_submissions')
    .select('status,review_note,reviewed_at,plan')
    .eq('tenant_id', session.tenant.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const rejection =
    latest?.status === 'rejected'
      ? { note: latest.review_note, at: latest.reviewed_at, plan: latest.plan }
      : null

  return <PricingPaywall rejection={rejection} />
}
