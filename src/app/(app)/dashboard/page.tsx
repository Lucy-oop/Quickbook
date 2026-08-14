import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { DashboardView } from '@/components/dashboard/dashboard-view'

export const metadata: Metadata = { title: 'Dashboard · Myanmar ERP' }

export default async function DashboardPage() {
  // Server-side gate. The client `usePermission()` hook hides UI; this decides
  // whether the route renders at all.
  await requirePermission('dashboard.view')

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <DashboardView />
    </div>
  )
}
