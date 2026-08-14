'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FilePlus, FileText, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { usePermission } from '@/hooks/use-permission'
import { useI18n } from '@/lib/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { VoucherForm } from '@/components/invoices/voucher-form'
import type { InvoiceStatus } from '@/types'

type Filter = 'all' | 'unpaid' | 'paid' | 'draft'

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  issued: 'secondary',
  partial: 'secondary',
  paid: 'default',
  overdue: 'destructive',
  void: 'outline',
}

export function InvoiceList() {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()
  const supabase = getSupabaseBrowserClient()

  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [voucherOpen, setVoucherOpen] = useState(false)

  const invoices = useQuery({
    queryKey: qk.invoices(tenant.id, { filter, search }),
    queryFn: async () => {
      // v_invoices, not `invoices` — the view masks cost_total and joins the
      // contact and creator names in one round trip.
      let query = supabase
        .from('v_invoices')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('issue_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter === 'unpaid') query = query.in('status', ['issued', 'partial', 'overdue'])
      if (filter === 'paid') query = query.eq('status', 'paid')
      if (filter === 'draft') query = query.eq('status', 'draft')

      const term = search.trim()
      if (term) query = query.or(`number.ilike.%${term}%,contact_name.ilike.%${term}%`)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    placeholderData: (previous) => previous,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.invoices')}</h1>
        <div className="flex gap-2">
          {/* Manual voucher: the counter-free path for phone orders, deliveries
              and back-dated paperwork, which POS cannot express. */}
          {can('invoices.create') && (
            <Button variant="outline" className="gap-2" onClick={() => setVoucherOpen(true)}>
              <FilePlus className="size-4" />
              <span className="hidden sm:inline">{t('voucher.new')}</span>
            </Button>
          )}
          {can('pos.use') && (
            <Button asChild className="gap-2">
              <Link href="/pos">
                <Plus className="size-4" />
                <span className="hidden sm:inline">{t('pos.newSale')}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      <VoucherForm open={voucherOpen} onOpenChange={setVoucherOpen} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="INV-00001 / ဖောက်သည်အမည်"
          className="h-11 pl-9"
          inputMode="search"
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">အားလုံး</TabsTrigger>
          <TabsTrigger value="unpaid">မပေးရသေး</TabsTrigger>
          <TabsTrigger value="paid">{t('invoice.status.paid')}</TabsTrigger>
          <TabsTrigger value="draft">{t('invoice.status.draft')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {invoices.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !invoices.data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {invoices.data.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/invoices/${invoice.id}`}
                className="flex items-center gap-3 p-3 transition hover:bg-accent sm:px-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="font-mono">{invoice.number ?? t('invoice.status.draft')}</span>
                    {invoice.days_overdue > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {invoice.days_overdue}d
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invoice.contact_name ?? t('pos.walkIn')} · {formatDate(invoice.issue_date, locale)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMoney(invoice.total, { currency: invoice.currency_code, locale })}
                  </p>
                  {invoice.balance_due > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t('invoice.balanceDue')} {formatMoney(invoice.balance_due, { currency: invoice.currency_code, locale })}
                    </p>
                  )}
                </div>

                <Badge variant={STATUS_VARIANT[invoice.status]} className="shrink-0 text-[10px]">
                  {t(`invoice.status.${invoice.status}`)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
