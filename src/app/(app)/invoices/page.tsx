import type { Metadata } from 'next'
import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { InvoiceList } from '@/components/invoices/invoice-list'

export const metadata: Metadata = { title: 'Invoices · Myanmar ERP' }

export default async function InvoicesPage() {
  const session = await requireSession()

  // A cashier holds `invoices.read_own` rather than `invoices.read`; either is
  // enough to open this list, and RLS decides which rows come back.
  const allowed =
    session.isOwner ||
    session.permissions.includes('invoices.read') ||
    session.permissions.includes('invoices.read_own')

  if (!allowed) redirect('/forbidden')

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <InvoiceList />
    </div>
  )
}
