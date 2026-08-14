'use client'

import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CHART, axisProps, gridProps } from '@/components/charts/chart-tokens'
import { useCashFlow } from '@/hooks/use-reports'
import { useSession } from '@/components/providers/session-provider'
import { useI18n } from '@/lib/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { ReportEmpty, ReportLocked, ReportShell, ReportSkeleton, isPermissionError } from '@/components/reports/report-shell'
import type { DateRange } from '@/types'
import { cn } from '@/lib/utils'

export function CashFlowReport() {
  return (
    <ReportShell title="ငွေစီးဆင်းမှု / Cash Flow" subtitle="Money in and out of your cash and bank accounts">
      {(range) => <CashFlowBody range={range} />}
    </ReportShell>
  )
}

function CashFlowBody({ range }: { range: DateRange }) {
  const { tenant } = useSession()
  const { locale, t } = useI18n()
  const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day')

  const query = useCashFlow(range.from, range.to, bucket)
  const money = (value: number) => formatMoney(value, { currency: tenant.base_currency, locale })

  const totals = useMemo(() => {
    const rows = query.data ?? []
    const inflow = rows.reduce((acc, r) => acc + Number(r.inflow), 0)
    const outflow = rows.reduce((acc, r) => acc + Number(r.outflow), 0)
    return { inflow, outflow, net: inflow - outflow }
  }, [query.data])

  const chartData = useMemo(
    () =>
      (query.data ?? []).map((point) => ({
        ...point,
        label: formatDate(point.period, locale, 'short'),
        // Outflow is plotted negative so the bars diverge from a zero baseline
        // instead of stacking — the direction *is* the information here.
        outflowNegative: -Number(point.outflow),
      })),
    [query.data, locale],
  )

  if (query.isLoading) return <ReportSkeleton />
  if (query.error) {
    return isPermissionError(query.error) ? (
      <ReportLocked message="Cash Flow is restricted. Ask the owner for the `reports.cashflow` permission." />
    ) : (
      <ReportEmpty title="Cash Flow" />
    )
  }
  if (!query.data?.length) return <ReportEmpty title="Cash Flow" />

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="ဝင်ငွေ / Inflow" value={money(totals.inflow)} tone="positive" />
        <Tile label="ထွက်ငွေ / Outflow" value={money(totals.outflow)} tone="negative" />
        <Tile label="အသားတင် / Net" value={money(totals.net)} tone={totals.net >= 0 ? 'positive' : 'negative'} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">{t('dashboard.cashFlow')}</CardTitle>
          <Tabs value={bucket} onValueChange={(v) => setBucket(v as typeof bucket)} className="print:hidden">
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          {/* Two series, so a legend is mandatory — identity is never colour alone. */}
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: CHART.series1 }} aria-hidden />
              ဝင်ငွေ / Inflow
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: CHART.series2 }} aria-hidden />
              ထွက်ငွေ / Outflow
            </span>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
              <YAxis
                {...axisProps}
                width={56}
                tickFormatter={(v: number) =>
                  formatMoney(Math.abs(v), { currency: tenant.base_currency, locale, compact: true, showSymbol: false })
                }
              />
              <ReferenceLine y={0} stroke={CHART.axis} strokeWidth={1} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0]?.payload as (typeof chartData)[number]
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
                      <Row color={CHART.series1} label="Inflow" value={money(Number(point.inflow))} />
                      <Row color={CHART.series2} label="Outflow" value={money(Number(point.outflow))} />
                      <p className="mt-1.5 border-t pt-1.5 font-medium text-popover-foreground">
                        Net {money(Number(point.net))}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="inflow" fill={CHART.series1} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="outflowNegative" fill={CHART.series2} radius={[0, 0, 4, 4]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ရက်စွဲ</TableHead>
                <TableHead className="text-right">ဝင်ငွေ</TableHead>
                <TableHead className="text-right">ထွက်ငွေ</TableHead>
                <TableHead className="text-right">အသားတင်</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((row) => (
                <TableRow key={row.period}>
                  <TableCell>{formatDate(row.period, locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(row.inflow))}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(row.outflow))}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium tabular-nums',
                      Number(row.net) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {money(Number(row.net))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums text-popover-foreground">{value}</span>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 text-xl font-semibold tabular-nums',
            tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
