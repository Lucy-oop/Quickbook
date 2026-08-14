'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { friendlyDbError } from '@/lib/utils'
import type {
  CustomFieldEntity, CustomFieldOption, CustomFieldRow, CustomFieldType, CustomFieldValidation,
} from '@/types'

const ENTITIES: { value: CustomFieldEntity; labelEn: string; labelMy: string }[] = [
  { value: 'product', labelEn: 'Products', labelMy: 'ကုန်ပစ္စည်း' },
  { value: 'contact', labelEn: 'Customers', labelMy: 'ဖောက်သည်' },
  { value: 'invoice', labelEn: 'Invoices', labelMy: 'ပြေစာ' },
  { value: 'transaction', labelEn: 'Transactions', labelMy: 'ငွေစာရင်း' },
]

const FIELD_TYPES: { value: CustomFieldType; labelEn: string; labelMy: string }[] = [
  { value: 'text', labelEn: 'Text', labelMy: 'စာသား' },
  { value: 'textarea', labelEn: 'Long text', labelMy: 'စာပိုဒ်' },
  { value: 'number', labelEn: 'Whole number', labelMy: 'ဂဏန်း' },
  { value: 'decimal', labelEn: 'Decimal', labelMy: 'ဒဿမ' },
  { value: 'currency', labelEn: 'Money', labelMy: 'ငွေပမာဏ' },
  { value: 'date', labelEn: 'Date', labelMy: 'ရက်စွဲ' },
  { value: 'datetime', labelEn: 'Date & time', labelMy: 'ရက်စွဲနှင့်အချိန်' },
  { value: 'boolean', labelEn: 'Yes / No', labelMy: 'ဟုတ်/မဟုတ်' },
  { value: 'select', labelEn: 'Choose one', labelMy: 'တစ်ခုရွေး' },
  { value: 'multiselect', labelEn: 'Choose many', labelMy: 'အများရွေး' },
  { value: 'barcode', labelEn: 'Barcode / serial', labelMy: 'ဘားကုဒ်' },
  { value: 'phone', labelEn: 'Phone', labelMy: 'ဖုန်း' },
  { value: 'email', labelEn: 'Email', labelMy: 'အီးမေးလ်' },
  { value: 'url', labelEn: 'Link', labelMy: 'လင့်' },
]

/**
 * The custom fields engine's control panel.
 *
 * Whatever is defined here immediately drives three things with no code change:
 * `<CustomFieldsForm>` in every entry screen, the `tg_validate_custom_fields`
 * database trigger, and the printed invoice (for fields marked show_on_print).
 */
