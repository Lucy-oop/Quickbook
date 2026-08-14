'use client'

import { Boxes, Building2, MoreHorizontal, Users, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import { formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExpenseBreakdownRow, ExpenseGroup, Locale } from '@/types'

/**
 * Salary vs office operations vs inventory cost for the selected period.
 *
 * The bars are shares of the period's own total rather than of a target, so the
 * widget answers "where did the money go" without needing a budget configured.
 */
const GROUP_META: Record<ExpenseGroup, { icon: LucideIcon; bar: string; text: string }> = {
  // chart-1..3 are the validated categorical slots from globals.css, so these
  // bars stay distinguishable under colour-vision deficiency in both themes.
  payroll: { icon: Users, bar: 'bg-chart-1', text: 'text-chart-1' },
  office: { icon: Building2, bar: 'bg-chart-2', text: 'text-chart-2' },
  inventory: { icon: Boxes, bar: 'bg-chart-3', text: 'text-chart-3' },
  other: {
    icon: MoreHorizontal,
    bar: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
}

/** Display order, independent of how much each group happens to total. */
const ORDER: ExpenseGroup[] = ['payroll', 'office', 'inventory', 'other']

export function ExpenseBreakdown({
  data,
  loading,
  currency,
  locale,
  emptyLabel,
}: {
  data: ExpenseBreakdownRow[]
  loading: boolean
  currency: string
  locale: Locale
  emptyLabel: string
}) {
  const { t } = useI18n()

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  const byGroup = new Map(data.map((row) => [row.expense_group, row]))
  const total = data.reduce((sum, row) => sum + Number(row.total), 0)

  if (total <= 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="space-y-3">
      {ORDER.map((group) => {
        const row = byGroup.get(group)
        const value = Number(row?.total ?? 0)
        // A group with nothing in it this period is dropped rather than shown as
        // a zero row — four permanent zeroes is noise on a phone.
        if (value <= 0) return null

        const share = (value / total) * 100
        const meta = GROUP_META[group]

        return (
          <div key={group}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <meta.icon className={cn('size-3.5 shrink-0', meta.text)} aria-hidden />
                <span className="truncate">{t(`expense.group.${group}`)}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatMoney(value, { currency, locale })}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', meta.bar)}
                  style={{ width: `${Math.max(share, 2)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                {formatNumber(share, 0, locale)}%
              </span>
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
        <span>{t('dashboard.expenses')}</span>
        <span className="tabular-nums">{formatMoney(total, { currency, locale })}</span>
      </div>
    </div>
  )
}
