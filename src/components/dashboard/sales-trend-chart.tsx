'use client'

import { useMemo } from 'react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { CHART, axisProps, gridProps } from '@/components/charts/chart-tokens'
import { formatDate, formatMoney } from '@/lib/format'
import type { CurrencyCode, Locale, SalesTrendPoint } from '@/types'

interface Props {
  data: SalesTrendPoint[]
  currency: CurrencyCode
  locale: Locale
  /** Cashiers don't get an expense series — the chart drops to one series. */
  showExpenses: boolean
  labels: { sales: string; expenses: string; empty: string }
  /**
   * Rendered instead of `labels.empty` when there is nothing to plot. The test
   * for "nothing to plot" lives here — a trend RPC returns one row per day in
   * the range, so an all-zero series is empty despite having length.
   */
  emptyState?: React.ReactNode
}

/**
 * Sales vs expenses over time.
 *
 * One y-axis, always — both series are money in the same base currency, so they
 * share a scale. (Order *count* is a different unit and lives in its own tile,
 * never on a second axis here.)
 */
export function SalesTrendChart({ data, currency, locale, showExpenses, labels, emptyState }: Props) {
  const points = useMemo(
    () => data.map((d) => ({ ...d, label: formatDate(d.day, locale, 'short') })),
    [data, locale],
  )

  const isEmpty = points.length === 0 || points.every((p) => p.sales === 0 && p.expenses === 0)

  if (isEmpty) {
    return (
      emptyState ?? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          {labels.empty}
        </div>
      )
    )
  }

  return (
    <div>
      {/* Legend sits above the plot: with two series, identity must never be
          carried by color alone. */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <LegendSwatch color={CHART.series1} label={labels.sales} />
        {showExpenses && <LegendSwatch color={CHART.series2} label={labels.expenses} />}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.series1} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART.series1} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.series2} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART.series2} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            {...axisProps}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            {...axisProps}
            width={56}
            tickFormatter={(v: number) =>
              formatMoney(v, { currency, locale, compact: true, showSymbol: false })
            }
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
                  {payload.map((entry) => (
                    <div key={entry.dataKey as string} className="flex items-center gap-2 py-0.5">
                      <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ background: entry.color }}
                        aria-hidden
                      />
                      <span className="text-muted-foreground">
                        {entry.dataKey === 'sales' ? labels.sales : labels.expenses}
                      </span>
                      <span className="ml-auto font-medium tabular-nums text-popover-foreground">
                        {formatMoney(Number(entry.value), { currency, locale })}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }}
          />

          <Area
            type="monotone"
            dataKey="sales"
            stroke={CHART.series1}
            strokeWidth={2}
            fill="url(#fillSales)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
          />
          {showExpenses && (
            <Area
              type="monotone"
              dataKey="expenses"
              stroke={CHART.series2}
              strokeWidth={2}
              fill="url(#fillExpenses)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}
