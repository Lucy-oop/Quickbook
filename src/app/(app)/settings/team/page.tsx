import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { TeamManager } from '@/components/settings/team-manager'

export const metadata: Metadata = { title: 'Team · Myanmar ERP' }

export default async function TeamPage() {
  await requirePermission('members.read')
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <TeamManager />
    </div>
  )
}
