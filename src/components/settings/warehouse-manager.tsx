'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPin, Pencil, Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useWarehouses } from '@/hooks/use-products'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { friendlyDbError } from '@/lib/utils'
import type { WarehouseRow } from '@/types'

/**
 * Shops and warehouses.
 *
 * A tenant always has at least one (created by `create_tenant()`), and exactly
 * one is the default — enforced by a partial unique index, so promoting a new
 * default has to demote the old one in the same breath.
 */
export function WarehouseManager() {
  const { locale } = useI18n()
  const warehouses = useWarehouses()
  const [editing, setEditing] = useState<WarehouseRow | 'new' | null>(null)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" />
          ဆိုင်/ဂိုဒေါင်များ / Locations
        </CardTitle>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          အသစ်
        </Button>
      </CardHeader>

      <CardContent className="p-0 sm:px-2">
        {warehouses.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <ul className="divide-y">
            {(warehouses.data ?? []).map((warehouse) => (
              <li key={warehouse.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  {/* A div, not a p: Badge renders a div, and a div inside a
                      paragraph is invalid HTML that trips hydration. */}
                  <div className="flex items-center gap-2 truncate text-sm font-medium">
                    {localized(locale, warehouse.name, warehouse.name_my)}
                    {warehouse.is_default && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Star className="size-2.5" />
                        default
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{warehouse.code}</span>
                    {warehouse.address && ` · ${warehouse.address}`}
                  </p>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => setEditing(warehouse)}
                  aria-label="Edit"
                >
                  <Pencil className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {editing && (
        <WarehouseEditor
          warehouse={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

function WarehouseEditor({
  warehouse, onClose,
}: {
  warehouse: WarehouseRow | null
  onClose: () => void
}) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  const [code, setCode] = useState(warehouse?.code ?? '')
  const [name, setName] = useState(warehouse?.name ?? '')
  const [nameMy, setNameMy] = useState(warehouse?.name_my ?? '')
  const [address, setAddress] = useState(warehouse?.address ?? '')
  const [phone, setPhone] = useState(warehouse?.phone ?? '')
  const [isDefault, setIsDefault] = useState(warehouse?.is_default ?? false)

  const save = useMutation({
    mutationFn: async () => {
      // `warehouses_one_default` is a partial unique index, so the old default
      // has to be cleared before the new one lands or the insert trips it.
      if (isDefault && !warehouse?.is_default) {
        const { error: demoteError } = await supabase
          .from('warehouses')
          .update({ is_default: false })
          .eq('tenant_id', tenant.id)
          .eq('is_default', true)
        if (demoteError) throw demoteError
      }

      const payload = {
        tenant_id: tenant.id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        name_my: nameMy.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        is_default: isDefault,
      }

      const { error } = warehouse
        ? await supabase.from('warehouses').update(payload).eq('id', warehouse.id)
        : await supabase.from('warehouses').insert(payload)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('သိမ်းပြီးပါပြီ')
      queryClient.invalidateQueries({ queryKey: qk.warehouses(tenant.id) })
      onClose()
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{warehouse ? 'တည်နေရာပြင်ဆင်ရန်' : 'တည်နေရာအသစ်'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="w-code">ကုဒ်</Label>
              <Input
                id="w-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-11 font-mono uppercase"
                placeholder="MAIN"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="w-name">အမည် / Name</Label>
              <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" autoFocus />
            </div>
          </div>

          <div>
            <Label htmlFor="w-name-my">အမည် (မြန်မာ)</Label>
            <Input id="w-name-my" value={nameMy} onChange={(e) => setNameMy(e.target.value)} className="h-11" />
          </div>

          <div>
            <Label htmlFor="w-address">လိပ်စာ</Label>
            <Input id="w-address" value={address} onChange={(e) => setAddress(e.target.value)} className="h-11" />
          </div>

          <div>
            <Label htmlFor="w-phone">ဖုန်း</Label>
            <Input id="w-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm">ပင်မတည်နေရာ / Default location</p>
              <p className="text-xs text-muted-foreground">New sales and stock land here.</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <Button
            size="lg"
            className="h-12 w-full"
            disabled={!name.trim() || !code.trim() || save.isPending}
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
