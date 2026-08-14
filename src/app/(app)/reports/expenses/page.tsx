import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { ExpensesReport } from '@/components/reports/expenses-report'

export const metadata: Metadata = { title: 'Expenses · Myanmar ERP' }

export default async function ExpensesPage() {
  await requirePermission('reports.pnl')
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <ExpensesReport />
    </div>
  )
}
