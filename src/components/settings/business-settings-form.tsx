'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSession } from '@/components/providers/session-provider'
import { friendlyDbError } from '@/lib/utils'
import type { CurrencyCode, Locale } from '@/types'

/**
 * Business profile. Everything here lands on the printed invoice, so it is the
 * first thing an owner fills in after onboarding.
 *
 * `base_currency` is intentionally read-only after creation: every historical
 * `*_base` column was computed against it, and changing it would silently
 * rewrite the meaning of past reports.
 */
export function BusinessSettingsForm() {
  const router = useRouter()
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  const [name, setName] = useState(tenant.name)
  const [legalName, setLegalName] = useState(tenant.legal_name ?? '')
  const [phone, setPhone] = useState(tenant.phone ?? '')
  const [address, setAddress] = useState(tenant.address ?? '')
  const [taxNumber, setTaxNumber] = useState(tenant.tax_number ?? '')
  const [locale, setLocale] = useState<Locale>(tenant.default_locale)
  const [receiptFooterMy, setReceiptFooterMy] = useState(tenant.settings?.receipt_footer_my ?? '')
  const [receiptFooterEn, setReceiptFooterEn] = useState(tenant.settings?.receipt_footer_en ?? '')

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: name.trim(),
          legal_name: legalName.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          tax_number: taxNumber.trim() || null,
          default_locale: locale,
          settings: {
            ...tenant.settings,
            receipt_footer_my: receiptFooterMy || undefined,
            receipt_footer_en: receiptFooterEn || undefined,
          },
        })
        .eq('id', tenant.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('သိမ်းပြီးပါပြီ')
      router.refresh()
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">လုပ်ငန်းအချက်အလက် / Business profile</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-name">လုပ်ငန်းအမည်</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>
          <div>
            <Label htmlFor="s-legal">တရားဝင်အမည်</Label>
            <Input id="s-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} className="h-11" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-phone">ဖုန်း</Label>
            <Input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
          </div>
          <div>
            <Label htmlFor="s-tax">TIN</Label>
            <Input id="s-tax" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} className="h-11" />
          </div>
        </div>

        <div>
          <Label htmlFor="s-address">လိပ်စာ</Label>
          <Textarea id="s-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>ဘာသာစကား</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="my">မြန်မာ</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ငွေကြေး</Label>
            <Input value={tenant.base_currency as CurrencyCode} disabled className="h-11" />
            <p className="mt-1 text-xs text-muted-foreground">
              Fixed after setup — past reports are stored against it.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-footer-my">ပြေစာအောက်ခြေစာသား (မြန်မာ)</Label>
            <Input
              id="s-footer-my"
              value={receiptFooterMy}
              onChange={(e) => setReceiptFooterMy(e.target.value)}
              className="h-11"
            />
          </div>
          <div>
            <Label htmlFor="s-footer-en">Receipt footer (English)</Label>
            <Input
              id="s-footer-en"
              value={receiptFooterEn}
              onChange={(e) => setReceiptFooterEn(e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        <Button size="lg" className="h-12 w-full sm:w-auto" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          သိမ်းမည်
        </Button>
      </CardContent>
    </Card>
  )
}
