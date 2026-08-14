import type { Metadata } from 'next'
import { requireSession } from '@/lib/session'
import { InvoiceDetail } from '@/components/invoices/invoice-detail'

export const metadata: Metadata = { title: 'Invoice · Myanmar ERP' }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params

  // No permission branch here on purpose: RLS returns nothing for an invoice
  // this member may not see, and the document renders its own empty state.
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <InvoiceDetail invoiceId={id} />
    </div>
  )
}
