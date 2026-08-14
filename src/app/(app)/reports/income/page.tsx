import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { IncomeReport } from '@/components/reports/income-report'

export const metadata: Metadata = { title: 'Income · Myanmar ERP' }

export default async function IncomePage() {
  await requirePermission('reports.pnl')
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <IncomeReport />
    </div>
  )
}
