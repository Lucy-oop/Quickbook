'use client'

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { CHART, axisProps } from '@/components/charts/chart-tokens'
import { formatMoney } from '@/lib/format'
import type { CurrencyCode, Locale, TopProductRow } from '@/types'

interface Props {
  data: TopProductRow[]
  currency: CurrencyCode
  locale: Locale
  emptyLabel: string
  /** Rendered instead of `emptyLabel` when there is nothing to rank. */
  emptyState?: React.ReactNode
}

/**
 * Best sellers by revenue. Horizontal bars because product names are long and
 * Burmese names are longer — a vertical layout would clip or rotate them.
 *
 * One series, so there is no legend: the card title names it. Values are
 * direct-labelled at the bar end, which is why no x-axis is drawn.
 */
export function TopProductsChart({ data, currency, locale, emptyLabel, emptyState }: Props) {
  if (!data.length || data.every((d) => d.revenue === 0)) {
    return (
      emptyState ?? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )
    )
  }

  const rows = data.map((d) => ({
    ...d,
    shortName: d.name.length > 22 ? `${d.name.slice(0, 21)}…` : d.name,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 44)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 72, left: 0, bottom: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid horizontal={false} stroke={CHART.grid} strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="shortName"
          {...axisProps}
          width={120}
          tick={{ fill: CHART.textPrimary, fontSize: 12 }}
        />
        <Bar dataKey="revenue" fill={CHART.series1} radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList
            dataKey="revenue"
            position="right"
            offset={8}
            className="fill-muted-foreground"
            fontSize={11}
            formatter={(value: number) =>
              formatMoney(value, { currency, locale, compact: true })
            }
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
