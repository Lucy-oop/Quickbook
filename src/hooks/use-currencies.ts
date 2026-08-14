'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { toISODate } from '@/lib/format'
import type { CurrencyCode, CurrencyRow, ExchangeRateRow } from '@/types'

export function useCurrencies() {
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: ['currencies'],
    queryFn: async (): Promise<CurrencyRow[]> => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('code')
      if (error) throw error
      return (data ?? []) as CurrencyRow[]
    },
    staleTime: Infinity,
  })
}

/**
 * Latest rate per quote currency, against the tenant's base.
 *
 * The table holds a full history (one row per currency per day) so an invoice
 * issued last month keeps the rate it was issued at. This hook only surfaces
 * the newest row per currency, which is what a new document should use.
 *
 * Tenant rows override the global (`tenant_id is null`) ones — a shop that
 * changes money at the Bogyoke market rate is not bound to the official one.
 */
export function useExchangeRates() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.exchangeRates(tenant.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('base_code', tenant.base_currency)
        .order('rate_date', { ascending: false })
        .limit(200)
      if (error) throw error

      const rows = (data ?? []) as ExchangeRateRow[]
      const latest = new Map<string, ExchangeRateRow>()

      for (const row of rows) {
        const current = latest.get(row.quote_code)
        // Rows arrive newest-first, so the first hit wins on date; a tenant
        // override then beats a same-date global row.
        if (!current) {
          latest.set(row.quote_code, row)
        } else if (
          current.tenant_id === null &&
          row.tenant_id !== null &&
          row.rate_date === current.rate_date
        ) {
          latest.set(row.quote_code, row)
        }
      }

      return [...latest.values()]
    },
  })
}

export function useSetExchangeRate() {
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { quote: CurrencyCode; rate: number; date?: string }) => {
      if (!input.rate || input.rate <= 0) throw new Error('Rate must be greater than zero.')

      // One row per tenant per pair per day; re-saving today replaces today.
      const { error } = await supabase.from('exchange_rates').upsert(
        {
          tenant_id: tenant.id,
          base_code: tenant.base_currency,
          quote_code: input.quote,
          rate: input.rate,
          rate_date: input.date ?? toISODate(),
          source: 'manual',
          created_by: user.id,
        },
        { onConflict: 'tenant_id,base_code,quote_code,rate_date' },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.exchangeRates(tenant.id) }),
  })
}

/**
 * Rate to convert an amount in `quote` into the tenant's base currency.
 *
 * Stored as "1 unit of quote = N base", matching the `amount_base` generated
 * column (`amount * exchange_rate`). Base-to-base is always exactly 1.
 */
export function useRateFor(quote: CurrencyCode): number {
  const { tenant } = useSession()
  const rates = useExchangeRates()

  if (quote === tenant.base_currency) return 1
  const match = rates.data?.find((row) => row.quote_code === quote)
  return match ? Number(match.rate) : 1
}
