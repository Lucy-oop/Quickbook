'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, LineChart, Package,
  Percent, PlusCircle, Receipt, ScanLine, ShoppingCart, Wallet,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/dashboard/stat-card'
import { SalesTrendChart } from '@/components/dashboard/sales-trend-chart'
import { TopProductsChart } from '@/components/dashboard/top-products-chart'
import { QuickTransactionDialog } from '@/components/transactions/quick-transaction-dialog'
import { ExpenseBreakdown } from '@/components/dashboard/expense-breakdown'
import { TrialBanner } from '@/components/billing/trial-banner'
import {
  useDashboardSummary, useExpenseBreakdown, useLowStock, useSalesTrend, useTopProducts,
} from '@/hooks/use-dashboard'
import { usePermission } from '@/hooks/use-permission'
import { useSession } from '@/components/providers/session-provider'
import { Money } from '@/components/ui/money'
import { useI18n, localized } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { dateRangeFromPreset, formatMoney, formatNumber, formatPercent } from '@/lib/format'

type Preset = 'today' | '7d' | '30d' | 'mtd'

/**
 * The dashboard renders *the same component* for every role. What changes is
 * what the server sent back: `dashboard_summary` omits profit keys for a
 * cashier, so the profit tiles fall back to their locked state rather than
 * being conditionally mounted in twenty places.
 */
