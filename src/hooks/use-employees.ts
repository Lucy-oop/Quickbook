'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import type { EmployeeRow, PaymentMethod } from '@/types'

/**
 * The staff list behind the salary form. Gated on `employees.read` at the RLS
 * layer, so a member without it gets an empty list rather than an error —
 * callers should pass `enabled` from a permission check so the UI can say why.
 */
export function useEmployees(enabled = true, includeInactive = false) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: [...qk.employees(tenant.id), includeInactive] as const,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EmployeeRow[]> => {
      let query = supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name')

      if (!includeInactive) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

export function useUpsertEmployee() {
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id?: string
      code?: string | null
      name: string
      nameMy?: string | null
      position?: string | null
      phone?: string | null
      baseSalary?: number
      paymentMethod?: PaymentMethod
      isActive?: boolean
      note?: string | null
    }) => {
      const row = {
        tenant_id: tenant.id,
        code: input.code?.trim() || null,
        name: input.name.trim(),
        name_my: input.nameMy?.trim() || null,
        position: input.position?.trim() || null,
        phone: input.phone?.trim() || null,
        base_salary: input.baseSalary ?? 0,
        payment_method: (input.paymentMethod ?? 'cash') as never,
        is_active: input.isActive ?? true,
        note: input.note?.trim() || null,
      }

      const { data, error } = input.id
        ? await supabase.from('employees').update(row).eq('id', input.id).select().single()
        : await supabase
            .from('employees')
            .insert({ ...row, created_by: user.id })
            .select()
            .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.employees(tenant.id) })
    },
  })
}

/**
 * Records one salary payment: the expense transaction that moves the money, plus
 * the payroll detail explaining how the figure was composed.
 *
 * Both rows are written by a single RPC so they cannot come apart. Doing it as
 * two inserts from here would need `transactions.delete` to undo the first when
 * the second fails — a permission the manager and accountant roles do not hold.
 */
export function useRecordSalary() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      accountId: string
      paymentAccountId?: string | null
      paymentMethod: PaymentMethod
      employeeId: string
      /** Any date inside the month being paid for; normalised to the 1st. */
      payPeriod: string
      baseAmount: number
      bonusAmount: number
      deductionAmount: number
      occurredOn: string
      description?: string
      note?: string
      exchangeRate?: number
    }) => {
      const { data, error } = await supabase.rpc('record_salary_expense', {
        p_tenant_id: tenant.id,
        p_account_id: input.accountId,
        p_employee_id: input.employeeId,
        // An <input type="month"> yields YYYY-MM; the RPC truncates to the 1st.
        p_pay_period: `${input.payPeriod.slice(0, 7)}-01`,
        p_base: input.baseAmount,
        p_bonus: input.bonusAmount,
        p_deduction: input.deductionAmount,
        p_payment_account_id: input.paymentAccountId ?? null,
        p_payment_method: input.paymentMethod,
        p_occurred_on: input.occurredOn,
        p_description: input.description ?? null,
        p_note: input.note ?? null,
        p_exchange_rate: input.exchangeRate ?? 1,
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['sales-trend'] })
      queryClient.invalidateQueries({ queryKey: ['expense-breakdown'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })
}
