'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import type {
  ArApRow, CashFlowPoint, ExpenseRow, IncomeRow, ProfitLossRow, SalesReportRow, StockValuationRow,
} from '@/types'

/**
 * Report RPCs are SECURITY DEFINER, so each one re-checks its own permission
 * and raises 42501 rather than returning a filtered (and misleading) result.
 * A 42501 here means "this role cannot see this report", not "no data".
 */
export function useProfitLoss(from: string, to: string) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.profitLoss(tenant.id, from, to),
    retry: false, // a permission error will never succeed on retry
    queryFn: async (): Promise<ProfitLossRow[]> => {
      const { data, error } = await supabase.rpc('report_profit_loss', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []) as ProfitLossRow[]
    },
  })
}

export function useCashFlow(from: string, to: string, bucket: 'day' | 'week' | 'month' = 'day') {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: [...qk.cashFlow(tenant.id, from, to), bucket],
    retry: false,
    queryFn: async (): Promise<CashFlowPoint[]> => {
      const { data, error } = await supabase.rpc('report_cash_flow', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
        p_bucket: bucket,
      })
      if (error) throw error
      return (data ?? []) as CashFlowPoint[]
    },
  })
}

export function useSalesReport(from: string, to: string) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.salesReport(tenant.id, from, to),
    retry: false,
    queryFn: async (): Promise<SalesReportRow[]> => {
      const { data, error } = await supabase.rpc('report_sales', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []) as SalesReportRow[]
    },
  })
}

/** `warehouseId` of null values every warehouse the member can see. */
export function useStockValuation(warehouseId: string | null = null) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.stockValuation(tenant.id, warehouseId),
    retry: false,
    queryFn: async (): Promise<StockValuationRow[]> => {
      const { data, error } = await supabase.rpc('report_stock_valuation', {
        p_tenant_id: tenant.id,
        p_warehouse_id: warehouseId,
      })
      if (error) throw error
      return (data ?? []) as StockValuationRow[]
    },
  })
}

export function useExpenses(from: string, to: string) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.expenses(tenant.id, from, to),
    retry: false,
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase.rpc('report_expenses', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []) as ExpenseRow[]
    },
  })
}

/** Per-account income for the period. The mirror of {@link useExpenses}. */
export function useIncome(from: string, to: string) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.income(tenant.id, from, to),
    // The RPC raises 42501 without reports.pnl; retrying cannot change that.
    retry: false,
    queryFn: async (): Promise<IncomeRow[]> => {
      const { data, error } = await supabase.rpc('report_income', {
        p_tenant_id: tenant.id,
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []) as IncomeRow[]
    },
  })
}

export function useArAp(kind: 'receivable' | 'payable') {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.arAp(tenant.id, kind),
    retry: false,
    queryFn: async (): Promise<ArApRow[]> => {
      const { data, error } = await supabase.rpc('report_ar_ap', {
        p_tenant_id: tenant.id,
        p_kind: kind,
      })
      if (error) throw error
      return (data ?? []) as ArApRow[]
    },
  })
}
