'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import type { CheckoutPayload, InvoiceRow } from '@/types'

/**
 * Checkout is two writes and one RPC:
 *   1. insert the draft invoice + its items (RLS: needs `invoices.create`)
 *   2. call post_invoice() — which recomputes totals server-side, assigns the
 *      document number, deducts stock, writes the ledger transaction and the
 *      payment, all in one database transaction.
 *
 * Totals are deliberately NOT trusted from the client. Whatever the browser
 * computed is only for display; post_invoice() sums the items itself.
 */
export function useCheckout() {
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CheckoutPayload): Promise<InvoiceRow> => {
      if (payload.lines.length === 0) throw new Error('Cart is empty')

      const { data: draft, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          tenant_id: tenant.id,
          kind: payload.kind,
          status: 'draft',
          // Left null on purpose: post_invoice() draws the real number from
          // document_sequences at issue time, so abandoned drafts burn none.
          number: null,
          contact_id: payload.contactId,
          warehouse_id: payload.warehouseId,
          currency_code: payload.currency,
          exchange_rate: payload.exchangeRate,
          payment_method: payload.method,
          // post_invoice() subtracts these from the line sum, so they belong on
          // the draft. Omitting them silently charges the undiscounted total.
          discount_amount: payload.orderDiscount ?? 0,
          shipping_amount: payload.shipping ?? 0,
          ...(payload.issueDate ? { issue_date: payload.issueDate } : {}),
          ...(payload.dueDate ? { due_date: payload.dueDate } : {}),
          notes: payload.notes ?? null,
          custom_fields: payload.customFields,
          created_by: user.id,
        })
        // `.select('id')` not `.select()`: a bare select sends `select=*`, and
        // PostgREST turns that into INSERT ... RETURNING *, which needs SELECT
        // on EVERY column — including `cost_total`, deliberately not granted to
        // `authenticated`. Narrowing the returned columns keeps the write legal.
        .select('id')
        .single()

      if (invoiceError) throw invoiceError

      const items = payload.lines.map((line, index) => ({
        tenant_id: tenant.id,
        invoice_id: draft.id,
        product_id: line.productId,
        line_no: index + 1,
        description: line.name,
        sku: line.sku,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unitPrice,
        discount_amount: line.discount,
        tax_rate: line.taxRate,
        tax_amount:
          Math.round(Math.max(line.quantity * line.unitPrice - line.discount, 0) * (line.taxRate / 100) * 10_000) /
          10_000,
        custom_fields: line.customFields,
      }))

      const { error: itemsError } = await supabase.from('invoice_items').insert(items)
      if (itemsError) {
        // Roll the orphan draft back so a failed checkout leaves nothing behind.
        await supabase.from('invoices').delete().eq('id', draft.id)
        throw itemsError
      }

      const { data: posted, error: postError } = await supabase.rpc('post_invoice', {
        p_invoice_id: draft.id,
        p_paid_amount: payload.paidAmount,
        p_method: payload.method,
      })

      if (postError) throw postError
      return posted as InvoiceRow
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['sales-trend'] })
      queryClient.invalidateQueries({ queryKey: qk.invoices(tenant.id) })
      queryClient.invalidateQueries({ queryKey: qk.products(tenant.id) })
      queryClient.invalidateQueries({ queryKey: qk.lowStock(tenant.id) })
    },
  })
}

/**
 * Void a posted entry.
 *
 * Void rather than edit: an in-place edit rewrites a ledger row that reports
 * have already been run against, so a period's P&L can change after it was read.
 * The RPC refuses invoice-linked entries — those must go through `void_invoice`
 * so stock and the balance unwind with them.
 */
export function useVoidTransaction() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { transactionId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('void_transaction', {
        p_transaction_id: input.transactionId,
        p_reason: input.reason ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Every report filters status='posted', so they all shift together.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['sales-trend'] })
      queryClient.invalidateQueries({ queryKey: ['expense-breakdown'] })
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] })
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] })
      queryClient.invalidateQueries({ queryKey: ['transactions', tenant.id] })
    },
  })
}

/** Records a standalone income/expense entry from the mobile quick-action dialog. */
export function useQuickTransaction() {
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      type: 'income' | 'expense'
      amount: number
      accountId: string
      paymentAccountId?: string | null
      method?: string
      occurredOn: string
      description?: string
      /** Receipt / invoice number for an office expense. */
      reference?: string | null
      contactId?: string | null
      currency: string
      exchangeRate: number
      customFields?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenant.id,
          type: input.type,
          status: 'posted',
          occurred_on: input.occurredOn,
          reference: input.reference ?? null,
          account_id: input.accountId,
          payment_account_id: input.paymentAccountId ?? null,
          payment_method: (input.method ?? 'cash') as never,
          currency_code: input.currency as never,
          exchange_rate: input.exchangeRate,
          amount: input.amount,
          description: input.description ?? null,
          contact_id: input.contactId ?? null,
          custom_fields: (input.customFields ?? {}) as never,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['sales-trend'] })
      queryClient.invalidateQueries({ queryKey: ['expense-breakdown'] })
      queryClient.invalidateQueries({ queryKey: ['transactions', tenant.id] })
    },
  })
}
