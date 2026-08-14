'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FilePlus2, FileX2, Pencil, ScrollText, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { useI18n } from '@/lib/i18n'
import { formatDate } from '@/lib/format'
import type { AuditAction, AuditLogRow } from '@/types'

const PAGE_SIZE = 50

const ACTION_ICON: Record<AuditAction, typeof Pencil> = {
  insert: FilePlus2,
  update: Pencil,
  delete: FileX2,
  void: ShieldAlert,
  restore: FilePlus2,
  login: ScrollText,
  export: ScrollText,
}

const ACTION_TONE: Record<AuditAction, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  insert: 'secondary',
  update: 'outline',
  delete: 'destructive',
  void: 'destructive',
  restore: 'secondary',
  login: 'outline',
  export: 'outline',
}

/**
 * Who changed what, and when.
 *
 * Rows are written by the `tg_write_audit_log` trigger on fifteen tables, and
 * `audit_logs` has no client-writable policy at all — this screen can only ever
 * read. Updates that touched nothing but `updated_at` are never recorded, so
 * the log stays readable.
 */
export function ActivityLog() {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const [page, setPage] = useState(0)

  const logs = useQuery({
    queryKey: qk.auditLog(tenant.id, page),
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return (data ?? []) as AuditLogRow[]
    },
    placeholderData: (previous) => previous,
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.activity')}</h1>
        <p className="text-sm text-muted-foreground">
          မည်သူက ဘာကို ဘယ်အချိန်တွင် ပြောင်းလဲခဲ့သည်ကို မှတ်တမ်းတင်ထားသည်
        </p>
      </div>

      {logs.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !logs.data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ScrollText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {logs.data.map((log) => {
            const Icon = ACTION_ICON[log.action]
            return (
              <li key={log.id} className="flex items-start gap-3 p-3 sm:px-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{log.user_email ?? 'system'}</span>{' '}
                    <span className="text-muted-foreground">{log.action}</span>{' '}
                    <span className="font-mono text-xs">{log.table_name}</span>
                  </p>

                  {/* Only the columns that actually changed are stored, which is
                      what makes this readable rather than a wall of JSON. */}
                  {!!log.changed_keys?.length && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {log.changed_keys.join(', ')}
                    </p>
                  )}

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(log.created_at, locale, 'datetime')}
                  </p>
                </div>

                <Badge variant={ACTION_TONE[log.action]} className="shrink-0 text-[10px]">
                  {log.action}
                </Badge>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
        >
          ရှေ့သို့
        </Button>
        <span className="text-xs text-muted-foreground">စာမျက်နှာ {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={(logs.data?.length ?? 0) < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          နောက်သို့
        </Button>
      </div>
    </div>
  )
}
