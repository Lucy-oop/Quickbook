'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, Camera, Loader2, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useProducts, useWarehouses } from '@/hooks/use-products'
import { useLowStock } from '@/hooks/use-dashboard'
import { usePermission } from '@/hooks/use-permission'
import { useSession } from '@/components/providers/session-provider'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { CameraScanner, useCameraScanSupported } from '@/components/pos/camera-scanner'
import { TransferDialog } from '@/components/inventory/transfer-dialog'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney, formatNumber } from '@/lib/format'
import { friendlyDbError } from '@/lib/utils'
import type { ProductView, StockMoveKind } from '@/types'

export function InventoryManager({ initialAction }: { initialAction?: 'in' | 'out' }) {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()

  const [tab, setTab] = useState<'stock' | 'low'>('stock')
  const [search, setSearch] = useState('')
  const [moving, setMoving] = useState<{ product: ProductView; kind: 'in' | 'out' } | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [transferring, setTransferring] = useState<ProductView | null>(null)
  const cameraSupported = useCameraScanSupported()

  const products = useProducts(search)
  const lowStock = useLowStock()
  const warehouses = useWarehouses()

  // Transfers only make sense once there is somewhere to transfer to.
  const multiLocation = (warehouses.data?.length ?? 0) > 1

  const handleScan = (code: string) => {
    const match = products.data?.find((p) => p.barcode === code)
    if (match) setMoving({ product: match, kind: initialAction ?? 'in' })
    else setSearch(code)
  }

  useBarcodeScanner({ enabled: can('inventory.adjust'), onScan: handleScan })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.inventory')}</h1>
        <p className="text-sm text-muted-foreground">ကုန်ဝင်/ကုန်ထွက် မှတ်တမ်းတင်ပါ</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stock">လက်ကျန်</TabsTrigger>
          <TabsTrigger value="low" className="gap-1.5">
            ကုန်နီး
            {!!lowStock.data?.length && (
              <Badge variant="destructive" className="text-[10px]">{lowStock.data.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'stock' ? (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('pos.scanOrSearch')}
                className="h-12 pl-9"
                inputMode="search"
              />
            </div>
            {cameraSupported && can('inventory.adjust') && (
              <Button
                size="icon"
                variant="outline"
                className="size-12 shrink-0"
                onClick={() => setCameraOpen(true)}
                aria-label={t('pos.scanOrSearch')}
              >
                <Camera className="size-5" />
              </Button>
            )}
          </div>

          {products.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {(products.data ?? []).filter((p) => p.track_inventory).map((product) => (
                <li key={product.id} className="flex items-center gap-3 p-3 sm:px-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {localized(locale, product.name, product.name_my)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {product.sku ?? product.barcode ?? '—'}
                    </p>
                  </div>

                  <Badge
                    variant={product.stock_on_hand <= 0 ? 'destructive' : product.is_low_stock ? 'outline' : 'secondary'}
                    className="shrink-0 tabular-nums"
                  >
                    {formatNumber(product.stock_on_hand, 0, locale)} {product.unit}
                  </Badge>

                  {can('inventory.adjust') && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon" variant="outline" className="size-9"
                        aria-label="Stock in"
                        onClick={() => setMoving({ product, kind: 'in' })}
                      >
                        <ArrowDownToLine className="size-4" />
                      </Button>
                      <Button
                        size="icon" variant="outline" className="size-9"
                        aria-label="Stock out"
                        onClick={() => setMoving({ product, kind: 'out' })}
                      >
                        <ArrowUpFromLine className="size-4" />
                      </Button>
                      {multiLocation && (
                        <Button
                          size="icon" variant="outline" className="size-9"
                          aria-label="Transfer between warehouses"
                          onClick={() => setTransferring(product)}
                        >
                          <ArrowLeftRight className="size-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              {t('dashboard.lowStock')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!lowStock.data?.length ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
            ) : (
              <ul className="divide-y">
                {lowStock.data.map((item) => (
                  // One row per product now that v_low_stock sums across
                  // warehouses; there is no per-warehouse breakdown to show here.
                  // Which branch is short is a stock-by-location question, and it
                  // belongs in the report above, not in an alert list.
                  <li key={item.product_id} className="flex items-center gap-3 p-3 sm:px-4">
                    <Boxes className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {localized(locale, item.name, item.name_my)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.sku ?? item.barcode ?? '—'}
                      </p>
                    </div>
                    <Badge variant={item.quantity <= 0 ? 'danger' : 'warning'} className="tabular-nums">
                      {formatNumber(item.quantity, 0, locale)} / {formatNumber(item.reorder_level, 0, locale)} {item.unit}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <CameraScanner open={cameraOpen} onOpenChange={setCameraOpen} onScan={handleScan} />

      {transferring && (
        <TransferDialog product={transferring} onClose={() => setTransferring(null)} />
      )}

      {moving && (
        <StockMovementDialog
          product={moving.product}
          kind={moving.kind}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  )
}

function StockMovementDialog({
  product, kind, onClose,
}: {
  product: ProductView
  kind: 'in' | 'out'
  onClose: () => void
}) {
  const { locale } = useI18n()
  const { tenant, user } = useSession()
  const { can } = usePermission()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const warehouses = useWarehouses()

  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState(String(product.cost_price ?? ''))
  const [warehouseId, setWarehouseId] = useState('')
  const [notes, setNotes] = useState('')

  const move = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity)
      if (!qty || qty <= 0) throw new Error('Enter a quantity greater than zero.')

      const targetWarehouse = warehouseId || warehouses.data?.[0]?.id
      if (!targetWarehouse) throw new Error('No warehouse available.')

      // The ledger is append-only and signed: `in` is positive, `out` negative.
      // The stock_levels table is maintained by a trigger, never written here.
      const { error } = await supabase.from('stock_movements').insert({
        tenant_id: tenant.id,
        product_id: product.id,
        warehouse_id: targetWarehouse,
        kind: (kind === 'in' ? 'in' : 'out') as StockMoveKind,
        quantity: kind === 'in' ? qty : -qty,
        unit_cost: kind === 'in' ? Number(unitCost) || 0 : 0,
        reference_type: 'manual',
        notes: notes || null,
        created_by: user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(kind === 'in' ? 'ကုန်ဝင် မှတ်တမ်းတင်ပြီး' : 'ကုန်ထွက် မှတ်တမ်းတင်ပြီး')
      queryClient.invalidateQueries({ queryKey: qk.products(tenant.id) })
      queryClient.invalidateQueries({ queryKey: qk.lowStock(tenant.id) })
      onClose()
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {kind === 'in' ? 'ကုန်ဝင်' : 'ကုန်ထွက်'} — {localized(locale, product.name, product.name_my)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            လက်ကျန် <span className="font-semibold tabular-nums">
              {formatNumber(product.stock_on_hand, 0, locale)} {product.unit}
            </span>
          </p>

          <div>
            <Label htmlFor="sm-qty">အရေအတွက်</Label>
            <Input
              id="sm-qty"
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-12 text-right text-lg tabular-nums"
              autoFocus
            />
          </div>

          {kind === 'in' && can('products.read_cost') && (
            <div>
              <Label htmlFor="sm-cost">အရင်းဈေး (တစ်ခုချင်း)</Label>
              <Input
                id="sm-cost"
                type="number"
                inputMode="decimal"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="h-11 text-right tabular-nums"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Feeds the weighted-average cost used for gross margin.
              </p>
            </div>
          )}

          {(warehouses.data?.length ?? 0) > 1 && (
            <div>
              <Label>ဂိုဒေါင်</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={warehouses.data?.[0]?.name} />
                </SelectTrigger>
                <SelectContent>
                  {(warehouses.data ?? []).map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {localized(locale, warehouse.name, warehouse.name_my)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="sm-notes">မှတ်ချက်</Label>
            <Input id="sm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
          </div>

          <Button
            size="lg"
            className="h-12 w-full"
            disabled={move.isPending}
            onClick={() => move.mutate()}
          >
            {move.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            မှတ်တမ်းတင်မည်
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
