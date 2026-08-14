import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { CurrencyManager } from '@/components/settings/currency-manager'

export const metadata: Metadata = { title: 'Exchange Rates · Myanmar ERP' }

export default async function CurrenciesPage() {
  await requirePermission('currency.manage')
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <CurrencyManager />
    </div>
  )
}
