import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { ActivityLog } from '@/components/settings/activity-log'

export const metadata: Metadata = { title: 'Activity Log · Myanmar ERP' }

export default async function ActivityPage() {
  await requirePermission('audit.read')
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <ActivityLog />
    </div>
  )
}
