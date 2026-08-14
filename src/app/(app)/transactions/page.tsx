import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { TransactionList } from '@/components/transactions/transaction-list'

export const metadata: Metadata = { title: 'Income & Expense · Myanmar ERP' }

export default async function TransactionsPage() {
  const session = await requireSession()

  const allowed =
    session.isOwner ||
    session.permissions.includes('transactions.read') ||
    session.permissions.includes('transactions.read_own')

  if (!allowed) redirect('/forbidden')

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <TransactionList />
    </div>
  )
}
