import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { EmployeeManager } from '@/components/settings/employee-manager'

export const metadata: Metadata = { title: 'Employees · Myanmar ERP' }

export default async function EmployeesPage() {
  await requirePermission('employees.read')
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <EmployeeManager />
    </div>
  )
}
