import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { SalesReport } from '@/components/reports/sales-report'

export const metadata: Metadata = { title: 'Sales Report · Myanmar ERP' }

export default async function SalesReportPage() {
  await requirePermission('reports.sales')
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <SalesReport />
    </div>
  )
}
