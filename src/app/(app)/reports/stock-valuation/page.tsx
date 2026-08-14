import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { StockValuationReport } from '@/components/reports/stock-valuation-report'

export const metadata: Metadata = { title: 'Stock Valuation · Myanmar ERP' }

export default async function StockValuationPage() {
  await requirePermission('reports.inventory')
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <StockValuationReport />
    </div>
  )
}
