'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Boxes, CalendarDays, LayoutDashboard, Menu, Package,
  PanelLeftClose, PanelLeftOpen, Receipt,
  Settings, ShoppingCart, Users, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { usePermission } from '@/hooks/use-permission'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatDate } from '@/lib/format'
import { TenantSwitcher } from '@/components/layout/tenant-switcher'
import { cn } from '@/lib/utils'
import type { Permission, TenantOption } from '@/types'

interface NavItem {
  href: string
  labelKey: string
  icon: typeof LayoutDashboard
  permission: Permission
  /** Shown in the mobile bottom bar (max 5). */
  primary?: boolean
}

const NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view', primary: true },
  { href: '/pos', labelKey: 'nav.pos', icon: ShoppingCart, permission: 'pos.use', primary: true },
  { href: '/invoices', labelKey: 'nav.invoices', icon: Receipt, permission: 'invoices.read_own', primary: true },
  { href: '/transactions', labelKey: 'nav.transactions', icon: Wallet, permission: 'transactions.read_own', primary: true },
  { href: '/products', labelKey: 'nav.products', icon: Package, permission: 'products.read' },
  { href: '/inventory', labelKey: 'nav.inventory', icon: Boxes, permission: 'inventory.read' },
  { href: '/contacts', labelKey: 'nav.contacts', icon: Users, permission: 'contacts.read' },
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'reports.sales' },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings.manage' },
]

/**
 * Responsive app frame: sidebar on desktop, a bottom tab bar plus a drawer on
 * phones. Navigation is filtered by permission, so a cashier simply never sees
 * a Reports tab rather than tapping into a 403.
 */
export function AppShell({ tenants, children }: { tenants: TenantOption[]; children: React.ReactNode }) {
  const pathname = usePathname()
  const { t, locale } = useI18n()
  const { can } = usePermission()
  const { tenant, user, role } = useSession()

  // Rendered only after mount. Beyond the obvious clock-drift problem, Node and
  // the browser ship different ICU data and format a `my-MM` long date
  // differently, so computing this during render mismatches on hydration.
  // Tablet-width screens start collapsed; the choice is per-session by design,
  // since persisting it would need a store and this is a one-tap toggle.
  const [collapsed, setCollapsed] = useState(false)

  const [stamp, setStamp] = useState<{ date: string; time: string } | null>(null)
  useEffect(() => {
    const tick = () =>
      setStamp({
        date: formatDate(new Date(), locale, 'long'),
        time: new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon',
        }).format(new Date()),
      })
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [locale])

  const visible = NAV.filter((item) => can(item.permission))
  const primary = visible.filter((item) => item.primary).slice(0, 4)

  // POS takes over the screen; no chrome.
  if (pathname.startsWith('/pos')) return <>{children}</>

  return (
    <div className="flex min-h-[100dvh]">
      {/* ── Desktop sidebar ────────────────────────────────────────────── */}
      {/* Collapses to an icon rail on tablets, where 240px of chrome is a
          meaningful slice of a 1024px screen but the nav is still wanted. */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-hairline bg-card transition-[width] duration-200 md:flex',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        <div className={cn('border-b border-hairline p-3', collapsed && 'px-2')}>
          {collapsed ? (
            <div
              className="flex h-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary"
              title={tenant.name}
            >
              {tenant.name.slice(0, 1).toUpperCase()}
            </div>
          ) : (
            <TenantSwitcher tenants={tenants} current={tenant} />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {visible.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              label={t(item.labelKey)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="border-t border-hairline p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-overlay-hover hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
            )}
            {!collapsed && <span className="truncate">ခေါက်သိမ်းမည်</span>}
          </button>

          {!collapsed && (
            <div className="px-3.5 py-1.5">
              <p className="truncate text-sm font-medium">{user.full_name ?? user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{role.name_en}</p>
            </div>
          )}

          {/* Brand watermark: quiet enough to ignore, present enough to place the
              product when a shop owner sends a screenshot to support. */}
          {!collapsed && (
            <p className="px-3.5 pt-2 text-[10px] leading-relaxed text-muted-foreground/60">
              Powered by Quick Cash v1.0
            </p>
          )}
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The blur needs a translucent ground to read at all; supports-* keeps a
            solid fallback where backdrop-filter is unavailable. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-hairline bg-background/80 px-3 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-background">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Menu" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="border-b border-hairline p-3">
                <TenantSwitcher tenants={tenants} current={tenant} />
              </div>
              <nav className="p-2">
                {visible.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} />
                ))}
              </nav>
              <p className="px-5 pt-2 text-[10px] text-muted-foreground/60">
                Powered by Quick Cash v1.0
              </p>
            </SheetContent>
          </Sheet>

          <span className="truncate font-semibold md:hidden">{tenant.name}</span>

          {/* min-h reserves the row so filling `stamp` in after mount does not
              shift the header. */}
          <div className="hidden min-h-5 items-center gap-2 md:flex">
            {stamp && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-overlay-subtle px-2.5 py-1 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                <span>{stamp.date}</span>
                <span className="font-medium tabular-nums text-foreground">{stamp.time}</span>
              </span>
            )}
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Badge variant="info" className="shrink-0">
              {localized(locale, role.name_en, role.name_my)}
            </Badge>

            {/* Profile pill: an avatar disc plus the name, so the header has a
                fixed-width anchor at its right edge regardless of name length. */}
            <span className="flex min-w-0 items-center gap-2 rounded-full border border-hairline bg-overlay-subtle py-1 pl-1 pr-1 transition-colors hover:border-hairline-strong lg:pr-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {(user.full_name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-36 truncate text-sm text-muted-foreground lg:inline">
                {user.full_name ?? user.email}
              </span>
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>

        {/* ── Mobile bottom tabs ───────────────────────────────────────── */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 backdrop-blur md:hidden">
          {primary.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px]',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="size-5" />
                <span className="max-w-full truncate px-1">{t(item.labelKey)}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

/**
 * A nav row.
 *
 * Active state is carried three ways — tinted fill, blue text, and a left rule —
 * because a tint alone is too quiet on a dark ground and colour alone fails
 * anyone who cannot distinguish it. `gap-3` fixes 12px between icon and label so
 * Burmese and English rows align identically despite Burmese sitting on a taller
 * line box.
 */
function NavLink({
  item, pathname, label, collapsed = false,
}: {
  item: NavItem
  pathname: string
  label: string
  collapsed?: boolean
}) {
  const active = pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        'my-1 flex items-center gap-3 rounded-lg text-sm transition-colors',
        collapsed ? 'justify-center px-2 py-2.5' : 'border-l-2 px-3.5 py-2.5',
        active
          ? cn('bg-primary/[0.14] font-medium text-primary', !collapsed && 'border-primary')
          : cn(
              'text-muted-foreground hover:bg-overlay-hover hover:text-foreground',
              // Always present, transparent when inactive — a border that only
              // appears on activation shifts the label 2px sideways.
              !collapsed && 'border-transparent',
            ),
      )}
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
