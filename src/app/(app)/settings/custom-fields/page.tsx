import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { CustomFieldsManager } from '@/components/settings/custom-fields-manager'

export const metadata: Metadata = { title: 'Custom Fields · Myanmar ERP' }

export default async function CustomFieldsPage() {
  await requirePermission('settings.custom_fields')
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <CustomFieldsManager />
    </div>
  )
}
