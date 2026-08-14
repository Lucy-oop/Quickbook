'use client'

import { useCallback, useMemo } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { evaluate } from '@/lib/permissions'
import type { Permission } from '@/types'

export interface UsePermissionResult {
  /** True when the user has every listed permission (owner always passes). */
  can: (required: Permission | Permission[]) => boolean
  /** True when the user has at least one of the listed permissions. */
  canAny: (required: Permission[]) => boolean
  /** Inverse of `can` — reads better in early-return guards. */
  cannot: (required: Permission | Permission[]) => boolean
  isOwner: boolean
  roleKey: string
  permissions: Permission[]
  /** '{}' means every warehouse; otherwise the ids this member is limited to. */
  warehouseScope: string[]
  canAccessWarehouse: (warehouseId: string | null | undefined) => boolean
}

/**
 * Role permission checker.
 *
 *   const { can } = usePermission()
 *   {can('reports.pnl') && <ProfitCard />}
 *   <Button disabled={!can(['invoices.create', 'pos.use'])}>Checkout</Button>
 *
 * This hides UI. It does not secure data — the same rules are enforced by RLS
 * in Postgres, so a user who forges a request still gets nothing back.
 */
export function usePermission(): UsePermissionResult {
  const session = useSession()
  const { permissions, isOwner, warehouseScope } = session

  const can = useCallback(
    (required: Permission | Permission[]) => evaluate(permissions, isOwner, required, 'all'),
    [permissions, isOwner],
  )

  const canAny = useCallback(
    (required: Permission[]) => evaluate(permissions, isOwner, required, 'any'),
    [permissions, isOwner],
  )

  const cannot = useCallback((required: Permission | Permission[]) => !can(required), [can])

  const canAccessWarehouse = useCallback(
    (warehouseId: string | null | undefined) =>
      isOwner || warehouseScope.length === 0 || (!!warehouseId && warehouseScope.includes(warehouseId)),
    [isOwner, warehouseScope],
  )

  return useMemo(
    () => ({
      can,
      canAny,
      cannot,
      isOwner,
      roleKey: session.role.key,
      permissions,
      warehouseScope,
      canAccessWarehouse,
    }),
    [can, canAny, cannot, isOwner, session.role.key, permissions, warehouseScope, canAccessWarehouse],
  )
}

/**
 * Declarative guard.
 *
 *   <Can I="reports.margin" fallback={<Locked />}>
 *     <MarginChart />
 *   </Can>
 */
export function useCan(required: Permission | Permission[], mode: 'all' | 'any' = 'all'): boolean {
  const { permissions, isOwner } = useSession()
  return useMemo(
    () => evaluate(permissions, isOwner, required, mode),
    [permissions, isOwner, required, mode],
  )
}
