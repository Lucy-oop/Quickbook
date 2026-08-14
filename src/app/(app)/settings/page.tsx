import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowRightLeft, Building2, ScrollText, Sparkles, UserRound, Users } from 'lucide-react'
import { requireSession } from '@/lib/session'
import { Card, CardContent } from '@/components/ui/card'
import { BusinessSettingsForm } from '@/components/settings/business-settings-form'
import { WarehouseManager } from '@/components/settings/warehouse-manager'
import type { Permission } from '@/types'

export const metadata: Metadata = { title: 'Settings · Myanmar ERP' }

const LINKS: { href: string; titleMy: string; titleEn: string; icon: typeof Users; permission: Permission }[] = [
  { href: '/settings/team', titleMy: 'ဝန်ထမ်းများ', titleEn: 'Team & roles', icon: Users, permission: 'members.read' },
  { href: '/settings/employees', titleMy: 'ဝန်ထမ်းစာရင်း', titleEn: 'Employees & payroll', icon: UserRound, permission: 'employees.read' },
  { href: '/settings/custom-fields', titleMy: 'စိတ်ကြိုက်အကွက်များ', titleEn: 'Custom fields', icon: Sparkles, permission: 'settings.custom_fields' },
  { href: '/settings/currencies', titleMy: 'ငွေလဲနှုန်း', titleEn: 'Exchange rates', icon: ArrowRightLeft, permission: 'currency.manage' },
  { href: '/settings/activity', titleMy: 'လုပ်ဆောင်မှုမှတ်တမ်း', titleEn: 'Activity log', icon: ScrollText, permission: 'audit.read' },
]

export default async function SettingsPage() {
  const session = await requireSession()
  const visible = LINKS.filter((l) => session.isOwner || session.permissions.includes(l.permission))

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        <Building2 className="size-5" />
        <h1 className="text-xl font-semibold tracking-tight">ဆက်တင်များ / Settings</h1>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition hover:border-primary/40 hover:bg-accent">
              <CardContent className="flex h-full items-center gap-3 p-4">
                <link.icon className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{link.titleMy}</span>
                  <span className="block truncate text-xs text-muted-foreground">{link.titleEn}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {(session.isOwner || session.permissions.includes('settings.manage')) && <BusinessSettingsForm />}

      {(session.isOwner || session.permissions.includes('inventory.manage_locations')) && <WarehouseManager />}
    </div>
  )
}