export function CustomFieldsManager() {
  const { locale } = useI18n()
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  const [entity, setEntity] = useState<CustomFieldEntity>('product')
  const [editing, setEditing] = useState<CustomFieldRow | 'new' | null>(null)

  const fields = useQuery({
    queryKey: qk.customFields(tenant.id, entity),
    queryFn: async (): Promise<CustomFieldRow[]> => {
      const { data, error } = await supabase
        .from('custom_fields_schema')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('entity', entity)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as CustomFieldRow[]
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_fields_schema').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('ဖျက်ပြီးပါပြီ')
      queryClient.invalidateQueries({ queryKey: qk.customFields(tenant.id, entity) })
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">စိတ်ကြိုက်အကွက်များ</h1>
          <p className="text-sm text-muted-foreground">
            သင့်လုပ်ငန်းနှင့်ကိုက်ညီသော အချက်အလက်အကွက်များ ထည့်သွင်းပါ
          </p>
        </div>
        <Button className="gap-2" onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          အကွက်အသစ်
        </Button>
      </div>

      <Tabs value={entity} onValueChange={(v) => setEntity(v as CustomFieldEntity)}>
        <TabsList className="grid w-full grid-cols-4">
          {ENTITIES.map((e) => (
            <TabsTrigger key={e.value} value={e.value}>
              {locale === 'my' ? e.labelMy : e.labelEn}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {locale === 'my'
              ? ENTITIES.find((e) => e.value === entity)?.labelMy
              : ENTITIES.find((e) => e.value === entity)?.labelEn}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fields.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !fields.data?.length ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              အကွက်မရှိသေးပါ — “အကွက်အသစ်” ကိုနှိပ်ပါ
            </p>
          ) : (
            <ul className="divide-y">
              {fields.data.map((field) => (
                <li key={field.id} className="flex items-center gap-3 p-3 sm:px-4">
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {localized(locale, field.label_en, field.label_my)}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{field.field_key}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {FIELD_TYPES.find((t) => t.value === field.field_type)?.labelEn ?? field.field_type}
                    </Badge>
                    {field.is_required && <Badge variant="outline" className="text-[10px]">required</Badge>}
                    {field.is_unique && <Badge variant="outline" className="text-[10px]">unique</Badge>}
                    {field.show_on_print && <Badge variant="outline" className="text-[10px]">on receipt</Badge>}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="size-9" onClick={() => setEditing(field)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9 text-destructive"
                      onClick={() => remove.mutate(field.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ဤအကွက်များကို ဒေတာဘေ့စ်အဆင့်တွင်ပါ စစ်ဆေးပါသည် —
        <span className="ml-1">
          rules set here are enforced by a database trigger, not just the form, so bad data cannot get in
          through any other route either.
        </span>
      </p>

      {editing && (
        <FieldEditorDialog
          entity={entity}
          field={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/* ── Editor ───────────────────────────────────────────────────────────── */

function FieldEditorDialog({
  entity, field, onClose,
}: {
  entity: CustomFieldEntity
  field: CustomFieldRow | null
  onClose: () => void
}) {
  const { locale } = useI18n()
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  const [labelEn, setLabelEn] = useState(field?.label_en ?? '')
  const [labelMy, setLabelMy] = useState(field?.label_my ?? '')
  const [fieldKey, setFieldKey] = useState(field?.field_key ?? '')
  const [fieldType, setFieldType] = useState<CustomFieldType>(field?.field_type ?? 'text')
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false)
  const [isUnique, setIsUnique] = useState(field?.is_unique ?? false)
  const [showInList, setShowInList] = useState(field?.show_in_list ?? false)
  const [showOnPrint, setShowOnPrint] = useState(field?.show_on_print ?? false)
  const [helpText, setHelpText] = useState(field?.help_text ?? '')
  const [optionsText, setOptionsText] = useState(
    (field?.options ?? []).map((o: CustomFieldOption) => o.label_en).join('\n'),
  )
  const [regex, setRegex] = useState(field?.validation?.regex ?? '')

  const needsOptions = fieldType === 'select' || fieldType === 'multiselect'

  const save = useMutation({
    mutationFn: async () => {
      const validation: CustomFieldValidation = {}
      if (regex.trim()) validation.regex = regex.trim()

      const options: CustomFieldOption[] = needsOptions
        ? optionsText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((label) => ({ value: slugify(label), label_en: label }))
        : []

      const payload = {
        tenant_id: tenant.id,
        entity,
        // field_key is the JSONB key; changing it on an existing field would
        // orphan every stored value, so it is locked once created.
        field_key: field?.field_key ?? slugify(fieldKey || labelEn),
        label_en: labelEn,
        label_my: labelMy || null,
        field_type: fieldType,
        is_required: isRequired,
        is_unique: isUnique,
        show_in_list: showInList,
        show_on_print: showOnPrint,
        help_text: helpText || null,
        options,
        validation,
      }

      const { error } = field
        ? await supabase.from('custom_fields_schema').update(payload).eq('id', field.id)
        : await supabase.from('custom_fields_schema').insert(payload)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('သိမ်းပြီးပါပြီ')
      queryClient.invalidateQueries({ queryKey: qk.customFields(tenant.id, entity) })
      onClose()
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'အကွက်ပြင်ဆင်ရန်' : 'အကွက်အသစ်ထည့်ရန်'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cf-label-en">Label (English)</Label>
            <Input
              id="cf-label-en"
              value={labelEn}
              onChange={(e) => {
                setLabelEn(e.target.value)
                if (!field && !fieldKey) setFieldKey(slugify(e.target.value))
              }}
              className="h-11"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="cf-label-my">အမည် (မြန်မာ)</Label>
            <Input id="cf-label-my" value={labelMy} onChange={(e) => setLabelMy(e.target.value)} className="h-11" />
          </div>

          <div>
            <Label htmlFor="cf-key">Key</Label>
            <Input
              id="cf-key"
              value={field?.field_key ?? fieldKey}
              onChange={(e) => setFieldKey(slugify(e.target.value))}
              disabled={!!field}
              className="h-11 font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {field ? 'Locked — existing values are stored under this key.' : 'a–z, 0–9 and underscores only'}
            </p>
          </div>

          <div>
            <Label>အမျိုးအစား / Type</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldType)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {locale === 'my' ? type.labelMy : type.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsOptions && (
            <div>
              <Label htmlFor="cf-options">ရွေးချယ်စရာများ (တစ်ကြောင်းလျှင်တစ်ခု)</Label>
              <textarea
                id="cf-options"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm"
              />
            </div>
          )}

          {(fieldType === 'text' || fieldType === 'barcode') && (
            <div>
              <Label htmlFor="cf-regex">Format check (regex)</Label>
              <Input
                id="cf-regex"
                value={regex}
                onChange={(e) => setRegex(e.target.value)}
                placeholder="^[0-9]{15}$"
                className="h-11 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                e.g. <code>^[0-9]{'{15}'}$</code> for a 15-digit IMEI
              </p>
            </div>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <ToggleRow label="မဖြစ်မနေဖြည့်ရန် / Required" checked={isRequired} onChange={setIsRequired} />
            <ToggleRow
              label="ထပ်နေခြင်းမရှိရ / Must be unique"
              checked={isUnique}
              onChange={setIsUnique}
              hint="Stops the same IMEI or serial being entered twice."
            />
            <ToggleRow label="စာရင်းတွင်ပြရန် / Show in lists" checked={showInList} onChange={setShowInList} />
            <ToggleRow label="ပြေစာတွင်ပါရန် / Print on invoice" checked={showOnPrint} onChange={setShowOnPrint} />
          </div>

          <div>
            <Label htmlFor="cf-help">အကူအညီစာသား</Label>
            <Input id="cf-help" value={helpText} onChange={(e) => setHelpText(e.target.value)} className="h-11" />
          </div>

          <Button
            size="lg"
            className="h-12 w-full"
            disabled={!labelEn || save.isPending}
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

function ToggleRow({
  label, checked, onChange, hint,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** Matches the DB constraint: ^[a-z][a-z0-9_]{0,48}$ */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, 49)
}
