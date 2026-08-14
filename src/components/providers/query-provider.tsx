'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Myanmar mobile networks are often slow and lossy: keep data warm,
            // avoid refetch storms, and retry a couple of times.
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            retry: 2,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: { retry: 1 },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

/** Central query-key factory — every key is tenant-scoped so switching
 *  businesses invalidates cleanly instead of leaking one tenant's cache. */
export const qk = {
  dashboard: (tenantId: string, from: string, to: string) => ['dashboard', tenantId, from, to] as const,
  salesTrend: (tenantId: string, from: string, to: string) => ['sales-trend', tenantId, from, to] as const,
  topProducts: (tenantId: string, from: string, to: string) => ['top-products', tenantId, from, to] as const,
  products: (tenantId: string, search?: string) => ['products', tenantId, search ?? ''] as const,
  product: (tenantId: string, id: string) => ['product', tenantId, id] as const,
  invoices: (tenantId: string, filters?: unknown) => ['invoices', tenantId, filters ?? {}] as const,
  invoice: (tenantId: string, id: string) => ['invoice', tenantId, id] as const,
  contacts: (tenantId: string, search?: string) => ['contacts', tenantId, search ?? ''] as const,
  accounts: (tenantId: string) => ['accounts', tenantId] as const,
  warehouses: (tenantId: string) => ['warehouses', tenantId] as const,
  lowStock: (tenantId: string) => ['low-stock', tenantId] as const,
  customFields: (tenantId: string, entity: string) => ['custom-fields', tenantId, entity] as const,
  members: (tenantId: string) => ['members', tenantId] as const,
  auditLog: (tenantId: string, page: number) => ['audit-log', tenantId, page] as const,
  exchangeRates: (tenantId: string) => ['exchange-rates', tenantId] as const,
  profitLoss: (tenantId: string, from: string, to: string) => ['profit-loss', tenantId, from, to] as const,
  cashFlow: (tenantId: string, from: string, to: string) => ['cash-flow', tenantId, from, to] as const,
  arAp: (tenantId: string, kind: string) => ['ar-ap', tenantId, kind] as const,
  salesReport: (tenantId: string, from: string, to: string) => ['sales-report', tenantId, from, to] as const,
  stockValuation: (tenantId: string, warehouseId: string | null) =>
    ['stock-valuation', tenantId, warehouseId] as const,
  expenses: (tenantId: string, from: string, to: string) => ['expenses', tenantId, from, to] as const,
  income: (tenantId: string, from: string, to: string) => ['income', tenantId, from, to] as const,
  expenseBreakdown: (tenantId: string, from: string, to: string) =>
    ['expense-breakdown', tenantId, from, to] as const,
  employees: (tenantId: string) => ['employees', tenantId] as const,
}
