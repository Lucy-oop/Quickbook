'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Check, Loader2, ShoppingBag, Store, Truck, UtensilsCrossed, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { friendlyDbError, cn } from '@/lib/utils'
import { ACTIVE_TENANT_COOKIE, TENANT_COOKIE_MAX_AGE } from '@/lib/session.shared'
import type { BusinessType, CurrencyCode, Locale } from '@/types'

const BUSINESS_TYPES: {
  value: BusinessType
  labelEn: string
  labelMy: string
  icon: typeof Store
  /** Custom fields we offer to pre-create for this kind of business. */
  suggested: { field_key: string; label_en: string; label_my: string; field_type: string }[]
}[] = [
  {
    value: 'retail', labelEn: 'Retail / Shop', labelMy: 'အရောင်းဆိုင်', icon: Store,
    suggested: [
      { field_key: 'imei', label_en: 'IMEI Number', label_my: 'IMEI နံပါတ်', field_type: 'text' },
      { field_key: 'warranty_months', label_en: 'Warranty (months)', label_my: 'အာမခံ (လ)', field_type: 'number' },
    ],
  },
  {
    value: 'wholesale', labelEn: 'Wholesale', labelMy: 'လက်ကားရောင်း', icon: Truck,
    suggested: [
      { field_key: 'carton_size', label_en: 'Units per Carton', label_my: 'တစ်ဖုံလျှင်အရေအတွက်', field_type: 'number' },
      { field_key: 'expiry_date', label_en: 'Expiry Date', label_my: 'သက်တမ်းကုန်ရက်', field_type: 'date' },
    ],
  },
  {
    value: 'restaurant', labelEn: 'Restaurant / Tea shop', labelMy: 'စားသောက်ဆိုင်', icon: UtensilsCrossed,
    suggested: [
      { field_key: 'prep_minutes', label_en: 'Prep Time (min)', label_my: 'ပြင်ဆင်ချိန် (မိနစ်)', field_type: 'number' },
      { field_key: 'spice_level', label_en: 'Spice Level', label_my: 'အစပ်အဆင့်', field_type: 'select' },
    ],
  },
  {
    value: 'service', labelEn: 'Service', labelMy: 'ဝန်ဆောင်မှု', icon: Wrench,
    suggested: [
      { field_key: 'service_date', label_en: 'Service Date', label_my: 'ဝန်ဆောင်မှုရက်', field_type: 'date' },
      { field_key: 'technician', label_en: 'Technician', label_my: 'ဝန်ထမ်း', field_type: 'text' },
    ],
  },
]

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'MMK', label: 'ကျပ် (MMK)' },
  { code: 'THB', label: 'บาท (THB)' },
  { code: 'USD', label: 'Dollar (USD)' },
]

/**
 * One RPC does the whole setup: `create_tenant()` writes the tenant, clones the
 * six system roles with their permissions, seeds the chart of accounts, creates
 * the default warehouse and the numbering sequences, and makes this user its
 * owner — atomically. If anything fails, nothing is left half-created.
 */
