'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import type { ContactKind, ContactRow } from '@/types'

/** Active contacts of one kind, for pickers. */
export function useContacts(kind?: ContactKind) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: [...qk.contacts(tenant.id), kind ?? 'all'],
    queryFn: async (): Promise<ContactRow[]> => {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name')
        .limit(500)

      if (kind) query = query.eq('kind', kind)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ContactRow[]
    },
  })
}

/** Minimal create, for the "add customer without leaving the form" path. */
export function useCreateContact() {
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; phone?: string; kind: ContactKind }): Promise<ContactRow> => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenant.id,
          kind: input.kind,
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          created_by: user.id,
        })
        .select('*')
        .single()

      if (error) throw error
      return data as ContactRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', tenant.id] })
    },
  })
}
