'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useWarehouses } from '@/hooks/use-products'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatNumber } from '@/lib/format'
import { friendlyDbError } from '@/lib/utils'
import type { ProductView } from '@/types'

/**
 * Move stock between warehouses.
 *
 * Written as a *pair* of ledger rows sharing a `transfer_group`: negative at
 * the source, positive at the destination. That keeps `stock_movements`
 * append-only and lets the trigger maintain both `stock_levels` rows without
 * any special-casing — a transfer is just two ordinary movements that happen
 * to net to zero.
 *
 * The destination row carries the source's weighted-average cost so moving
 * goods between shops does not change what they are worth on the books.
 */
export function TransferDialog({ product, onClose }: { product: ProductView; onClose: () => void }) {
  const { locale } = useI18n()
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const warehouses = useWarehouses()

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  // Per-warehouse quantities, so the form can refuse to move more than exists.
  const levels = useQuery({
    queryKey: ['stock-levels', tenant.id, product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_stock_levels')
        .select('warehouse_id,quantity,avg_cost')
        .eq('tenant_id', tenant.id)
        .eq('product_id', product.id)
      if (error) throw error
      return data ?? []
    },
  })

  const availableAt = (warehouseId: string) =>
    Number(levels.data?.find((row) => row.warehouse_id === warehouseId)?.quantity ?? 0)

  const costAt = (warehouseId: string) =>
    Number(levels.data?.find((row) => row.warehouse_id === warehouseId)?.avg_cost ?? 0)

  const transfer = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity)
      if (!qty || qty <= 0) throw new Error('Enter a quantity greater than zero.')
      if (!fromId || !toId) throw new Error('Choose both a source and a destination.')
      if (fromId === toId) throw new Error('Source and destination must be different.')
      if (qty > availableAt(fromId)) {
        throw new Error(`Only ${availableAt(fromId)} available at the source warehouse.`)
      }

      const group = crypto.randomUUID()
      const unitCost = costAt(fromId)

      const { error } = await supabase.from('stock_movements').insert([
        {
          tenant_id: tenant.id,
          product_id: product.id,
          warehouse_id: fromId,
          kind: 'transfer' as const,
          quantity: -qty,
          unit_cost: unitCost,
          reference_type: 'transfer',
          transfer_group: group,
          notes: notes || null,
          created_by: user.id,
        },
        {
          tenant_id: tenant.id,
          product_id: product.id,
          warehouse_id: toId,
          kind: 'transfer' as const,
          quantity: qty,
          unit_cost: unitCost,
          reference_type: 'transfer',
          transfer_group: group,
          notes: notes || null,
          created_by: user.id,
        },
      ])
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('ကုန်ပစ္စည်း လွှဲပြောင်းပြီး')
      queryClient.invalidateQueries({ queryKey: qk.products(tenant.id) })
      queryClient.invalidateQueries({ queryKey: qk.lowStock(tenant.id) })
      queryClient.invalidateQueries({ queryKey: ['stock-levels', tenant.id, product.id] })
      onClose()
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  const list = warehouses.data ?? []

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            လွှဲပြောင်းရန် — {localized(locale, product.name, product.name_my)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>မှ / From</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {list.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {localized(locale, warehouse.name, warehouse.name_my)} (
                      {formatNumber(availableAt(warehouse.id), 0, locale)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="mb-3 size-4 shrink-0 text-muted-foreground" />

            <div className="flex-1">
              <Label>သို့ / To</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {list
                    .filter((warehouse) => warehouse.id !== fromId)
                    .map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {localized(locale, warehouse.name, warehouse.name_my)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tr-qty">အရေအတွက်</Label>
            <Input
              id="tr-qty"
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-12 text-right text-lg tabular-nums"
            />
            {fromId && (
              <p className="mt-1 text-xs text-muted-foreground">
                ရရှိနိုင်သည် {formatNumber(availableAt(fromId), 0, locale)} {product.unit}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="tr-notes">မှတ်ချက်</Label>
            <Input id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
          </div>

          <Button
            size="lg"
            className="h-12 w-full"
            disabled={transfer.isPending || !fromId || !toId || !Number(quantity)}
            onClick={() => transfer.mutate()}
          >
            {transfer.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            လွှဲပြောင်းမည်
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
