'use client'

import { useState, type ReactNode } from 'react'
import { Download, Lock, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import { dateRangeFromPreset } from '@/lib/format'
import type { DateRange } from '@/types'

type Preset = 'today' | '7d' | '30d' | 'mtd' | 'ytd'

interface Props {
  title: string
  subtitle?: string
  /** Renders the report body once a range is chosen. */
  children: (range: DateRange) => ReactNode
  /** Rows for CSV export, resolved lazily so a locked report exports nothing. */
  onExportCsv?: () => { filename: string; rows: (string | number)[][] } | null
  showRange?: boolean
}

/**
 * Shared frame for every report: range picker, print button, CSV export.
 *
 * CSV export matters more than it looks — Myanmar SMEs routinely hand a
 * spreadsheet to an external accountant at month end.
 */
export function ReportShell({ title, subtitle, children, onExportCsv, showRange = true }: Props) {
  const { t } = useI18n()
  const [preset, setPreset] = useState<Preset>('30d')
  const range = dateRangeFromPreset(preset)

  const exportCsv = () => {
    const payload = onExportCsv?.()
    if (!payload) return

    const csv = payload.rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    // BOM so Excel opens Burmese column headers as UTF-8 rather than mojibake.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = payload.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex gap-2 print:hidden">
          {onExportCsv && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
              <Download className="size-4" />
              CSV
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t('invoice.print')}
          </Button>
        </div>
      </div>

      {showRange && (
        <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)} className="print:hidden">
          <TabsList className="grid w-full grid-cols-5 sm:w-auto">
            <TabsTrigger value="today">{t('common.today')}</TabsTrigger>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
            <TabsTrigger value="mtd">{t('common.thisMonth')}</TabsTrigger>
            <TabsTrigger value="ytd">{t('common.thisYear')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {children(range)}
    </div>
  )
}

/** Shown when an RPC answered 42501 — a role limit, not an outage. */
export function ReportLocked({ message }: { message?: string }) {
  const { t } = useI18n()
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" />
        </span>
        <div>
          <p className="font-medium">{t('permission.denied')}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {message ?? t('permission.deniedBody')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ReportSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </CardContent>
    </Card>
  )
}

export function ReportEmpty({ title }: { title: string }) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="py-12 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
      </CardContent>
    </Card>
  )
}

/** Postgres raises 42501 for our permission guards; PostgREST forwards the code. */
export function isPermissionError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = (error as { message?: string })?.message ?? ''
  return code === '42501' || /permission/i.test(message)
}
