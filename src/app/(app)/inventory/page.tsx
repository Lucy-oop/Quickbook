import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { InventoryManager } from '@/components/inventory/inventory-manager'

export const metadata: Metadata = { title: 'Inventory · Myanmar ERP' }

export default async function InventoryPage() {
  await requirePermission('inventory.read')
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <InventoryManager />
    </div>
  )
}
