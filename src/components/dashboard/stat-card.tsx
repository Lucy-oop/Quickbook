'use client'

import type { ReactNode } from 'react'
import { type LucideIcon, TrendingDown, TrendingUp, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  /** Pre-formatted string, or a <Money> element when the unit should recede. */
  value: ReactNode
  icon: LucideIcon
  /** Percentage change vs the previous period; omit to hide the delta row. */
  delta?: number | null
  /** Wording for what the delta compares against, e.g. "vs last week". */
  deltaLabel?: string
  hint?: string
  loading?: boolean
  /** Renders a lock instead of the number when the role can't see this metric. */
  locked?: boolean
  lockedHint?: string
  accent?: 'default' | 'positive' | 'negative' | 'warning'
  /** Extra content pinned to the bottom — a mini activity log, a progress bar. */
  footer?: ReactNode
}

const ACCENTS = {
  default: 'text-foreground',
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
} as const

/**
 * A stat tile is a chart form in its own right: one number, big, with its label
 * and at most one comparison. No sparkline unless the trend is the point.
 */
export function StatCard({
  label, value, icon: Icon, delta, deltaLabel, hint, footer,
  loading = false, locked = false, lockedHint, accent = 'default',
}: StatCardProps) {
  if (locked) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-[112px] flex-col justify-center gap-1 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="size-4 shrink-0" aria-hidden />
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{lockedHint}</p>
        </CardContent>
      </Card>
    )
  }

  const up = (delta ?? 0) >= 0

  return (
    <Card className="group">
      <CardContent className="flex min-h-[112px] flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {/* The icon is decoration, so it sits back until the card is hovered. */}
          <Icon
            className="size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-muted-foreground"
            aria-hidden
          />
        </div>

        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <p className={cn('text-2xl font-bold leading-tight tracking-tight', ACCENTS[accent])}>
            {value}
          </p>
        )}

        {/* mt-auto pins this row to the bottom, so tiles with and without a delta
            still line their figures up across the row. */}
        <div className="mt-auto min-h-[18px]">
          {loading ? (
            <Skeleton className="h-3.5 w-20" />
          ) : typeof delta === 'number' ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-medium tabular-nums',
                  up
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400',
                )}
              >
                {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                {up ? '+' : ''}{delta.toFixed(1)}%
              </span>
              {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
              {hint && <span className="text-muted-foreground">{hint}</span>}
            </div>
          ) : hint ? (
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>

        {footer}
      </CardContent>
    </Card>
  )
}
