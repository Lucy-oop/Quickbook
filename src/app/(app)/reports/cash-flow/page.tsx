import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { CashFlowReport } from '@/components/reports/cash-flow-report'

export const metadata: Metadata = { title: 'Cash Flow · Myanmar ERP' }

export default async function CashFlowPage() {
  await requirePermission('reports.cashflow')
  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
      <CashFlowReport />
    </div>
  )
}
