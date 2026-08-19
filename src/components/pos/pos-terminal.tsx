'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Barcode, Camera, Check, Loader2, Minus, Plus, Printer, Search,
  ShoppingCart, Trash2, User, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

import { useCartStore } from '@/stores/cart-store'
import { useProducts, useProductByBarcode, useProductCategories, useWarehouses } from '@/hooks/use-products'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useKeyShortcut } from '@/hooks/use-shortcut'
import { useCheckout } from '@/hooks/use-checkout'
import { usePermission } from '@/hooks/use-permission'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney, formatNumber } from '@/lib/format'
import { InvoiceDocument } from '@/components/invoice/invoice-document'
import { CameraScanner, useCameraScanSupported } from '@/components/pos/camera-scanner'
import { useExchangeRates } from '@/hooks/use-currencies'
import type { CurrencyCode, InvoiceRow, PaymentMethod, ProductView } from '@/types'
import { cn } from '@/lib/utils'

const PAYMENT_METHODS: { value: PaymentMethod; labelEn: string; labelMy: string }[] = [
  { value: 'cash', labelEn: 'Cash', labelMy: 'ငွေသား' },
  { value: 'kbz_pay', labelEn: 'KBZPay', labelMy: 'KBZPay' },
  { value: 'wave_pay', labelEn: 'WavePay', labelMy: 'WavePay' },
  { value: 'aya_pay', labelEn: 'AYA Pay', labelMy: 'AYA Pay' },
  { value: 'bank_transfer', labelEn: 'Bank', labelMy: 'ဘဏ်' },
  { value: 'credit', labelEn: 'Credit', labelMy: 'အကြွေး' },
]

/** Quick-tender buttons sized for MMK notes actually in circulation. */
const QUICK_CASH = [1_000, 5_000, 10_000, 20_000, 50_000]

/**
 * Touch-first point of sale.
 *
 * Layout: product grid + cart side-by-side on tablet/desktop; on a phone the
 * cart collapses into a bottom sheet with a persistent total bar, so the whole
 * flow is reachable with one thumb.
 */
