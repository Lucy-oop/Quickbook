import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { PLANS } from '@/lib/plans'
import { PaymentCheckout } from '@/components/billing/payment-checkout'

export const metadata: Metadata = { title: 'Checkout · Quick Cash' }

/**
 * `?plan=` is validated against the plan table here rather than trusted.
 * An unknown or missing value goes back to the pricing page instead of
 * rendering a checkout for a plan that does not exist — and the price shown
 * comes from `PLANS`, never from the query string, so the amount cannot be
 * edited in the URL.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  await requireSession()
  const { plan: planId } = await searchParams

  const plan = PLANS.find((p) => p.id === planId)
  if (!plan) redirect('/billing/subscribe')

  return <PaymentCheckout plan={plan} />
}