export function DashboardView() {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()
  const [preset, setPreset] = useState<Preset>('30d')

  const range = dateRangeFromPreset(preset)
  const currency = tenant.base_currency

  const summary = useDashboardSummary(range.from, range.to)
  const trend = useSalesTrend(range.from, range.to)
  const topProducts = useTopProducts(range.from, range.to, can('reports.sales'))
  const lowStock = useLowStock(can('inventory.read'))
  const expenseBreakdown = useExpenseBreakdown(range.from, range.to, can('reports.pnl'))

  const s = summary.data
  const money = (v: number | undefined | null) => formatMoney(v ?? 0, { currency, locale })

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <TrialBanner />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{tenant.name}</p>
        </div>

        <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <TabsList className="grid w-full grid-cols-4 sm:w-auto">
            <TabsTrigger value="today">{t('common.today')}</TabsTrigger>
            <TabsTrigger value="7d">{t('common.last7')}</TabsTrigger>
            <TabsTrigger value="30d">{t('common.last30')}</TabsTrigger>
            <TabsTrigger value="mtd">{t('common.thisMonth')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────
          One primary (the sale — the thing a shop does all day) against
          outlined secondaries, so the default action is unambiguous. Uniform
          h-10/px-4 on desktop; taller and full-width on phones, where these are
          thumb targets rather than a toolbar. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {can('pos.use') && (
          <Button asChild className="h-12 justify-start gap-2 sm:h-10 sm:px-4">
            <Link href="/pos">
              <ShoppingCart className="size-4" aria-hidden />
              {t('dashboard.quickSale')}
            </Link>
          </Button>
        )}
        {can('transactions.create') && (
          <>
            <QuickTransactionDialog
              type="expense"
              trigger={
                <Button variant="outline" className="h-12 justify-start gap-2 border-hairline-strong sm:h-10 sm:px-4">
                  <ArrowDownRight className="size-4 text-rose-500" aria-hidden />
                  {t('dashboard.quickExpense')}
                </Button>
              }
            />
            <QuickTransactionDialog
              type="income"
              trigger={
                <Button variant="outline" className="h-12 justify-start gap-2 border-hairline-strong sm:h-10 sm:px-4">
                  <ArrowUpRight className="size-4 text-emerald-500" aria-hidden />
                  {t('dashboard.quickIncome')}
                </Button>
              }
            />
          </>
        )}
        {can('inventory.adjust') && (
          <Button asChild variant="outline" className="h-12 justify-start gap-2 border-hairline-strong sm:h-10 sm:px-4">
            <Link href="/inventory/stock-in">
              <ScanLine className="size-4" aria-hidden />
              {t('dashboard.quickStock')}
            </Link>
          </Button>
        )}
      </div>

      {/* ── KPI tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('dashboard.salesToday')}
          value={<Money value={s?.sales_today} currency={currency} locale={locale} />}
          icon={Banknote}
          hint={t('dashboard.today')}
          loading={summary.isLoading}
        />
        <StatCard
          label={t('dashboard.salesPeriod')}
          value={<Money value={s?.sales_period} currency={currency} locale={locale} />}
          icon={Receipt}
          hint={`${formatNumber(s?.invoice_count ?? 0, 0, locale)} ${t('dashboard.orders')}`}
          loading={summary.isLoading}
        />
        {/* `income_period` was computed server-side and thrown away — nothing
            rendered it. Shown as the hint here because net profit is meaningless
            without the two figures it came from. */}
        <StatCard
          label={t('dashboard.netProfit')}
          value={<Money value={s?.net_period} currency={currency} locale={locale} />}
          icon={Wallet}
          accent={(s?.net_period ?? 0) >= 0 ? 'positive' : 'negative'}
          hint={
            s?.income_period !== undefined || s?.expense_period !== undefined
              ? `${money(s?.income_period)} − ${money(s?.expense_period)}`
              : undefined
          }
          loading={summary.isLoading}
          locked={!can('reports.pnl')}
          lockedHint={t('dashboard.restricted')}
          footer={
            can('reports.pnl') ? <TileLink href="/reports/income" label={t('nav.reports')} /> : undefined
          }
        />
        <StatCard
          label={t('dashboard.margin')}
          value={formatPercent(s?.margin_pct)}
          icon={Percent}
          hint={can('reports.margin') ? money(s?.gross_profit) : undefined}
          loading={summary.isLoading}
          locked={!can('reports.margin')}
          lockedHint={t('dashboard.restricted')}
        />
      </div>

      {/* ── Trend + best sellers ───────────────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.salesTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <SalesTrendChart
                emptyState={
                  <EmptyState
                    icon={LineChart}
                    title={t('empty.noSales')}
                    hint={t('empty.noSalesHint')}
                    action={can('pos.use') ? { href: '/pos', label: t('empty.firstSale'), icon: ShoppingCart } : undefined}
                    className="h-[240px] py-0"
                  />
                }
                data={trend.data ?? []}
                currency={currency}
                locale={locale}
                showExpenses={can('reports.pnl')}
                labels={{
                  sales: t('dashboard.salesPeriod'),
                  expenses: t('dashboard.expenses'),
                  empty: t('common.noData'),
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.topProducts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!can('reports.sales') ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t('dashboard.restricted')}
              </p>
            ) : topProducts.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <TopProductsChart
                emptyState={
                  <EmptyState
                    icon={Package}
                    title={t('empty.noProducts')}
                    hint={t('empty.noProductsHint')}
                    action={can('products.manage') ? { href: '/products', label: t('empty.addProducts'), icon: PlusCircle } : undefined}
                    className="h-[220px] py-0"
                  />
                }
                data={topProducts.data ?? []}
                currency={currency}
                locale={locale}
                emptyLabel={t('common.noData')}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Receivables / payables / low stock ─────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* These two tiles used to end at the figure and leave a band of dead
            space. The footer now carries the follow-up action, which is what a
            receivable or payable actually prompts: go chase it. */}
        <StatCard
          label={t('dashboard.receivable')}
          value={<Money value={s?.receivable_total} currency={currency} locale={locale} />}
          icon={ArrowUpRight}
          hint={
            s?.overdue_count
              ? `${formatNumber(s.overdue_count, 0, locale)} ${t('invoice.status.overdue')}`
              : t('dashboard.allCurrent')
          }
          accent={s?.overdue_count ? 'warning' : 'default'}
          loading={summary.isLoading}
          locked={!can('reports.ar_ap')}
          lockedHint={t('dashboard.restricted')}
          footer={
            can('reports.ar_ap') ? (
              <TileLink href="/reports/receivables" label={t('nav.reports')} />
            ) : undefined
          }
        />
        <StatCard
          label={t('dashboard.payable')}
          value={<Money value={s?.payable_total} currency={currency} locale={locale} />}
          icon={ArrowDownRight}
          hint={(s?.payable_total ?? 0) > 0 ? t('dashboard.toSuppliers') : t('dashboard.allSettled')}
          loading={summary.isLoading}
          locked={!can('reports.ar_ap')}
          lockedHint={t('dashboard.restricted')}
          footer={
            can('reports.ar_ap') ? (
              <TileLink href="/invoices?kind=purchase" label={t('nav.invoices')} />
            ) : undefined
          }
        />

        {/* Where the money went: salary vs office running costs vs stock. */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('expense.breakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!can('reports.pnl') ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('dashboard.restricted')}
              </p>
            ) : (
              <ExpenseBreakdown
                data={expenseBreakdown.data ?? []}
                loading={expenseBreakdown.isLoading}
                currency={currency}
                locale={locale}
                emptyLabel={t('common.noData')}
              />
            )}
          </CardContent>
        </Card>

        {/* Full width on desktop: this is a list, not a tile. */}
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              {t('dashboard.lowStock')}
            </CardTitle>
            {!!lowStock.data?.length && <Badge variant="secondary">{lowStock.data.length}</Badge>}
          </CardHeader>
          <CardContent className="space-y-2">
            {!can('inventory.read') ? (
              <p className="text-sm text-muted-foreground">{t('dashboard.restricted')}</p>
            ) : lowStock.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !lowStock.data?.length ? (
              <EmptyState
                icon={Package}
                title={t('empty.noStock')}
                hint={t('empty.noStockHint')}
                action={can('inventory.adjust') ? { href: '/inventory/stock-in', label: t('empty.stockIn'), icon: PlusCircle } : undefined}
                className="py-6"
              />
            ) : (
              // `/products/[id]` is not a route in this app — these rows used to
              // 404. They now open the products screen pre-filtered to the item.
              lowStock.data.slice(0, 5).map((item) => {
                // Two distinct states, not a gradient: nothing on the shelf is a
                // different conversation from running low, and the view now
                // guarantees threshold > 0 so the comparison is meaningful.
                const out = item.quantity <= 0
                // Fill against the reorder point, so the bar answers "how far
                // below the line is this?" rather than an arbitrary maximum.
                const pct = Math.min(100, Math.max(0, (item.quantity / (item.threshold || 1)) * 100))

                return (
                  <Link
                    // One row per product now, so the id alone is a stable key.
                    key={item.product_id}
                    href={`/products?filter=low-stock&q=${encodeURIComponent(item.sku ?? item.name)}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-overlay-hover"
                  >
                    {/* Thumbnail slot: products have an image_url column but the
                        low-stock view does not select it, so this is the initial
                        placeholder rather than a broken <img>. */}
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                        out ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500',
                      )}
                      aria-hidden
                    >
                      {localized(locale, item.name, item.name_my).slice(0, 1).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {localized(locale, item.name, item.name_my)}
                        </p>
                        <Badge
                          variant={out ? 'danger' : 'warning'}
                          className="shrink-0 gap-1 px-1.5 py-0 text-[10px]"
                        >
                          <AlertTriangle className="size-2.5" aria-hidden />
                          {/* A negative balance should no longer occur — the
                              trigger refuses oversells — but if one is imported or
                              backdated it is named, not shown as "out". */}
                          {item.quantity < 0
                            ? t('dashboard.oversold')
                            : out
                              ? t('stock.outOfStock')
                              : t('stock.lowStock')}
                        </Badge>
                      </div>

                      <div className="mt-0.5">
                        <span
                          className={cn(
                            'text-xs font-semibold tabular-nums',
                            out ? 'text-rose-500' : 'text-amber-500',
                          )}
                        >
                          {formatNumber(item.quantity, 0, locale)}
                          <span className="ml-0.5 font-normal text-muted-foreground">
                            /{formatNumber(item.threshold, 0, locale)} {item.unit}
                          </span>
                        </span>
                      </div>

                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-overlay-hover">
                        <div
                          className={cn('h-full rounded-full', out ? 'bg-rose-500' : 'bg-amber-500')}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                )
              })
            )}

            {/* Both actions stay available whether or not the list is empty —
                seeing what is low is normally followed by receiving it. */}
            <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
              {can('inventory.adjust') && (
                <Button asChild size="sm" className="h-9 flex-1 gap-1.5 px-4">
                  <Link href="/inventory/stock-in">
                    <PlusCircle className="size-3.5" aria-hidden />
                    {t('empty.stockIn')}
                  </Link>
                </Button>
              )}
              {can('products.manage') && (
                <Button asChild variant="outline" size="sm" className="h-9 flex-1 gap-1.5 border-hairline-strong px-4">
                  <Link href="/products?filter=low-stock">
                    <Package className="size-3.5" aria-hidden />
                    {t('nav.products')}
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Mobile floating action ─────────────────────────────────────── */}
      {can('pos.use') && (
        <Button
          asChild
          size="icon"
          className="fixed bottom-20 right-4 z-40 size-14 rounded-full shadow-lg md:hidden"
          aria-label={t('dashboard.quickSale')}
        >
          <Link href="/pos">
            <PlusCircle className="size-6" />
          </Link>
        </Button>
      )}
    </div>
  )
}

/**
 * The follow-up link at the bottom of a KPI tile. A tile that states a balance
 * without offering the next step makes the reader hunt for the screen that
 * explains it.
 */
function TileLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-mx-1 mt-1 flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      {label}
      <ArrowRight className="size-3" aria-hidden />
    </Link>
  )
}
