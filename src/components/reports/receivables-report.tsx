'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useArAp } from '@/hooks/use-reports'
import { useSession } from '@/components/providers/session-provider'
import { useI18n } from '@/lib/i18n'
import { formatMoney } from '@/lib/format'
import { ReportEmpty, ReportLocked, ReportShell, ReportSkeleton, isPermissionError } from '@/components/reports/report-shell'
import type { ArApRow } from '@/types'
import { cn } from '@/lib/utils'

/** Only the numeric aging columns — `contact_id`/`contact_name` are not buckets. */
type AgingBucket = 'current_due' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus'

const BUCKETS: { key: AgingBucket; labelEn: string; labelMy: string }[] = [
  { key: 'current_due', labelEn: 'Current', labelMy: 'မကျော်သေး' },
  { key: 'days_1_30', labelEn: '1–30 days', labelMy: '၁–၃၀ ရက်' },
  { key: 'days_31_60', labelEn: '31–60 days', labelMy: '၃၁–၆၀ ရက်' },
  { key: 'days_61_90', labelEn: '61–90 days', labelMy: '၆၁–၉၀ ရက်' },
  { key: 'days_90_plus', labelEn: '90+ days', labelMy: '၉၀+ ရက်' },
]

/**
 * Aging report. Not date-ranged — "what is outstanding right now" is a
 * position, not a period, so ReportShell's range picker is switched off.
 */
export function ReceivablesReport() {
  const [kind, setKind] = useState<'receivable' | 'payable'>('receivable')

  return (
    <ReportShell
      title={kind === 'receivable' ? 'ရရန်ရှိငွေ / Receivables' : 'ပေးရန်ရှိငွေ / Payables'}
      subtitle="Outstanding balances by how overdue they are"
      showRange={false}
    >
      {() => (
        <div className="space-y-3">
          <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)} className="print:hidden">
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="receivable">ရရန်ရှိငွေ</TabsTrigger>
              <TabsTrigger value="payable">ပေးရန်ရှိငွေ</TabsTrigger>
            </TabsList>
          </Tabs>

          <AgingTable kind={kind} />
        </div>
      )}
    </ReportShell>
  )
}

function AgingTable({ kind }: { kind: 'receivable' | 'payable' }) {
  const { tenant } = useSession()
  const { locale } = useI18n()
  const query = useArAp(kind)

  const money = (value: number) => formatMoney(value, { currency: tenant.base_currency, locale })

  const totals = useMemo(() => {
    const rows = query.data ?? []
    const sum = (key: AgingBucket | 'total_due') => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0)
    return {
      current_due: sum('current_due'),
      days_1_30: sum('days_1_30'),
      days_31_60: sum('days_31_60'),
      days_61_90: sum('days_61_90'),
      days_90_plus: sum('days_90_plus'),
      total_due: sum('total_due'),
    }
  }, [query.data])

  if (query.isLoading) return <ReportSkeleton />
  if (query.error) {
    return isPermissionError(query.error) ? (
      <ReportLocked message="Receivables and payables are restricted. Ask the owner for the `reports.ar_ap` permission." />
    ) : (
      <ReportEmpty title="Aging" />
    )
  }
  if (!query.data?.length) return <ReportEmpty title="Aging" />

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {BUCKETS.map((bucket) => (
          <Card key={bucket.key}>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">
                {locale === 'my' ? bucket.labelMy : bucket.labelEn}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-semibold tabular-nums',
                  bucket.key === 'days_90_plus' && Number(totals[bucket.key]) > 0 && 'text-rose-600 dark:text-rose-400',
                )}
              >
                {money(Number(totals[bucket.key]))}
              </p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-primary/40">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">စုစုပေါင်း / Total</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums">{money(totals.total_due)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {kind === 'receivable' ? 'ဖောက်သည်များ' : 'ပေးသွင်းသူများ'} ({query.data.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>အမည်</TableHead>
                {BUCKETS.map((bucket) => (
                  <TableHead key={bucket.key} className="text-right">
                    {locale === 'my' ? bucket.labelMy : bucket.labelEn}
                  </TableHead>
                ))}
                <TableHead className="text-right">စုစုပေါင်း</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {query.data.map((row) => {
                const overdue = Number(row.days_90_plus) > 0
                return (
                  <TableRow key={row.contact_id ?? row.contact_name}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {row.contact_name}
                        {overdue && <Badge variant="destructive" className="text-[10px]">90+</Badge>}
                      </span>
                    </TableCell>
                    {BUCKETS.map((bucket) => (
                      <TableCell key={bucket.key} className="text-right tabular-nums">
                        {Number(row[bucket.key]) === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          money(Number(row[bucket.key]))
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money(Number(row.total_due))}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">စုစုပေါင်း</TableCell>
                {BUCKETS.map((bucket) => (
                  <TableCell key={bucket.key} className="text-right font-semibold tabular-nums">
                    {money(Number(totals[bucket.key]))}
                  </TableCell>
                ))}
                <TableCell className="text-right font-bold tabular-nums">{money(totals.total_due)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
