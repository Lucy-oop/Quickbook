'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CustomFieldEntity, CustomFieldRow, CustomFieldValue, CustomFieldValues } from '@/types'

interface Props {
  entity: CustomFieldEntity
  values: CustomFieldValues
  onChange: (values: CustomFieldValues) => void
  /** Render nothing at all when the tenant has defined no fields for this entity. */
  className?: string
}

export function useCustomFields(entity: CustomFieldEntity) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.customFields(tenant.id, entity),
    queryFn: async (): Promise<CustomFieldRow[]> => {
      const { data, error } = await supabase
        .from('custom_fields_schema')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('entity', entity)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as CustomFieldRow[]
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * Renders the tenant's own fields for an entity.
 *
 * A phone shop adds `imei` (text, unique, regex ^\d{15}$) to `product`; a
 * mini-mart adds `expiry_date` (date, required). Neither needs a code change —
 * the schema rows drive this form, and the matching database trigger
 * (`tg_validate_custom_fields`) enforces the same rules server-side.
 */
export function CustomFieldsForm({ entity, values, onChange, className }: Props) {
  const { locale } = useI18n()
  const { data: fields, isLoading } = useCustomFields(entity)

  if (isLoading || !fields?.length) return null

  const set = (key: string, value: CustomFieldValue) => onChange({ ...values, [key]: value })

  return (
    <div className={className ?? 'space-y-3'}>
      {fields.map((field) => {
        const label = localized(locale, field.label_en, field.label_my)
        const id = `cf-${field.field_key}`
        const value = values[field.field_key]

        return (
          <div key={field.id}>
            {field.field_type !== 'boolean' && (
              <Label htmlFor={id}>
                {label}
                {field.is_required && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
            )}

            {(() => {
              switch (field.field_type) {
                case 'textarea':
                  return (
                    <Textarea
                      id={id}
                      rows={2}
                      value={(value as string) ?? ''}
                      required={field.is_required}
                      onChange={(e) => set(field.field_key, e.target.value)}
                    />
                  )

                case 'number':
                case 'decimal':
                case 'currency':
                  return (
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      step={field.field_type === 'number' ? 1 : 'any'}
                      min={field.validation?.min}
                      max={field.validation?.max}
                      required={field.is_required}
                      value={value === null || value === undefined ? '' : String(value)}
                      onChange={(e) =>
                        set(field.field_key, e.target.value === '' ? null : Number(e.target.value))
                      }
                      className="h-11"
                    />
                  )

                case 'boolean':
                  return (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                      <Label htmlFor={id} className="cursor-pointer font-normal">
                        {label}
                      </Label>
                      <Switch
                        id={id}
                        checked={Boolean(value)}
                        onCheckedChange={(checked) => set(field.field_key, checked)}
                      />
                    </div>
                  )

                case 'date':
                case 'datetime':
                  return (
                    <Input
                      id={id}
                      type={field.field_type === 'date' ? 'date' : 'datetime-local'}
                      required={field.is_required}
                      value={(value as string) ?? ''}
                      onChange={(e) => set(field.field_key, e.target.value || null)}
                      className="h-11"
                    />
                  )

                case 'select':
                  return (
                    <Select
                      value={(value as string) ?? ''}
                      onValueChange={(next) => set(field.field_key, next)}
                    >
                      <SelectTrigger id={id} className="h-11">
                        <SelectValue placeholder={field.help_text ?? ''} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {localized(locale, option.label_en, option.label_my)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )

                case 'multiselect':
                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {field.options.map((option) => {
                        const selected = Array.isArray(value) && value.includes(option.value)
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              const current = Array.isArray(value) ? value : []
                              set(
                                field.field_key,
                                selected
                                  ? current.filter((v) => v !== option.value)
                                  : [...current, option.value],
                              )
                            }}
                            className={
                              selected
                                ? 'rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground'
                                : 'rounded-full border px-3 py-1.5 text-xs'
                            }
                          >
                            {localized(locale, option.label_en, option.label_my)}
                          </button>
                        )
                      })}
                    </div>
                  )

                case 'barcode':
                  return (
                    <Input
                      id={id}
                      inputMode="numeric"
                      // Lets a wedge scanner type straight into this field.
                      data-scanner-passthrough="true"
                      required={field.is_required}
                      pattern={field.validation?.regex}
                      value={(value as string) ?? ''}
                      onChange={(e) => set(field.field_key, e.target.value)}
                      className="h-11 font-mono"
                    />
                  )

                default:
                  return (
                    <Input
                      id={id}
                      type={
                        field.field_type === 'email' ? 'email'
                        : field.field_type === 'phone' ? 'tel'
                        : field.field_type === 'url' ? 'url'
                        : 'text'
                      }
                      required={field.is_required}
                      minLength={field.validation?.minLength}
                      maxLength={field.validation?.maxLength}
                      pattern={field.validation?.regex}
                      value={(value as string) ?? ''}
                      onChange={(e) => set(field.field_key, e.target.value)}
                      className="h-11"
                    />
                  )
              }
            })()}

            {field.help_text && (
              <p className="mt-1 text-xs text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
