'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useExpenses } from '@/hooks/use-reports'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { ReportEmpty, ReportLocked, ReportShell, ReportSkeleton, isPermissionError } from '@/components/reports/report-shell'
import type { DateRange } from '@/types'

export function ExpensesReport() {
  return (
    <ReportShell
      title="အသုံးစရိတ် / Expenses"
      subtitle="Posted expenses grouped by account"
    >
      {(range) => <ExpensesBody range={range} />}
    </ReportShell>
  )
}

function ExpensesBody({ range }: { range: DateRange }) {
  const { tenant } = useSession()
  const { locale } = useI18n()
  const query = useExpenses(range.from, range.to)

  const money = (v: number) => formatMoney(v, { currency: tenant.base_currency, locale })

  const total = useMemo(
    () => (query.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
    [query.data],
  )

  if (isPermissionError(query.error)) return <ReportLocked />
  if (query.isLoading) return <ReportSkeleton />
  if (!query.data?.length) return <ReportEmpty title="အသုံးစရိတ် / Expenses" />

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          အသုံးစရိတ်ခွဲခြမ်းစိတ်ဖြာချက် / Breakdown
          <span className="ml-2 text-sm font-normal text-muted-foreground">{money(total)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>အကောင့် / Account</TableHead>
                <TableHead className="text-right">အရေအတွက်</TableHead>
                <TableHead className="text-right">ပမာဏ / Amount</TableHead>
                <TableHead className="w-40 text-right">အချိုး / Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((row) => (
                <TableRow key={row.account_id}>
                  <TableCell>
                    <span className="block font-medium">
                      {localized(locale, row.account_name, row.account_name_my)}
                    </span>
                    <span className="block text-xs text-muted-foreground">{row.account_code}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatNumber(row.entry_count, 0, locale)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money(Number(row.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {/* A bar reads faster than the number when scanning for
                          the one account that ate the month. */}
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(Number(row.share), 100)}%` }}
                        />
                      </span>
                      <span className="w-14 text-right tabular-nums text-muted-foreground">
                        {formatPercent(Number(row.share))}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">စုစုပေါင်း / Total</TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">{money(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
