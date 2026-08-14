'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACTIVE_TENANT_COOKIE } from '@/lib/session.shared'
import type { TenantOption, TenantRow } from '@/types'

/**
 * Switching business = setting one cookie and refreshing.
 *
 * The server layout re-resolves the session for the new tenant, and React Query
 * keys are tenant-scoped, so nothing from the previous business survives the
 * switch in cache.
 */
export function TenantSwitcher({ tenants, current }: { tenants: TenantOption[]; current: TenantRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const switchTo = (tenantId: string) => {
    if (tenantId === current.id) return
    document.cookie = `${ACTIVE_TENANT_COOKIE}=${tenantId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between gap-2 px-2 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              {pending ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Building2 className="size-4 text-primary" />
              )}
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{current.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{current.base_currency}</span>
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Businesses</DropdownMenuLabel>
        {tenants.map(({ tenant, role }) => (
          <DropdownMenuItem
            key={tenant.id}
            onSelect={() => switchTo(tenant.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0">
              <span className="block truncate">{tenant.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{role.name_en}</span>
            </span>
            {tenant.id === current.id && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/onboarding')} className="gap-2">
          <Plus className="size-4" />
          New business
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