export function PosTerminal() {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [receipt, setReceipt] = useState<InvoiceRow | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const categories = useProductCategories()

  const cart = useCartStore()
  // Derived during render, not via a selector: totals() builds a fresh object
  // every call, and zustand v5 compares snapshots with Object.is — subscribing
  // to it makes getSnapshot unstable and React re-renders until it gives up
  // ("Maximum update depth exceeded"). `cart` above already covers the reads.
  const totals = cart.totals()
  const products = useProducts(search)
  const warehouses = useWarehouses()
  const cameraSupported = useCameraScanSupported()
  const lookupBarcode = useProductByBarcode()
  const checkout = useCheckout()

  const currency = tenant.base_currency
  const money = useCallback(
    (value: number) => formatMoney(value, { currency: cart.currency || currency, locale }),
    [cart.currency, currency, locale],
  )

  // Default the cart to this member's warehouse once the list loads — and
  // correct it if it belongs to anyone else.
  //
  // The cart is persisted to localStorage *including* warehouseId, so switching
  // business rehydrates the previous tenant's warehouse and the next checkout
  // would post stock movements against it. The composite FKs added in
  // 20260812000800 now reject that outright, which turns a silent cross-tenant
  // write into a failed sale — so the id has to be re-validated here, not merely
  // defaulted when absent.
  useEffect(() => {
    if (!warehouses.data?.length) return

    const owned = warehouses.data.filter((w) => w.tenant_id === tenant.id)
    if (!owned.length) return

    if (!cart.warehouseId || !owned.some((w) => w.id === cart.warehouseId)) {
      cart.setWarehouse(owned.find((w) => w.is_default)?.id ?? owned[0].id)
    }
  }, [warehouses.data, cart, tenant.id])

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const product = await lookupBarcode(code)
        if (!product) {
          toast.error(`${t('common.search')}: ${code}`, { description: t('common.noData') })
          return
        }
        if (product.track_inventory && product.stock_on_hand <= 0) {
          toast.warning(product.name, { description: t('pos.outOfStock') })
        }
        cart.addProduct(product)
        // Short haptic tick confirms the scan without the cashier looking up.
        navigator.vibrate?.(30)
      } catch (error) {
        toast.error((error as Error).message)
      }
    },
    [lookupBarcode, cart, t],
  )

  useBarcodeScanner({ onScan: handleScan, enabled: can('pos.use') })

  // F2 — start the next sale: clear the search and put the caret back in the box,
  // which is where a cashier's hands already are between customers.
  // (Esc needs no binding: every dialog and sheet here is Radix, which closes on
  // Esc and restores focus to its trigger already.)
  useKeyShortcut('F2', () => {
    setSearch('')
    setCategoryId(null)
    searchRef.current?.focus()
  }, { allowWhileTyping: true })

  // Category filtering is client-side: `useProducts(search)` already holds the
  // active list, and a shop's catalogue is small enough that a round-trip per
  // pill tap would be slower than the tap itself.
  const visibleProducts = useMemo(() => {
    const list = products.data ?? []
    return categoryId ? list.filter((p) => p.category_id === categoryId) : list
  }, [products.data, categoryId])

  const onCompleteSale = async (paidAmount: number, method: PaymentMethod) => {
    try {
      const invoice = await checkout.mutateAsync({
        kind: 'pos',
        contactId: cart.contactId,
        warehouseId: cart.warehouseId,
        currency: cart.currency,
        exchangeRate: cart.exchangeRate,
        method,
        paidAmount,
        // The store keeps an invoice-level discount separate from line
        // discounts; it has to travel or the customer is charged full price.
        orderDiscount: cart.orderDiscount,
        notes: cart.note || undefined,
        lines: cart.lines,
        customFields: {},
      })

      cart.clear()
      setPayOpen(false)
      setCartOpen(false)
      setReceipt(invoice)
      toast.success(t('pos.saleComplete'), { description: invoice.number })
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background lg:flex-row">
      {/* ── Product grid — 65% ─────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-1 flex-col border-hairline lg:w-[65%] lg:border-r">
        <header className="flex items-center gap-2 border-b border-hairline p-3">
          {/* AppShell renders no chrome on /pos so the grid gets the full
              screen — which also means this is the only way back out. */}
          <Button
            asChild
            size="icon"
            variant="outline"
            className="size-12 shrink-0"
            aria-label={t('pos.exit')}
            title={t('pos.exit')}
          >
            <Link href="/dashboard">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Enter in the search box = a scan from a wedge scanner.
                if (e.key === 'Enter' && search.trim().length >= 4) {
                  handleScan(search.trim())
                  setSearch('')
                }
              }}
              placeholder={t('pos.scanOrSearch')}
              className="h-12 pl-9 text-base"
              inputMode="search"
              autoComplete="off"
            />
          </div>
          {/* Camera scanning where the browser supports it; the USB/Bluetooth
              wedge path is always live via useBarcodeScanner regardless. */}
          {cameraSupported ? (
            <Button
              size="icon"
              variant="outline"
              className="size-12 shrink-0"
              onClick={() => setCameraOpen(true)}
              aria-label={t('pos.scanOrSearch')}
            >
              <Camera className="size-5" />
            </Button>
          ) : (
            <Badge variant="outline" className="hidden shrink-0 gap-1.5 sm:flex">
              <Barcode className="size-3.5" aria-hidden />
              {t('pos.scannerReady')}
            </Badge>
          )}

          {/* A shortcut nobody knows about is not a shortcut. */}
          <kbd className="hidden shrink-0 rounded border border-hairline-strong bg-overlay-subtle px-2 py-1 font-mono text-[10px] text-muted-foreground xl:inline-block">
            F2 · {t('pos.newSale')}
          </kbd>
        </header>

        {/* Category pills. Horizontally scrollable rather than wrapping: a
            wrapping row silently steals vertical space from the product grid as
            the catalogue grows. */}
        {!!categories.data?.length && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-hairline px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryPill
              label={t('common.all')}
              active={categoryId === null}
              onClick={() => setCategoryId(null)}
            />
            {categories.data.map((category) => (
              <CategoryPill
                key={category.id}
                label={localized(locale, category.name, category.name_my)}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              />
            ))}
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))
              : visibleProducts.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    locale={locale}
                    money={money}
                    outOfStockLabel={t('pos.outOfStock')}
                    onSelect={() => cart.addProduct(product)}
                  />
                ))}
          </div>

          {!products.isLoading && !visibleProducts.length && (
            <p className="py-16 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
          )}
        </ScrollArea>
      </section>

      {/* ── Cart — 35%, clamped ────────────────────────────────────────
          35% of a 2560px display is a 900px-wide cart, which is absurd; 35% of a
          1280px laptop is 448px, which is right. The clamp keeps the ratio where
          it makes sense and pins it where it does not. */}
      <aside className="hidden shrink-0 flex-col bg-card lg:flex lg:w-[35%] lg:min-w-[340px] lg:max-w-[460px]">
        <CartPanel onCharge={() => setPayOpen(true)} money={money} />
      </aside>

      {/* ── Cart: bottom bar + sheet on mobile ─────────────────────────── */}
      <div className="border-t border-hairline bg-background p-3 pb-safe-b-sm lg:hidden">
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="h-14 w-full justify-between text-base" disabled={!totals.itemCount}>
              <span className="flex items-center gap-2">
                <ShoppingCart className="size-5" />
                {t('pos.cart')}
                {totals.itemCount > 0 && (
                  <Badge variant="secondary" className="tabular-nums">
                    {formatNumber(totals.itemCount, 0, locale)}
                  </Badge>
                )}
              </span>
              <span className="tabular-nums font-semibold">{money(totals.total)}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85dvh] p-0">
            <SheetHeader className="border-b border-hairline px-4 py-3">
              <SheetTitle>{t('pos.cart')}</SheetTitle>
            </SheetHeader>
            <CartPanel onCharge={() => setPayOpen(true)} money={money} />
          </SheetContent>
        </Sheet>
      </div>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={totals.total}
        money={money}
        submitting={checkout.isPending}
        onConfirm={onCompleteSale}
      />

      <CameraScanner
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onScan={handleScan}
        continuous
      />

      <ReceiptDialog invoice={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

/* ── Category pill ────────────────────────────────────────────────────── */

function CategoryPill({
  label, active, onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/15 font-medium text-primary'
          : 'border-hairline-strong text-muted-foreground hover:bg-overlay-hover hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

/* ── Product tile ─────────────────────────────────────────────────────── */

function ProductTile({
  product, locale, money, onSelect, outOfStockLabel,
}: {
  product: ProductView
  locale: 'en' | 'my'
  money: (v: number) => string
  onSelect: () => void
  outOfStockLabel: string
}) {
  const soldOut = product.track_inventory && product.stock_on_hand <= 0
  const name = localized(locale, product.name, product.name_my)

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={soldOut}
      className={cn(
        'flex min-h-24 flex-col justify-between rounded-xl border border-hairline bg-card p-3 text-left',
        'transition-all duration-150 hover:border-primary/50 hover:bg-overlay-hover',
        // A press that visibly compresses is the fastest confirmation a cashier
        // can get that the tap registered, on a screen they are not looking at.
        'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
      )}
    >
      <span className="line-clamp-2 text-sm font-medium leading-snug">{name}</span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{money(product.selling_price)}</span>
        {product.track_inventory && (
          <Badge
            variant={soldOut ? 'danger' : product.is_low_stock ? 'warning' : 'success'}
            className="shrink-0 tabular-nums text-[10px]"
          >
            {soldOut ? outOfStockLabel : product.stock_on_hand}
          </Badge>
        )}
      </span>
    </button>
  )
}

/* ── Cart panel (shared by the desktop column and the mobile sheet) ───── */

function CartPanel({ onCharge, money }: { onCharge: () => void; money: (v: number) => string }) {
  const { t, locale } = useI18n()
  const cart = useCartStore()
  // See PosTerminal: derive totals during render, never through a selector.
  const totals = cart.totals()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-hairline p-3">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <User className="size-4" />
          {cart.contactName ?? t('pos.walkIn')}
        </Button>
        {cart.lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={cart.clear} className="gap-1.5 text-muted-foreground">
            <Trash2 className="size-4" />
            {t('pos.clear')}
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {cart.lines.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">{t('pos.emptyCart')}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {cart.lines.map((line) => (
              <li key={line.lineId} className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {money(line.unitPrice)} × {formatNumber(line.quantity, 0, locale)} {line.unit}
                  </p>
                </div>

                {/* 44px touch targets — usable with a thumb on a 5" screen. */}
                <div className="flex items-center gap-1">
                  <Button
                    size="icon" variant="outline" className="size-9"
                    onClick={() => cart.setQuantity(line.lineId, line.quantity - 1)}
                    aria-label="-1"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium tabular-nums">{line.quantity}</span>
                  <Button
                    size="icon" variant="outline" className="size-9"
                    onClick={() => cart.setQuantity(line.lineId, line.quantity + 1)}
                    aria-label="+1"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {money(Math.max(line.quantity * line.unitPrice - line.discount, 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="space-y-2 border-t border-hairline p-3">
        <CurrencyRow />
        <Row label={t('pos.subtotal')} value={money(totals.subtotal)} />

        {/* The store has always carried an invoice-level discount and checkout
            has always sent it — there was simply no way to enter one. */}
        <div className="flex items-center justify-between gap-2 text-sm">
          <label htmlFor="pos-discount" className="text-muted-foreground">
            {t('pos.discount')}
          </label>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">−</span>
            <Input
              id="pos-discount"
              type="number"
              inputMode="numeric"
              min={0}
              value={cart.orderDiscount || ''}
              onChange={(e) => cart.setOrderDiscount(Number(e.target.value) || 0)}
              placeholder="0"
              className="h-8 w-24 px-2 text-right text-sm tabular-nums"
              disabled={!cart.lines.length}
            />
          </div>
        </div>

        {totals.tax > 0 && <Row label={t('pos.tax')} value={money(totals.tax)} />}
        <Separator />
        <div className="flex items-center justify-between text-base font-semibold">
          <span>{t('pos.total')}</span>
          <span className="text-lg tabular-nums">{money(totals.total)}</span>
        </div>

        <Button size="lg" className="h-14 w-full text-base" disabled={!cart.lines.length} onClick={onCharge}>
          {t('pos.charge')} · {money(totals.total)}
        </Button>
      </div>
    </div>
  )
}

/**
 * Foreign-currency sales.
 *
 * Only rendered once the owner has actually set a rate (Settings → Exchange
 * rates), because selling in a currency with no rate would post the sale into
 * the books at 1:1 and quietly corrupt the P&L. Prices stay in the base
 * currency; the rate converts the total for the books via `amount_base`.
 */
function CurrencyRow() {
  const { tenant } = useSession()
  const { locale } = useI18n()
  const cart = useCartStore()
  const rates = useExchangeRates()

  const available = rates.data ?? []
  if (!available.length) return null

  const options: { code: CurrencyCode; rate: number }[] = [
    { code: tenant.base_currency, rate: 1 },
    ...available.map((row) => ({ code: row.quote_code, rate: Number(row.rate) })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-1">
      {options.map((option) => {
        const active = cart.currency === option.code
        return (
          <Button
            key={option.code}
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
            className="h-8 px-2 text-xs"
            onClick={() => cart.setCurrency(option.code, option.rate)}
          >
            {option.code}
          </Button>
        )
      })}
      {cart.currency !== tenant.base_currency && (
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          1 {cart.currency} = {formatNumber(cart.exchangeRate, 0, locale)} {tenant.base_currency}
        </span>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

/* ── Payment dialog ───────────────────────────────────────────────────── */

function PaymentDialog({
  open, onOpenChange, total, money, submitting, onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  money: (v: number) => string
  submitting: boolean
  onConfirm: (paid: number, method: PaymentMethod) => void
}) {
  const { t, locale } = useI18n()
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [received, setReceived] = useState<number>(0)

  useEffect(() => {
    if (open) setReceived(total)
  }, [open, total])

  const change = Math.max(received - total, 0)
  const canConfirm = !submitting && !(method === 'cash' && received < total)

  // Enter confirms. `allowWhileTyping` is deliberate here and nowhere else: the
  // caret is normally sitting in the amount-received box, and the whole point is
  // to type a number and commit without reaching for the mouse.
  useKeyShortcut(
    'Enter',
    () => onConfirm(method === 'credit' ? 0 : Math.min(received, total), method),
    { allowWhileTyping: true, enabled: open && canConfirm },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pos.charge')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('pos.total')}</p>
            <p className="text-3xl font-bold tabular-nums">{money(total)}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t('pos.paymentMethod')}</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Button
                  key={m.value}
                  type="button"
                  variant={method === m.value ? 'default' : 'outline'}
                  className="h-11"
                  onClick={() => setMethod(m.value)}
                >
                  {locale === 'my' ? m.labelMy : m.labelEn}
                </Button>
              ))}
            </div>
          </div>

          {method === 'cash' && (
            <div>
              <p className="mb-2 text-sm font-medium">{t('pos.amountReceived')}</p>
              <Input
                type="number"
                inputMode="numeric"
                value={received || ''}
                onChange={(e) => setReceived(Number(e.target.value))}
                className="h-12 text-right text-lg tabular-nums"
              />
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {QUICK_CASH.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs tabular-nums"
                    onClick={() => setReceived((prev) => prev + amount)}
                  >
                    +{amount / 1000}k
                  </Button>
                ))}
              </div>
              {change > 0 && (
                <p className="mt-3 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950">
                  <span>{t('pos.change')}</span>
                  <span className="font-semibold tabular-nums">{money(change)}</span>
                </p>
              )}
            </div>
          )}

          <Button
            size="lg"
            className="h-14 w-full gap-2 text-base"
            disabled={!canConfirm}
            onClick={() => onConfirm(method === 'credit' ? 0 : Math.min(received, total), method)}
          >
            {submitting ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
            {t('pos.completeSale')}
            <kbd className="ml-auto hidden rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              Enter
            </kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Receipt ──────────────────────────────────────────────────────────── */

function ReceiptDialog({ invoice, onClose }: { invoice: InvoiceRow | null; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto p-0">
        <DialogHeader className="flex-row items-center justify-between border-b border-hairline px-4 py-3 print:hidden">
          <DialogTitle className="text-base">{t('pos.saleComplete')}</DialogTitle>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </DialogHeader>

        {invoice && <InvoiceDocument invoiceId={invoice.id} format="receipt" />}

        <div className="flex gap-2 border-t border-hairline p-3 print:hidden">
          <Button variant="outline" className="h-12 flex-1 gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t('pos.printReceipt')}
          </Button>
          <Button className="h-12 flex-1" onClick={onClose}>
            {t('pos.newSale')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
