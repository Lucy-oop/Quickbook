import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { ProfitLossReport } from '@/components/reports/profit-loss-report'

export const metadata: Metadata = { title: 'Profit & Loss · Myanmar ERP' }

export default async function ProfitLossPage() {
  await requirePermission('reports.pnl')
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <ProfitLossReport />
    </div>
  )
}
