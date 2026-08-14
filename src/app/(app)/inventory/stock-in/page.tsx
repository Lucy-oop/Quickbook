import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { InventoryManager } from '@/components/inventory/inventory-manager'

export const metadata: Metadata = { title: 'Stock In · Myanmar ERP' }

/** Same screen, primed so a scan opens the stock-in dialog straight away. */
export default async function StockInPage() {
  await requirePermission('inventory.adjust')
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <InventoryManager initialAction="in" />
    </div>
  )
}
