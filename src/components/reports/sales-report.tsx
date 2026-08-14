'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSalesReport } from '@/hooks/use-reports'
import { useSession } from '@/components/providers/session-provider'
import { useI18n } from '@/lib/i18n'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { ReportEmpty, ReportLocked, ReportShell, ReportSkeleton, isPermissionError } from '@/components/reports/report-shell'
import type { DateRange, SalesMetric, SalesReportRow } from '@/types'

/** Display order and labels for the headline metrics. */
const METRICS: { key: SalesMetric; labelEn: string; labelMy: string; strong?: boolean }[] = [
  { key: 'gross', labelEn: 'Gross sales', labelMy: 'စုစုပေါင်းရောင်းအား' },
  { key: 'discount', labelEn: 'Less discounts', labelMy: 'လျှော့ဈေး' },
  { key: 'tax', labelEn: 'Tax', labelMy: 'အခွန်' },
  { key: 'shipping', labelEn: 'Shipping', labelMy: 'ပို့ဆောင်ခ' },
  { key: 'net', labelEn: 'Net sales', labelMy: 'အသားတင်ရောင်းအား', strong: true },
  { key: 'cost', labelEn: 'Cost of goods', labelMy: 'ကုန်ကျစရိတ်' },
  { key: 'profit', labelEn: 'Gross profit', labelMy: 'အကြမ်းအမြတ်', strong: true },
]

const METHOD_LABELS: Record<string, string> = {
  cash: 'ငွေသား / Cash',
  kbz_pay: 'KBZPay',
  wave_pay: 'WavePay',
  aya_pay: 'AYA Pay',
  cb_pay: 'CB Pay',
  bank_transfer: 'ဘဏ် / Bank',
  card: 'ကတ် / Card',
  credit: 'အကြွေး / Credit',
  other: 'အခြား / Other',
}

export function SalesReport() {
  return (
    <ReportShell
      title="ရောင်းအားအစီရင်ခံစာ / Sales Report"
      subtitle="Gross versus net sales, and how customers actually paid"
    >
      {(range) => <SalesBody range={range} />}
    </ReportShell>
  )
}

function SalesBody({ range }: { range: DateRange }) {
  const { tenant } = useSession()
  const { locale } = useI18n()
  const query = useSalesReport(range.from, range.to)

  const money = (v: number) => formatMoney(v, { currency: tenant.base_currency, locale })

  const { metrics, methods, invoiceCount, methodTotal } = useMemo(() => {
    const rows = query.data ?? []
    const byLabel = new Map(rows.filter((r) => r.section === 'total').map((r) => [r.label, r]))
    const methodRows = rows.filter((r) => r.section === 'method')
    return {
      metrics: byLabel,
      methods: methodRows,
      invoiceCount: byLabel.get('gross')?.invoice_count ?? 0,
      methodTotal: methodRows.reduce((sum, r) => sum + r.amount, 0),
    }
  }, [query.data])

  if (isPermissionError(query.error)) return <ReportLocked />
  if (query.isLoading) return <ReportSkeleton />
  if (!query.data?.length || invoiceCount === 0) {
    return <ReportEmpty title="ရောင်းအားအစီရင်ခံစာ / Sales Report" />
  }

  const value = (key: SalesMetric) => metrics.get(key)?.amount ?? 0
  const net = value('net')
  const marginPct = net === 0 ? 0 : (value('profit') / net) * 100

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            အကျဉ်းချုပ် / Summary
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {formatNumber(invoiceCount, 0, locale)} invoices
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Table>
            <TableBody>
              {METRICS.map((metric) => (
                <TableRow key={metric.key}>
                  <TableCell className={metric.strong ? 'font-medium' : undefined}>
                    {locale === 'my' ? metric.labelMy : metric.labelEn}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${metric.strong ? 'font-semibold' : ''}`}
                  >
                    {/* Discounts reduce the total, so show them as a deduction. */}
                    {metric.key === 'discount' && value('discount') > 0 ? '− ' : ''}
                    {money(value(metric.key))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>အမြတ်ရာခိုင်နှုန်း / Margin</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(marginPct)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ငွေပေးချေမှုနည်းလမ်း / Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {methods.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              ဤကာလအတွင်း ငွေလက်ခံမှုမရှိပါ
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>နည်းလမ်း / Method</TableHead>
                  <TableHead className="text-right">အရေအတွက်</TableHead>
                  <TableHead className="text-right">ပမာဏ</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{METHOD_LABELS[row.label] ?? row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.invoice_count, 0, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPercent(methodTotal === 0 ? 0 : (row.amount / methodTotal) * 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">စုစုပေါင်း / Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money(methodTotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
