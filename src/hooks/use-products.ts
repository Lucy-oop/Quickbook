'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import type { ProductView } from '@/types'

/**
 * Product search for the POS grid.
 *
 * Reads `v_products`, never `products` — the view is where `cost_price` gets
 * masked for roles without `products.read_cost`, and SELECT on the base table
 * is not granted to `authenticated` at all.
 */
export function useProducts(search: string, categoryId?: string | null) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: [...qk.products(tenant.id, search), categoryId ?? 'all'],
    queryFn: async (): Promise<ProductView[]> => {
      let query = supabase
        .from('v_products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name')
        .limit(60)

      if (categoryId) query = query.eq('category_id', categoryId)

      const term = search.trim()
      if (term) {
        // Barcode/SKU are exact-ish; name uses trigram-backed ILIKE.
        query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.eq.${term}`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ProductView[]
    },
    placeholderData: (prev) => prev,
  })
}

/** Exact barcode lookup — what the scanner calls on each scan. */
export function useProductByBarcode() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return async (barcode: string): Promise<ProductView | null> => {
    const { data, error } = await supabase
      .from('v_products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('barcode', barcode.trim())
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    return (data as ProductView) ?? null
  }
}

export function useProductCategories() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: ['product-categories', tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id,name,name_my,color,sort_order')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * Creates a category inline.
 *
 * Nothing else in the app can create one — no settings screen, no seed — so
 * without this the category picker is permanently empty and the field is
 * impossible to fill.
 */
export function useCreateProductCategory() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert({ tenant_id: tenant.id, name: name.trim() })
        .select('id,name,name_my,color,sort_order')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories', tenant.id] })
    },
  })
}

/**
 * Resolves the warehouse a write should target, for the tenant that is active
 * *now*.
 *
 * The query below is already tenant-scoped and tenant-keyed, so a stale list
 * should not survive a tenant switch. But every caller previously reached for
 * `warehouses.data?.[0]?.id` directly, and that pattern has no way to notice if
 * the data it is holding belongs to a different business — which is how 45 rows
 * ended up pointing at another tenant's warehouse.
 *
 * This re-checks `tenant_id` on the row it returns, so a mismatched cache
 * produces null (a visible "no warehouse configured" error) instead of a silent
 * cross-tenant write. The composite FKs added in 20260812000800 are the real
 * backstop; this turns a database error into a comprehensible one.
 */
export function useDefaultWarehouseId(): string | null {
  const { tenant } = useSession()
  const warehouses = useWarehouses()

  const owned = (warehouses.data ?? []).filter((w) => w.tenant_id === tenant.id)
  return owned.find((w) => w.is_default)?.id ?? owned[0]?.id ?? null
}

export function useWarehouses() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.warehouses(tenant.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })
}
