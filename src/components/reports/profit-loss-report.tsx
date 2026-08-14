'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { useProfitLoss } from '@/hooks/use-reports'
import { useSession } from '@/components/providers/session-provider'
import { useI18n } from '@/lib/i18n'
import { formatMoney, formatPercent } from '@/lib/format'
import { ReportEmpty, ReportLocked, ReportShell, ReportSkeleton, isPermissionError } from '@/components/reports/report-shell'
import type { DateRange, ProfitLossRow } from '@/types'
import { cn } from '@/lib/utils'

export function ProfitLossReport() {
  const { t } = useI18n()

  return (
    <ReportShell title="အမြတ်အရှုံးစာရင်း / Profit & Loss" subtitle={t('nav.reports')}>
      {(range) => <ProfitLossBody range={range} />}
    </ReportShell>
  )
}

function ProfitLossBody({ range }: { range: DateRange }) {
  const { tenant } = useSession()
  const { locale } = useI18n()
  const query = useProfitLoss(range.from, range.to)

  const money = (value: number) => formatMoney(value, { currency: tenant.base_currency, locale })

  const totals = useMemo(() => {
    const rows = query.data ?? []
    const sum = (section: ProfitLossRow['section']) =>
      rows.filter((r) => r.section === section).reduce((acc, r) => acc + Number(r.amount), 0)

    const revenue = sum('revenue')
    const cogs = sum('cogs')
    const expenses = sum('expense')
    const grossProfit = revenue - cogs

    return {
      revenue,
      cogs,
      expenses,
      grossProfit,
      netProfit: grossProfit - expenses,
      grossMarginPct: revenue === 0 ? 0 : (grossProfit / revenue) * 100,
    }
  }, [query.data])

  if (query.isLoading) return <ReportSkeleton />
  if (query.error) {
    return isPermissionError(query.error) ? (
      <ReportLocked message="Profit & Loss is restricted. Ask the owner for the `reports.pnl` permission." />
    ) : (
      <ReportEmpty title="Profit & Loss" />
    )
  }
  if (!query.data?.length) return <ReportEmpty title="Profit & Loss" />

  const section = (key: ProfitLossRow['section']) => (query.data ?? []).filter((r) => r.section === key)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="ရောင်းရငွေ / Revenue" value={money(totals.revenue)} />
        <SummaryTile
          label="စုစုပေါင်းအမြတ် / Gross Profit"
          value={money(totals.grossProfit)}
          hint={formatPercent(totals.grossMarginPct)}
          tone={totals.grossProfit >= 0 ? 'positive' : 'negative'}
        />
        <SummaryTile
          label="အသားတင်အမြတ် / Net Profit"
          value={money(totals.netProfit)}
          tone={totals.netProfit >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {range.from} — {range.to}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>အကောင့် / Account</TableHead>
                <TableHead className="text-right">ပမာဏ / Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <GroupHeader label="ဝင်ငွေ / Revenue" />
              {section('revenue').map((row) => (
                <TableRow key={`rev-${row.account_code}`}>
                  <TableCell className="pl-6">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{row.account_code}</span>
                    {row.account_name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(row.amount))}</TableCell>
                </TableRow>
              ))}
              <SubtotalRow label="Total Revenue" value={money(totals.revenue)} />

              <GroupHeader label="ကုန်ကျစရိတ် / Cost of Sales" />
              {section('cogs').map((row) => (
                <TableRow key={`cogs-${row.account_code}`}>
                  <TableCell className="pl-6">{row.account_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(row.amount))}</TableCell>
                </TableRow>
              ))}
              <SubtotalRow label="Gross Profit" value={money(totals.grossProfit)} emphasis />

              <GroupHeader label="လုပ်ငန်းသုံးစရိတ် / Operating Expenses" />
              {section('expense').map((row) => (
                <TableRow key={`exp-${row.account_code}`}>
                  <TableCell className="pl-6">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{row.account_code}</span>
                    {row.account_name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(row.amount))}</TableCell>
                </TableRow>
              ))}
              <SubtotalRow label="Total Expenses" value={money(totals.expenses)} />
            </TableBody>
          </Table>

          <Separator />

          <div className="flex items-center justify-between px-3 py-4 sm:px-4">
            <span className="text-base font-semibold">အသားတင်အမြတ် / Net Profit</span>
            <span
              className={cn(
                'text-lg font-bold tabular-nums',
                totals.netProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {money(totals.netProfit)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function GroupHeader({ label }: { label: string }) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={2} className="py-2 text-xs font-semibold uppercase tracking-wide">
        {label}
      </TableCell>
    </TableRow>
  )
}

function SubtotalRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <TableRow>
      <TableCell className={cn('font-medium', emphasis && 'font-semibold')}>{label}</TableCell>
      <TableCell className={cn('text-right tabular-nums font-medium', emphasis && 'font-semibold')}>
        {value}
      </TableCell>
    </TableRow>
  )
}

function SummaryTile({
  label, value, hint, tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 text-xl font-semibold tabular-nums',
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'negative' && 'text-rose-600 dark:text-rose-400',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
