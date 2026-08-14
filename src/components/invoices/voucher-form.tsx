'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Minus, Plus, Printer, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProducts, useWarehouses } from '@/hooks/use-products'
import { useContacts, useCreateContact } from '@/hooks/use-contacts'
import { useCheckout } from '@/hooks/use-checkout'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney, toISODate } from '@/lib/format'
import { InvoiceDocument } from '@/components/invoice/invoice-document'
import type { CartLine, InvoiceRow, PaymentMethod, ProductView } from '@/types'

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'ငွေသား / Cash' },
  { value: 'kbz_pay', label: 'KBZPay' },
  { value: 'wave_pay', label: 'WavePay' },
  { value: 'aya_pay', label: 'AYA Pay' },
  { value: 'bank_transfer', label: 'ဘဏ် / Bank' },
  { value: 'credit', label: 'အကြွေး / Credit' },
]

let seq = 0
const newLineId = () => `vl_${++seq}`

const blankLine = (): CartLine => ({
  lineId: newLineId(),
  productId: null,
  name: '',
  sku: null,
  unit: 'pcs',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 0,
  customFields: {},
})

/** Parses a currency field that may contain grouping separators. */
const num = (value: string): number => {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Manual sales voucher.
 *
 * Deliberately reuses the POS checkout pipeline (draft insert → post_invoice)
 * rather than writing invoices a second way: post_invoice is what assigns the
 * document number, deducts stock, and writes the ledger entry, all in one
 * transaction. A parallel write path would drift from it.
 */
export function VoucherForm({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const products = useProducts('')
  const warehouses = useWarehouses()
  const customers = useContacts('customer')
  const createContact = useCreateContact()
  const checkout = useCheckout()

  const [contactId, setContactId] = useState<string | null>(null)
  const [issueDate, setIssueDate] = useState(() => toISODate())
  const [lines, setLines] = useState<CartLine[]>([blankLine()])
  const [discountMode, setDiscountMode] = useState<'fixed' | 'percent'>('fixed')
  const [discountInput, setDiscountInput] = useState('')
  const [shippingInput, setShippingInput] = useState('')
  const [paidInput, setPaidInput] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [posted, setPosted] = useState<InvoiceRow | null>(null)
  const [quickName, setQuickName] = useState('')

  const currency = tenant.base_currency
  const money = (v: number) => formatMoney(v, { currency, locale })

  useEffect(() => {
    if (!warehouseId && warehouses.data?.length) setWarehouseId(warehouses.data[0].id)
  }, [warehouses.data, warehouseId])

  // Reset when the dialog is dismissed so the next voucher starts clean.
  useEffect(() => {
    if (open) return
    setContactId(null); setIssueDate(toISODate()); setLines([blankLine()])
    setDiscountMode('fixed'); setDiscountInput(''); setShippingInput('')
    setPaidInput(''); setMethod('cash'); setPosted(null); setQuickName('')
  }, [open])

  const productOptions: ComboboxOption[] = useMemo(
    () => (products.data ?? []).map((p: ProductView) => ({
      value: p.id,
      label: localized(locale, p.name, p.name_my),
      hint: [p.sku, p.track_inventory ? `${p.stock_on_hand} ${p.unit}` : null].filter(Boolean).join(' · '),
      keywords: `${p.sku ?? ''} ${p.barcode ?? ''}`,
    })),
    [products.data, locale],
  )

  const customerOptions: ComboboxOption[] = useMemo(
    () => (customers.data ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.phone ?? undefined })),
    [customers.data],
  )

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + Math.max(l.quantity * l.unitPrice - l.discount, 0), 0)
    const tax = lines.reduce(
      (sum, l) => sum + Math.max(l.quantity * l.unitPrice - l.discount, 0) * (l.taxRate / 100), 0)
    const raw = num(discountInput)
    // A percentage discount is resolved against the subtotal here so the server
    // receives a fixed amount — post_invoice only understands an amount.
    const discount = discountMode === 'percent'
      ? Math.min(Math.max(raw, 0), 100) / 100 * subtotal
      : Math.max(raw, 0)
    const shipping = Math.max(num(shippingInput), 0)
    const total = Math.max(subtotal - discount + tax + shipping, 0)
    const paid = Math.max(num(paidInput), 0)
    return { subtotal, tax, discount, shipping, total, paid, balance: paid - total }
  }, [lines, discountInput, discountMode, shippingInput, paidInput])

  const filledLines = lines.filter((l) => l.productId && l.quantity > 0)
  const errors: string[] = []
  if (filledLines.length === 0) errors.push(t('voucher.errNoItems'))
  if (totals.discount > totals.subtotal) errors.push(t('voucher.errDiscountTooBig'))
  if (method === 'credit' && !contactId) errors.push(t('voucher.errCreditNeedsCustomer'))

  const setLine = (lineId: string, patch: Partial<CartLine>) =>
    setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)))

  const pickProduct = (lineId: string, productId: string | null) => {
    const product = (products.data ?? []).find((p) => p.id === productId)
    if (!product) { setLine(lineId, { productId: null, name: '', unitPrice: 0 }); return }
    setLine(lineId, {
      productId: product.id,
      name: localized(locale, product.name, product.name_my),
      sku: product.sku,
      unit: product.unit,
      unitPrice: Number(product.selling_price ?? 0),
      taxRate: Number(product.tax_rate ?? 0),
    })
  }

  const save = async () => {
    if (errors.length) { toast.error(errors[0]); return }
    try {
      const invoice = await checkout.mutateAsync({
        kind: 'sales',
        contactId,
        warehouseId,
        currency,
        exchangeRate: 1,
        method,
        paidAmount: totals.paid,
        orderDiscount: totals.discount,
        shipping: totals.shipping,
        issueDate,
        lines: filledLines,
        customFields: {},
      })
      setPosted(invoice)
      toast.success(t('voucher.saved'), { description: invoice.number ?? undefined })
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  // ── After posting: show the printable document ──────────────────────────
  if (posted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="p-4 pb-0 print:hidden">
            <DialogTitle>{t('voucher.saved')} · {posted.number}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <InvoiceDocument invoiceId={posted.id} />
          </ScrollArea>
          <div className="flex gap-2 border-t p-3 print:hidden">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={() => window.print()}>
              <Printer className="size-4" /> {t('invoice.print')}
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Dialog gives Esc-to-close and a blurred backdrop; see dialog.tsx. */}
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t('voucher.title')}
            {/* post_invoice() assigns the number at issue time so abandoned
                drafts burn none — there is nothing truthful to show until then. */}
            <Badge variant="outline" className="font-normal">{t('voucher.numberAuto')}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-8.5rem)]">
          <div className="space-y-4 p-4">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-customer">{t('voucher.customer')}</Label>
                <Combobox
                  id="v-customer"
                  options={customerOptions}
                  value={contactId}
                  onChange={setContactId}
                  placeholder={t('pos.walkIn')}
                  searchPlaceholder={t('voucher.searchCustomer')}
                  emptyText={t('common.noData')}
                  footer={
                    <div className="flex gap-1.5 p-1">
                      <Input
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder={t('voucher.newCustomerName')}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-9 shrink-0 gap-1"
                        disabled={!quickName.trim() || createContact.isPending}
                        onClick={async () => {
                          try {
                            const created = await createContact.mutateAsync({ name: quickName, kind: 'customer' })
                            setContactId(created.id)
                            setQuickName('')
                            toast.success(created.name)
                          } catch (error) { toast.error((error as Error).message) }
                        }}
                      >
                        <UserPlus className="size-3.5" />
                      </Button>
                    </div>
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v-date">{t('voucher.date')}</Label>
                {/* Native date input: no extra dependency, and it gives phones
                    the OS picker, which matters more than a custom calendar. */}
                <Input
                  id="v-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v-warehouse">{t('voucher.warehouse')}</Label>
                <Select value={warehouseId ?? ''} onValueChange={setWarehouseId}>
                  <SelectTrigger id="v-warehouse" className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(warehouses.data ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Separator />

            {/* ── Line items ─────────────────────────────────────────────── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{t('voucher.items')}</h3>
                <Button type="button" size="sm" variant="outline" className="gap-1.5"
                        onClick={() => setLines((p) => [...p, blankLine()])}>
                  <Plus className="size-3.5" /> {t('voucher.addRow')}
                </Button>
              </div>

              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.lineId}
                       className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_auto_9rem_7rem_auto] sm:items-end">
                    <div className="min-w-0 space-y-1.5">
                      <Label className="sm:sr-only">{t('voucher.item')}</Label>
                      <Combobox
                        options={productOptions}
                        value={line.productId}
                        onChange={(id) => pickProduct(line.lineId, id)}
                        placeholder={t('voucher.selectItem')}
                        searchPlaceholder={t('pos.scanOrSearch')}
                        emptyText={t('common.noData')}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="sm:sr-only">{t('pos.qty')}</Label>
                      <div className="flex items-center">
                        <Button type="button" size="icon" variant="outline" className="size-11 rounded-r-none"
                                aria-label="−"
                                onClick={() => setLine(line.lineId, { quantity: Math.max(line.quantity - 1, 1) })}>
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          type="number" inputMode="numeric" min={1} value={line.quantity}
                          onChange={(e) => setLine(line.lineId, { quantity: Math.max(num(e.target.value), 1) })}
                          className="h-11 w-14 rounded-none border-x-0 text-center tabular-nums"
                          aria-label={t('pos.qty')}
                        />
                        <Button type="button" size="icon" variant="outline" className="size-11 rounded-l-none"
                                aria-label="+"
                                onClick={() => setLine(line.lineId, { quantity: line.quantity + 1 })}>
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="sm:sr-only">{t('voucher.unitPrice')}</Label>
                      <Input
                        inputMode="decimal" value={line.unitPrice || ''}
                        onChange={(e) => setLine(line.lineId, { unitPrice: Math.max(num(e.target.value), 0) })}
                        className="h-11 text-right tabular-nums"
                        aria-label={t('voucher.unitPrice')}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="sm:sr-only">{t('voucher.lineTotal')}</Label>
                      <p className="flex h-11 items-center justify-end px-1 text-sm font-medium tabular-nums">
                        {money(Math.max(line.quantity * line.unitPrice - line.discount, 0))}
                      </p>
                    </div>

                    <Button type="button" size="icon" variant="ghost"
                            className="size-11 text-muted-foreground hover:text-destructive"
                            aria-label={t('common.delete')}
                            disabled={lines.length === 1}
                            onClick={() => setLines((p) => p.filter((l) => l.lineId !== line.lineId))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* ── Summary ────────────────────────────────────────────────── */}
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t('pos.discount')}</Label>
                  <div className="flex gap-2">
                    <Tabs value={discountMode} onValueChange={(v) => setDiscountMode(v as 'fixed' | 'percent')}>
                      <TabsList className="h-11">
                        <TabsTrigger value="fixed">{currency}</TabsTrigger>
                        <TabsTrigger value="percent">%</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Input inputMode="decimal" value={discountInput}
                           onChange={(e) => setDiscountInput(e.target.value)}
                           placeholder="0" className="h-11 flex-1 text-right tabular-nums" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="v-shipping">{t('voucher.shipping')}</Label>
                  <Input id="v-shipping" inputMode="decimal" value={shippingInput}
                         onChange={(e) => setShippingInput(e.target.value)}
                         placeholder="0" className="h-11 text-right tabular-nums" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="v-method">{t('pos.paymentMethod')}</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger id="v-method" className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="v-paid">{t('pos.amountReceived')}</Label>
                  <Input id="v-paid" inputMode="decimal" value={paidInput}
                         onChange={(e) => setPaidInput(e.target.value)}
                         placeholder="0" className="h-11 text-right text-lg tabular-nums" />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <Row label={t('pos.subtotal')} value={money(totals.subtotal)} />
                {totals.discount > 0 && <Row label={t('pos.discount')} value={`− ${money(totals.discount)}`} />}
                {totals.tax > 0 && <Row label={t('pos.tax')} value={money(totals.tax)} />}
                {totals.shipping > 0 && <Row label={t('voucher.shipping')} value={money(totals.shipping)} />}
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{t('pos.total')}</span>
                  <span className="text-2xl font-semibold tabular-nums">{money(totals.total)}</span>
                </div>
                <Separator />
                <Row label={t('pos.amountReceived')} value={money(totals.paid)} />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {totals.balance >= 0 ? t('pos.change') : t('voucher.due')}
                  </span>
                  <span className={`font-semibold tabular-nums ${totals.balance < 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                    {money(Math.abs(totals.balance))}
                  </span>
                </div>

                {errors.length > 0 && (
                  <p role="alert" className="pt-1 text-xs text-destructive">{errors[0]}</p>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="flex gap-2 border-t p-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1 gap-1.5" disabled={errors.length > 0 || checkout.isPending} onClick={save}>
            {checkout.isPending ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
            {t('voucher.saveAndPrint')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