export function OnboardingWizard() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('retail')
  const [currency, setCurrency] = useState<CurrencyCode>('MMK')
  const [locale, setLocale] = useState<Locale>('my')
  const [withSuggestedFields, setWithSuggestedFields] = useState(true)

  const preset = BUSINESS_TYPES.find((b) => b.value === businessType)!

  const create = async () => {
    setLoading(true)
    try {
      const { data: tenant, error } = await supabase.rpc('create_tenant', {
        p_name: name.trim(),
        p_business_type: businessType,
        p_base_currency: currency,
        p_locale: locale,
        p_phone: phone || null,
      })
      if (error) throw error

      // Seed the trade-specific custom fields the owner opted into.
      if (withSuggestedFields && preset.suggested.length) {
        await supabase.from('custom_fields_schema').insert(
          preset.suggested.map((field, index) => ({
            tenant_id: tenant.id,
            entity: 'product' as const,
            field_key: field.field_key,
            label_en: field.label_en,
            label_my: field.label_my,
            field_type: field.field_type as never,
            show_in_list: true,
            show_on_print: field.field_key === 'imei',
            sort_order: index,
          })),
        )
      }

      document.cookie = `${ACTIVE_TENANT_COOKIE}=${tenant.id}; path=/; max-age=${TENANT_COOKIE_MAX_AGE}; samesite=lax`
      toast.success('လုပ်ငန်းဖွင့်ပြီးပါပြီ!')
      // replace() only — a router.refresh() chaser races it and corrupts the
      // in-flight RSC stream. The navigation carries the tenant cookie set
      // just above, so AppLayout resolves the new session on the first request.
      router.replace('/dashboard')
    } catch (error) {
      toast.error(friendlyDbError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <Building2 className="size-5 text-primary-foreground" />
          </span>
          <span className="text-xs text-muted-foreground">အဆင့် {step} / 2</span>
        </div>
        <CardTitle>{step === 1 ? 'လုပ်ငန်းအချက်အလက်' : 'လုပ်ငန်းအမျိုးအစား'}</CardTitle>
        <CardDescription>
          {step === 1
            ? 'Tell us about your business'
            : 'We will set up the right fields and accounts for you'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 1 ? (
          <>
            <div>
              <Label htmlFor="biz-name">လုပ်ငန်းအမည် / Business name</Label>
              <Input
                id="biz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ရွှေဖုန်းဆိုင်"
                className="h-12"
                autoFocus
                required
              />
            </div>

            <div>
              <Label htmlFor="biz-phone">ဖုန်းနံပါတ်</Label>
              <Input
                id="biz-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
              />
            </div>

            <div>
              <Label>ငွေကြေး / Currency</Label>
              <div className="grid grid-cols-3 gap-2">
                {CURRENCIES.map((c) => (
                  <Button
                    key={c.code}
                    type="button"
                    variant={currency === c.code ? 'default' : 'outline'}
                    className="h-11"
                    onClick={() => setCurrency(c.code)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>ဘာသာစကား / Language</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={locale === 'my' ? 'default' : 'outline'}
                  className="h-11"
                  onClick={() => setLocale('my')}
                >
                  မြန်မာ
                </Button>
                <Button
                  type="button"
                  variant={locale === 'en' ? 'default' : 'outline'}
                  className="h-11"
                  onClick={() => setLocale('en')}
                >
                  English
                </Button>
              </div>
            </div>

            <Button size="lg" className="h-12 w-full" disabled={!name.trim()} onClick={() => setStep(2)}>
              ဆက်လက်ဆောင်ရွက်မည်
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {BUSINESS_TYPES.map((type) => {
                const active = businessType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setBusinessType(type.value)}
                    className={cn(
                      'flex min-h-24 flex-col items-start gap-2 rounded-lg border p-3 text-left transition',
                      active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent',
                    )}
                  >
                    <type.icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-sm font-medium leading-tight">{type.labelMy}</span>
                    <span className="text-xs text-muted-foreground">{type.labelEn}</span>
                  </button>
                )
              })}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
              <input
                type="checkbox"
                checked={withSuggestedFields}
                onChange={(e) => setWithSuggestedFields(e.target.checked)}
                className="mt-0.5 size-4"
              />
              <span className="text-sm">
                <span className="font-medium">အကြံပြုအကွက်များ ထည့်မည်</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {preset.suggested.map((f) => f.label_my).join(' · ')} — later editable in Settings.
                </span>
              </span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="h-12" onClick={() => setStep(1)} disabled={loading}>
                နောက်သို့
              </Button>
              <Button size="lg" className="h-12 flex-1" onClick={create} disabled={loading}>
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                စတင်အသုံးပြုမည်
              </Button>
            </div>
          </>
        )}

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShoppingBag className="size-3" />
          အခမဲ့ ရက် ၃၀ · ခရက်ဒစ်ကတ် မလို
        </p>
      </CardContent>
    </Card>
  )
}
