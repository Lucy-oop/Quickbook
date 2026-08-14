import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { ReceivablesReport } from '@/components/reports/receivables-report'

export const metadata: Metadata = { title: 'Receivables · Myanmar ERP' }

export default async function ReceivablesPage() {
  await requirePermission('reports.ar_ap')
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <ReceivablesReport />
    </div>
  )
}
