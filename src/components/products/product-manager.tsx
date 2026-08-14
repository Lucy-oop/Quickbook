'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Package, Plus, Search, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import {
  useProducts, useProductCategories, useCreateProductCategory, useDefaultWarehouseId, useWarehouses,
} from '@/hooks/use-products'
import { Combobox } from '@/components/ui/combobox'
import { usePermission } from '@/hooks/use-permission'
import { useSession } from '@/components/providers/session-provider'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { useSearchShortcut, useShortcutKey } from '@/hooks/use-shortcut'
import { CustomFieldsForm } from '@/components/custom-fields/custom-fields-form'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney, formatNumber } from '@/lib/format'
import { friendlyDbError } from '@/lib/utils'
import type { CustomFieldValues, ProductView, StockMoveKind } from '@/types'

export function ProductManager({
  initialSearch = '',
  initialLowStockOnly = false,
}: {
  initialSearch?: string
  initialLowStockOnly?: boolean
} = {}) {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()

  const [search, setSearch] = useState(initialSearch)
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStockOnly)
  const [editing, setEditing] = useState<ProductView | 'new' | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const shortcutKey = useShortcutKey()
  useSearchShortcut(searchRef)

  const products = useProducts(search)
  const money = (value: number) => formatMoney(value, { currency: tenant.base_currency, locale })

  // `is_low_stock` is computed by v_products against the product's own reorder
  // level, so the toggle agrees with the dashboard card without a second query.
  const visibleProducts = lowStockOnly
    ? (products.data ?? []).filter((p) => p.is_low_stock)
    : products.data ?? []

  // A scan anywhere on this screen jumps straight to that product's editor.
  useBarcodeScanner({
    enabled: can('products.manage'),
    onScan: (code) => {
      const match = products.data?.find((p) => p.barcode === code)
      if (match) setEditing(match)
      else setSearch(code)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('nav.products')}</h1>
          <p className="text-sm text-muted-foreground">
            {products.data ? `${visibleProducts.length} items` : ''}
          </p>
        </div>
        {can('products.manage') && (
          <Button className="gap-2" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            ပစ္စည်းအသစ်
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('pos.scanOrSearch')}
          className="h-12 pl-9 pr-24"
          inputMode="search"
        />
        {/* The hint hides once typing starts, so it never sits on top of text. */}
        <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {!search && (
            <kbd className="hidden items-center gap-0.5 rounded border border-hairline-strong bg-overlay-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              {shortcutKey}K
            </kbd>
          )}
          <ScanLine className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      {/* Toggle, not a fixed view: arriving from the dashboard's low-stock card
          pre-enables it, and it can be switched off without navigating away. */}
      <Button
        type="button"
        size="sm"
        variant={lowStockOnly ? 'default' : 'outline'}
        onClick={() => setLowStockOnly((v) => !v)}
        aria-pressed={lowStockOnly}
        className="gap-1.5"
      >
        <AlertTriangle className="size-3.5" />
        {t('dashboard.lowStock')}
        {!!products.data && ` (${products.data.filter((p) => p.is_low_stock).length})`}
      </Button>

      {products.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !visibleProducts.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Package className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {lowStockOnly ? t('empty.noStock') : t('common.noData')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => can('products.manage') && setEditing(product)}
                className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-accent disabled:cursor-default"
                disabled={!can('products.manage')}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Package className="size-5 text-muted-foreground" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {localized(locale, product.name, product.name_my)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {product.sku ?? product.barcode ?? product.category_name ?? '—'}
                  </span>

                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{money(product.selling_price)}</span>
                    {/* cost_price is null unless this role holds products.read_cost */}
                    {product.cost_price !== null && product.cost_price !== undefined && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        cost {money(product.cost_price)}
                      </span>
                    )}
                  </span>

                  {Object.keys(product.custom_fields ?? {}).length > 0 && (
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                      {Object.entries(product.custom_fields)
                        .slice(0, 2)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' · ')}
                    </span>
                  )}
                </span>

                {product.track_inventory && (
                  <Badge
                    variant={
                      product.stock_on_hand <= 0 ? 'danger' : product.is_low_stock ? 'warning' : 'success'
                    }
                    className="shrink-0 gap-1 tabular-nums"
                  >
                    {product.is_low_stock && <AlertTriangle className="size-3" aria-hidden />}
                    {formatNumber(product.stock_on_hand, 0, locale)}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/* ── Editor ───────────────────────────────────────────────────────────── */

function ProductEditor({ product, onClose }: { product: ProductView | null; onClose: () => void }) {
  const { locale } = useI18n()
  const { tenant, user } = useSession()
  const { can } = usePermission()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const categories = useProductCategories()

  const [name, setName] = useState(product?.name ?? '')
  const [nameMy, setNameMy] = useState(product?.name_my ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [unit, setUnit] = useState(product?.unit ?? 'pcs')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '')
  const [sellingPrice, setSellingPrice] = useState(String(product?.selling_price ?? ''))
  const [costPrice, setCostPrice] = useState(String(product?.cost_price ?? ''))
  const [trackInventory, setTrackInventory] = useState(product?.track_inventory ?? true)
  const [reorderLevel, setReorderLevel] = useState(String(product?.reorder_level ?? 0))
  const [customFields, setCustomFields] = useState<CustomFieldValues>(product?.custom_fields ?? {})
  // Stock on hand. Without this a tracked product is created at zero and the
  // POS tile stays disabled, with no hint that stock is what's missing.
  const [stockQty, setStockQty] = useState(String(product?.stock_on_hand ?? 0))
  const [newCategory, setNewCategory] = useState('')

  const createCategory = useCreateProductCategory()
  const defaultWarehouseId = useDefaultWarehouseId()
  const canEditCost = can('products.read_cost')
  const startingQty = Number(product?.stock_on_hand ?? 0)
  const stockDelta = (Number(stockQty) || 0) - startingQty

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenant.id,
        name: name.trim(),
        name_my: nameMy.trim() || null,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        unit,
        category_id: categoryId || null,
        selling_price: Number(sellingPrice) || 0,
        // Never send cost_price for a role that cannot read it — otherwise a
        // blank field would silently zero out the real cost.
        ...(canEditCost ? { cost_price: Number(costPrice) || 0 } : {}),
        track_inventory: trackInventory,
        reorder_level: Number(reorderLevel) || 0,
        custom_fields: customFields,
      }

      // ── New product: one RPC, one transaction ────────────────────────
      // Creating the row and posting its opening stock used to be two separate
      // statements. Anything failing between them (no warehouse, an RLS refusal)
      // left a tracked product with no opening balance — and then every sale
      // drove it negative, which is how the low-stock widget filled up with
      // items at -3 and -20.
      if (!product) {
        const { data: newId, error } = await supabase.rpc('create_product_with_stock', {
          p_tenant_id: tenant.id,
          p_product: payload as never,
          p_quantity: trackInventory ? Number(stockQty) || 0 : 0,
          p_warehouse_id: defaultWarehouseId,
          p_unit_cost: Number(costPrice) || 0,
        })
        if (error) throw error
        return newId
      }

      // ── Existing product: update, then reconcile the count ───────────
      const { error } = await supabase.from('products').update(payload).eq('id', product.id)
      if (error) throw error

      // Stock is a ledger, not a column: reconcile by posting the difference as
      // a movement so the change is auditable and avg_cost stays correct. An
      // edit that leaves the quantity alone posts nothing.
      if (trackInventory && stockDelta !== 0) {
        // Resolved against the active tenant, never from a raw cached list.
        if (!defaultWarehouseId) throw new Error('No warehouse configured')

        const { error: moveError } = await supabase.from('stock_movements').insert({
          tenant_id: tenant.id,
          product_id: product.id,
          warehouse_id: defaultWarehouseId,
          // Changing an existing count is a correction, not a receipt, and the
          // two read very differently in the movement history.
          kind: 'adjustment' as StockMoveKind,
          quantity: stockDelta,
          unit_cost: stockDelta > 0 ? Number(costPrice) || 0 : 0,
          reference_type: 'manual',
          notes: 'Stock corrected from product form',
          created_by: user.id,
        })
        if (moveError) throw moveError
      }

      return product.id
    },
    onSuccess: () => {
      toast.success('သိမ်းပြီးပါပြီ')
      queryClient.invalidateQueries({ queryKey: qk.products(tenant.id) })
      queryClient.invalidateQueries({ queryKey: qk.lowStock(tenant.id) })
      onClose()
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'ပစ္စည်းပြင်ဆင်ရန်' : 'ပစ္စည်းအသစ်ထည့်ရန်'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="p-name">အမည် / Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" autoFocus />
          </div>

          <div>
            <Label htmlFor="p-name-my">အမည် (မြန်မာ)</Label>
            <Input id="p-name-my" value={nameMy} onChange={(e) => setNameMy(e.target.value)} className="h-11" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} className="h-11 font-mono" />
            </div>
            <div>
              <Label htmlFor="p-barcode">ဘားကုဒ်</Label>
              <Input
                id="p-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                data-scanner-passthrough="true"
                inputMode="numeric"
                className="h-11 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-price">ရောင်းဈေး</Label>
              <Input
                id="p-price"
                type="number"
                inputMode="decimal"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="h-11 text-right tabular-nums"
              />
            </div>
            {canEditCost && (
              <div>
                <Label htmlFor="p-cost">အရင်းဈေး</Label>
                <Input
                  id="p-cost"
                  type="number"
                  inputMode="decimal"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="h-11 text-right tabular-nums"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-unit">ယူနစ်</Label>
              <Input
                id="p-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs"
                list="p-unit-options"
                className="h-11"
              />
              {/* Names the measure, not the count — people type "100 pcs" here
                  when there is nowhere else to record how many they have. */}
              <datalist id="p-unit-options">
                {['pcs', 'pack', 'box', 'dozen', 'kg', 'g', 'litre', 'set', 'pair'].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-muted-foreground">တစ်ခုချင်းအတိုင်းအတာ (ဥပမာ pcs)</p>
            </div>
            <div>
              <Label htmlFor="p-category">အမျိုးအစား</Label>
              <Combobox
                id="p-category"
                options={(categories.data ?? []).map((c) => ({
                  value: c.id,
                  label: localized(locale, c.name, c.name_my),
                }))}
                value={categoryId || null}
                onChange={(id) => setCategoryId(id ?? '')}
                placeholder="—"
                searchPlaceholder="အမျိုးအစားရှာပါ"
                emptyText="အမျိုးအစားမရှိသေးပါ"
                footer={
                  <div className="flex gap-1.5 p-1">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="အမျိုးအစားအသစ်"
                      className="h-9"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-9 shrink-0 gap-1"
                      disabled={!newCategory.trim() || createCategory.isPending}
                      onClick={async () => {
                        try {
                          const created = await createCategory.mutateAsync(newCategory)
                          setCategoryId(created.id)
                          setNewCategory('')
                          toast.success(created.name)
                        } catch (error) { toast.error(friendlyDbError(error)) }
                      }}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">ကုန်လက်ကျန်စောင့်ကြည့်မည်</p>
                <p className="text-xs text-muted-foreground">Services and dishes usually do not need this.</p>
              </div>
              <Switch checked={trackInventory} onCheckedChange={setTrackInventory} />
            </div>

            {trackInventory && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-stock">လက်ရှိကုန်လက်ကျန် / Stock on hand</Label>
                  <Input
                    id="p-stock"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="h-11 text-right tabular-nums"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stockDelta === 0
                      ? `${formatNumber(startingQty, 0, locale)} ${unit}`
                      : stockDelta > 0
                        ? `+${formatNumber(stockDelta, 0, locale)} ${unit} ကုန်ဝင်မှတ်မည်`
                        : `${formatNumber(stockDelta, 0, locale)} ${unit} ပြင်ဆင်မည်`}
                  </p>
                </div>

                <div>
                  <Label htmlFor="p-reorder">ကုန်နီးသတိပေးအရေအတွက်</Label>
                  <Input
                    id="p-reorder"
                    type="number"
                    inputMode="numeric"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="h-11 text-right tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>

          {/* The tenant's own product fields — IMEI, expiry date, whatever. */}
          <CustomFieldsForm entity="product" values={customFields} onChange={setCustomFields} />

          <Button
            size="lg"
            className="h-12 w-full"
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            သိမ်းမည်
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
