import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { ContactManager } from '@/components/contacts/contact-manager'

export const metadata: Metadata = { title: 'Customers · Myanmar ERP' }

export default async function ContactsPage() {
  await requirePermission('contacts.read')
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <ContactManager />
    </div>
  )
}
