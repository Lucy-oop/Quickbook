'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight, ArrowUpRight, Ban, Boxes, Building2, Loader2, MoreHorizontal, Receipt, Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { usePermission } from '@/hooks/use-permission'
import { QuickTransactionDialog } from '@/components/transactions/quick-transaction-dialog'
import { useVoidTransaction } from '@/hooks/use-checkout'
import { useI18n, localized } from '@/lib/i18n'
import { dateRangeFromPreset, formatDate, formatMoney } from '@/lib/format'
import { cn, friendlyDbError } from '@/lib/utils'
import type { ExpenseGroup } from '@/types'

type Filter = 'all' | 'income' | 'expense'

/**
 * Badge styling per expense group. Icons repeat the ones used by the dashboard
 * breakdown so the same kind of spending is recognisable in both places.
 */
const GROUP_BADGE: Record<ExpenseGroup, { icon: LucideIcon; className: string }> = {
  payroll: {
    icon: Users,
    className: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  },
  office: {
    icon: Building2,
    className: 'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  inventory: {
    icon: Boxes,
    className: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  other: { icon: MoreHorizontal, className: '' },
}

export function TransactionList() {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()
  const supabase = getSupabaseBrowserClient()

  const [filter, setFilter] = useState<Filter>('all')
  const range = dateRangeFromPreset('30d')

  const transactions = useQuery({
    queryKey: ['transactions', tenant.id, filter, range.from, range.to],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('occurred_on', range.from)
        .lte('occurred_on', range.to)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') query = query.eq('type', filter)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    placeholderData: (previous) => previous,
  })

  // Category names are joined client-side rather than embedded: `transactions`
  // has TWO foreign keys into `accounts` (account_id and payment_account_id),
  // so a PostgREST embed would need disambiguation on every call site. The
  // chart of accounts is small and cached, so one extra query is cheaper.
  const accounts = useQuery({
    queryKey: qk.accounts(tenant.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id,code,name_en,name_my,expense_group')
        .eq('tenant_id', tenant.id)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })

  const accountById = new Map((accounts.data ?? []).map((account) => [account.id, account]))

  const money = (value: number) => formatMoney(value, { currency: tenant.base_currency, locale })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('nav.transactions')}</h1>
          <p className="text-sm text-muted-foreground">{t('common.last30')}</p>
        </div>

        {can('transactions.create') && (
          <div className="flex gap-2">
            <QuickTransactionDialog
              type="income"
              trigger={
                <Button variant="outline" className="gap-1.5">
                  <ArrowUpRight className="size-4" />
                  ဝင်ငွေ
                </Button>
              }
            />
            <QuickTransactionDialog
              type="expense"
              trigger={
                <Button className="gap-1.5">
                  <ArrowDownRight className="size-4" />
                  ထွက်ငွေ
                </Button>
              }
            />
          </div>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">အားလုံး</TabsTrigger>
          <TabsTrigger value="income">ဝင်ငွေ</TabsTrigger>
          <TabsTrigger value="expense">ထွက်ငွေ</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* A cashier only holds `transactions.read_own`, so RLS quietly limits
          this list to their own entries — no special-casing needed here. */}
      {!can('transactions.read') && (
        <p className="text-xs text-muted-foreground">မိမိမှတ်တမ်းများသာ ပြသထားပါသည်။</p>
      )}

      {transactions.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !transactions.data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Receipt className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {transactions.data.map((txn) => {
            const isIncome = txn.type === 'income'
            const account = txn.account_id ? accountById.get(txn.account_id) : undefined
            const group = account?.expense_group ?? null

            const isVoid = txn.status === 'void'

            return (
              <li
                key={txn.id}
                className={cn(
                  'flex items-center gap-3 p-3 transition-colors hover:bg-overlay-hover sm:px-4',
                  // Voided entries stay visible so the correction is legible next
                  // to what it replaced — dimmed, not deleted.
                  isVoid && 'opacity-55',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    isVoid
                      ? 'bg-muted'
                      : isIncome ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-rose-100 dark:bg-rose-950',
                  )}
                >
                  {isIncome ? (
                    <ArrowUpRight className={cn('size-4', isVoid ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400')} />
                  ) : (
                    <ArrowDownRight className={cn('size-4', isVoid ? 'text-muted-foreground' : 'text-rose-700 dark:text-rose-400')} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', isVoid && 'line-through')}>
                    {txn.description || (account ? localized(locale, account.name_en, account.name_my) : '—')}
                  </p>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(txn.occurred_on, locale)}
                      {account && ` · ${localized(locale, account.name_en, account.name_my)}`}
                    </p>
                    {/* Only expenses carry a group, and 'other' adds nothing a
                        reader cannot already see from the account name. */}
                    {group && group !== 'other' && (
                      <Badge
                        variant="outline"
                        className={cn('shrink-0 gap-1 px-1.5 py-0 text-[10px]', GROUP_BADGE[group].className)}
                      >
                        {(() => {
                          const Icon = GROUP_BADGE[group].icon
                          return <Icon className="size-2.5" aria-hidden />
                        })()}
                        {t(`expense.group.${group}`)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      isVoid
                        ? 'text-muted-foreground line-through'
                        : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {isIncome ? '+' : '−'} {money(Number(txn.amount))}
                  </p>
                  {txn.currency_code !== tenant.base_currency && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {money(Number(txn.amount_base))} {tenant.base_currency}
                    </p>
                  )}
                </div>

                {isVoid ? (
                  <Badge variant="outline" className="shrink-0 text-[10px]">{t('transaction.void')}</Badge>
                ) : (
                  // Invoice-linked rows have no void action here: the RPC refuses
                  // them, because voiding one half would leave the invoice issued
                  // and the stock gone. They are corrected from the invoice.
                  !txn.invoice_id && can('transactions.create') && (
                    <VoidButton transactionId={txn.id} />
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Void action for a standalone entry.
 *
 * A confirm step is warranted: voiding shifts the P&L, cash flow and the
 * dashboard at once, and there is no undo — the corrected figure is entered as a
 * new row rather than by reversing this one.
 */
function VoidButton({ transactionId }: { transactionId: string }) {
  const { t } = useI18n()
  const voidTxn = useVoidTransaction()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const submit = async () => {
    try {
      await voidTxn.mutateAsync({ transactionId, reason: reason.trim() || undefined })
      toast.success(t('transaction.voided'))
      setOpen(false)
      setReason('')
    } catch (error) {
      toast.error(friendlyDbError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t('transaction.voidAction')}
          title={t('transaction.voidAction')}
        >
          <Ban className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('transaction.voidAction')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('transaction.voidExplain')}
        </p>

        <div>
          <Label htmlFor="void-reason">{t('transaction.voidReason')}</Label>
          <Input
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" className="flex-1" onClick={submit} disabled={voidTxn.isPending}>
            {voidTxn.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('transaction.voidAction')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
