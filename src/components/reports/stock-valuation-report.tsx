'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStockValuation } from '@/hooks/use-reports'
import { useWarehouses } from '@/hooks/use-products'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney, formatNumber } from '@/lib/format'
import { ReportEmpty, ReportLocked, ReportShell, ReportSkeleton, isPermissionError } from '@/components/reports/report-shell'

const ALL = '__all__'

/**
 * What is on the shelves and what it is worth.
 *
 * A position rather than a period, so the range picker is off — the same reason
 * the aging report switches it off.
 */
export function StockValuationReport() {
  const [warehouse, setWarehouse] = useState<string>(ALL)
  const warehouses = useWarehouses()

  return (
    <ReportShell
      title="ဂိုဒေါင်လက်ကျန် / Stock Balance & Valuation"
      subtitle="Quantity on hand valued at moving-average cost"
      showRange={false}
    >
      {() => (
        <div className="space-y-3">
          <Select value={warehouse} onValueChange={setWarehouse}>
            <SelectTrigger className="w-full sm:w-64 print:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ဂိုဒေါင်အားလုံး / All warehouses</SelectItem>
              {(warehouses.data ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ValuationTable warehouseId={warehouse === ALL ? null : warehouse} />
        </div>
      )}
    </ReportShell>
  )
}

function ValuationTable({ warehouseId }: { warehouseId: string | null }) {
  const { tenant } = useSession()
  const { locale } = useI18n()
  const query = useStockValuation(warehouseId)

  const money = (v: number) => formatMoney(v, { currency: tenant.base_currency, locale })

  const totals = useMemo(() => {
    const rows = query.data ?? []
    return {
      // "Types" counts distinct products, not rows: one product stocked in
      // three warehouses is one type, not three.
      types: new Set(rows.map((r) => r.product_id)).size,
      quantity: rows.reduce((sum, r) => sum + Number(r.quantity), 0),
      stockValue: rows.reduce((sum, r) => sum + Number(r.stock_value), 0),
      retailValue: rows.reduce((sum, r) => sum + Number(r.retail_value), 0),
    }
  }, [query.data])

  if (isPermissionError(query.error)) return <ReportLocked />
  if (query.isLoading) return <ReportSkeleton />
  if (!query.data?.length) return <ReportEmpty title="ဂိုဒေါင်လက်ကျန် / Stock Valuation" />

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="အမျိုးအမည် / Types" value={formatNumber(totals.types, 0, locale)} />
        <SummaryTile label="စုစုပေါင်းတန်ဖိုး / Cost value" value={money(totals.stockValue)} strong />
        <SummaryTile label="ရောင်းဈေးတန်ဖိုး / Retail value" value={money(totals.retailValue)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ပစ္စည်းလက်ကျန် / Stock on hand</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ပစ္စည်းအမည် / Item</TableHead>
                  <TableHead>ဂိုဒေါင်</TableHead>
                  <TableHead className="text-right">လက်ကျန်</TableHead>
                  <TableHead className="text-right">ကုန်ကျစရိတ်</TableHead>
                  <TableHead className="text-right">တန်ဖိုး / Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((row) => (
                  <TableRow key={`${row.product_id}-${row.warehouse_id}`}>
                    <TableCell>
                      <span className="block font-medium">
                        {localized(locale, row.name, row.name_my)}
                      </span>
                      {row.sku && (
                        <span className="block text-xs text-muted-foreground">{row.sku}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.warehouse_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(row.quantity) < 0 ? (
                        <Badge variant="destructive" className="tabular-nums">
                          {formatNumber(row.quantity, 0, locale)} {row.unit}
                        </Badge>
                      ) : (
                        <>{formatNumber(row.quantity, 0, locale)} {row.unit}</>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money(Number(row.avg_cost))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(Number(row.stock_value))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">စုစုပေါင်း / Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(totals.quantity, 0, locale)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money(totals.stockValue)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryTile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 tabular-nums ${strong ? 'text-2xl font-semibold' : 'text-xl font-medium'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
