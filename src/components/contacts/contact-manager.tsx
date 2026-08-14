'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Phone, Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { usePermission } from '@/hooks/use-permission'
import { CustomFieldsForm } from '@/components/custom-fields/custom-fields-form'
import { useI18n } from '@/lib/i18n'
import { friendlyDbError } from '@/lib/utils'
import type { ContactKind, ContactRow, CustomFieldValues } from '@/types'

export function ContactManager() {
  const { t } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()
  const supabase = getSupabaseBrowserClient()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null)

  const contacts = useQuery({
    queryKey: qk.contacts(tenant.id, search),
    queryFn: async (): Promise<ContactRow[]> => {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name')
        .limit(100)

      const term = search.trim()
      if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,code.ilike.%${term}%`)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ContactRow[]
    },
    placeholderData: (previous) => previous,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.contacts')}</h1>
        {can('contacts.manage') && (
          <Button className="gap-2" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            ဖောက်သည်အသစ်
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="အမည် သို့မဟုတ် ဖုန်းနံပါတ်"
          className="h-12 pl-9"
          inputMode="search"
        />
      </div>

      {contacts.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !contacts.data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {contacts.data.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-accent disabled:cursor-default sm:px-4"
                onClick={() => can('contacts.manage') && setEditing(contact)}
                disabled={!can('contacts.manage')}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {contact.name.slice(0, 2).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{contact.name}</span>
                  {contact.phone && (
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      {contact.phone}
                    </span>
                  )}
                </span>

                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {contact.kind}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ContactEditor contact={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function ContactEditor({ contact, onClose }: { contact: ContactRow | null; onClose: () => void }) {
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  const [name, setName] = useState(contact?.name ?? '')
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? 'customer')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [address, setAddress] = useState(contact?.address ?? '')
  const [creditLimit, setCreditLimit] = useState(String(contact?.credit_limit ?? 0))
  const [termsDays, setTermsDays] = useState(String(contact?.payment_terms_days ?? 0))
  const [customFields, setCustomFields] = useState<CustomFieldValues>(contact?.custom_fields ?? {})

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenant.id,
        name: name.trim(),
        kind,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        credit_limit: Number(creditLimit) || 0,
        payment_terms_days: Number(termsDays) || 0,
        custom_fields: customFields,
        created_by: user.id,
      }

      const { error } = contact
        ? await supabase.from('contacts').update(payload).eq('id', contact.id)
        : await supabase.from('contacts').insert(payload)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('သိမ်းပြီးပါပြီ')
      queryClient.invalidateQueries({ queryKey: qk.contacts(tenant.id) })
      onClose()
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? 'ဖောက်သည်ပြင်ဆင်ရန်' : 'ဖောက်သည်အသစ်'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="c-name">အမည်</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" autoFocus />
          </div>

          <div>
            <Label>အမျိုးအစား</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ContactKind)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">ဖောက်သည် / Customer</SelectItem>
                <SelectItem value="supplier">ပေးသွင်းသူ / Supplier</SelectItem>
                <SelectItem value="both">နှစ်မျိုးလုံး / Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-phone">ဖုန်း</Label>
              <Input id="c-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
          </div>

          <div>
            <Label htmlFor="c-address">လိပ်စာ</Label>
            <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} className="h-11" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-credit">အကြွေးကန့်သတ်ချက်</Label>
              <Input
                id="c-credit"
                type="number"
                inputMode="decimal"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="h-11 text-right tabular-nums"
              />
            </div>
            <div>
              <Label htmlFor="c-terms">ပေးချေရမည့်ရက်</Label>
              <Input
                id="c-terms"
                type="number"
                inputMode="numeric"
                value={termsDays}
                onChange={(e) => setTermsDays(e.target.value)}
                className="h-11 text-right tabular-nums"
              />
            </div>
          </div>

          <CustomFieldsForm entity="contact" values={customFields} onChange={setCustomFields} />

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
