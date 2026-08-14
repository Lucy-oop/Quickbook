'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import type { DashboardSummary, ExpenseBreakdownRow, SalesTrendPoint, TopProductRow } from '@/types'

/**
 * The dashboard RPCs are permission-aware server-side: `dashboard_summary`
 * omits profit keys for a cashier, and `report_top_products` throws 42501
 * without `reports.sales`. The hooks below therefore never need to guess —
 * they just render whatever came back.
 */
export function useDashboardSummary(from: string, to: string) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.dashboard(tenant.id, from, to),
    queryFn: async (): Promise<DashboardSummary> => {
      const { data, error } = await supabase.rpc('dashboard_summary', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? {}) as DashboardSummary
    },
  })
}

export function useSalesTrend(from: string, to: string) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.salesTrend(tenant.id, from, to),
    queryFn: async (): Promise<SalesTrendPoint[]> => {
      const { data, error } = await supabase.rpc('report_sales_trend', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []) as SalesTrendPoint[]
    },
  })
}

export function useTopProducts(from: string, to: string, enabled = true) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.topProducts(tenant.id, from, to),
    enabled,
    queryFn: async (): Promise<TopProductRow[]> => {
      const { data, error } = await supabase.rpc('report_top_products', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
        p_limit: 5,
      })
      if (error) throw error
      return (data ?? []) as TopProductRow[]
    },
  })
}

/**
 * Salary vs office operations vs inventory cost for the period. Grouped in SQL
 * so the figures reconcile with `dashboard_summary.expense_period`, which sums
 * the same transactions. Requires `reports.pnl` — the RPC raises 42501 without
 * it, so pass `enabled` from a permission check.
 */
export function useExpenseBreakdown(from: string, to: string, enabled = true) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.expenseBreakdown(tenant.id, from, to),
    enabled,
    queryFn: async (): Promise<ExpenseBreakdownRow[]> => {
      const { data, error } = await supabase.rpc('report_expense_breakdown', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []) as ExpenseBreakdownRow[]
    },
  })
}

export function useLowStock(enabled = true) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.lowStock(tenant.id),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_low_stock')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('quantity', { ascending: true })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })
}
