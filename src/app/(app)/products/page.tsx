import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { ProductManager } from '@/components/products/product-manager'

export const metadata: Metadata = { title: 'Products · Myanmar ERP' }

/**
 * The low-stock card on the dashboard deep-links in here, so the initial filter
 * and query arrive as search params. They are read on the server and handed
 * down as plain props — `useSearchParams` in the client component would drag a
 * Suspense boundary in for no gain.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  await requirePermission('products.read')
  const { filter, q } = await searchParams

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <ProductManager
        initialSearch={q ?? ''}
        initialLowStockOnly={filter === 'low-stock'}
      />
    </div>
  )
}
