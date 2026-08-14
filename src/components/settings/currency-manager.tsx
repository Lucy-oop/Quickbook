'use client'

import { useState } from 'react'
import { ArrowRightLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

import { useCurrencies, useExchangeRates, useSetExchangeRate } from '@/hooks/use-currencies'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { friendlyDbError } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/**
 * Manual exchange rates.
 *
 * Rates are quoted as **1 unit of the foreign currency = N base units**, which
 * is how they are spoken about in Myanmar ("ဒေါ်လာ တစ်ဒေါ်လာ ကျပ် ၄၅၀၀") and
 * exactly how the `amount_base` generated column multiplies. Getting this
 * direction wrong would silently invert every foreign-currency figure in the
 * P&L, so the form states it on screen and previews the conversion live.
 *
 * Each save writes a new dated row rather than editing the old one: an invoice
 * issued last month keeps the rate it was issued at.
 */
export function CurrencyManager() {
  const { tenant } = useSession()
  const { locale } = useI18n()

  const currencies = useCurrencies()
  const rates = useExchangeRates()
  const setRate = useSetExchangeRate()

  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const foreign = (currencies.data ?? []).filter((c) => c.code !== tenant.base_currency)
  const rateFor = (code: string) => rates.data?.find((r) => r.quote_code === code)

  const save = async (code: CurrencyCode) => {
    const value = Number(drafts[code])
    try {
      await setRate.mutateAsync({ quote: code, rate: value })
      toast.success(`${code} → ${tenant.base_currency} updated`)
      setDrafts((prev) => ({ ...prev, [code]: '' }))
    } catch (error) {
      toast.error(friendlyDbError(error))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">ငွေလဲနှုန်း / Exchange rates</h1>
        <p className="text-sm text-muted-foreground">
          အခြေခံငွေကြေး <span className="font-medium">{tenant.base_currency}</span> နှင့် နှိုင်းယှဉ်နှုန်းများ
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="size-4" />
            နှုန်းထားများ
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            နှုန်းကို <span className="font-medium">၁ ယူနစ် = ? {tenant.base_currency}</span> အနေဖြင့် ထည့်ပါ။
            <span className="mt-0.5 block">
              Enter as “1 unit of the foreign currency = N {tenant.base_currency}”.
            </span>
          </p>

          {currencies.isLoading || rates.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <ul className="divide-y">
              {foreign.map((currency) => {
                const current = rateFor(currency.code)
                const draft = drafts[currency.code] ?? ''
                const preview = Number(draft) > 0 ? Number(draft) : Number(current?.rate ?? 0)

                return (
                  <li key={currency.code} className="flex flex-wrap items-end gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      {/* A div, not a p: Badge renders a div, and a div inside
                          a paragraph is invalid HTML that trips hydration. */}
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="font-mono">{currency.code}</span>
                        <span className="text-muted-foreground">{currency.symbol}</span>
                        {current?.tenant_id === null && (
                          <Badge variant="outline" className="text-[10px]">system</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {localized(locale, currency.name, currency.name_my)}
                        {current && ` · ${formatDate(current.rate_date, locale)}`}
                      </p>
                    </div>

                    <div className="w-36">
                      <Label htmlFor={`rate-${currency.code}`} className="text-xs">
                        1 {currency.code} =
                      </Label>
                      <Input
                        id={`rate-${currency.code}`}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder={current ? String(current.rate) : '0'}
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [currency.code]: e.target.value }))
                        }
                        className="h-11 text-right tabular-nums"
                      />
                    </div>

                    <Button
                      className="h-11"
                      disabled={!Number(draft) || setRate.isPending}
                      onClick={() => save(currency.code)}
                    >
                      {setRate.isPending ? <Loader2 className="size-4 animate-spin" /> : 'သိမ်းမည်'}
                    </Button>

                    <p className="w-full text-xs text-muted-foreground tabular-nums sm:w-auto">
                      {preview > 0
                        ? `${formatMoney(100, { currency: currency.code, locale })} ≈ ${formatMoney(100 * preview, { currency: tenant.base_currency, locale })}`
                        : 'နှုန်းမသတ်မှတ်ရသေးပါ — documents will use 1:1'}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="size-4" />
            အလိုအလျောက် နှုန်းများ / Automatic rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Rates entered here are manual and dated. To fetch them automatically, set{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">EXCHANGE_RATE_API_KEY</code> and run a
            scheduled job that inserts rows with <code className="rounded bg-muted px-1 py-0.5 text-xs">tenant_id = null</code>{' '}
            and <code className="rounded bg-muted px-1 py-0.5 text-xs">source = &apos;api&apos;</code> — those act as
            the fallback whenever a tenant has not set its own rate for the day.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
