'use client'

import type { ReactNode } from 'react'
import { useCan } from '@/hooks/use-permission'
import type { Permission } from '@/types'

interface CanProps {
  /** Permission(s) required. Reads as `<Can I="reports.pnl">`. */
  I: Permission | Permission[]
  /** 'all' (default) requires every permission; 'any' requires at least one. */
  mode?: 'all' | 'any'
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Renders `children` only when the current member holds the permission.
 * Pair with a server-side `requirePermission()` on the route itself — this
 * component keeps the UI honest, the database keeps the data safe.
 */
export function Can({ I, mode = 'all', fallback = null, children }: CanProps) {
  const allowed = useCan(I, mode)
  return <>{allowed ? children : fallback}</>
}
