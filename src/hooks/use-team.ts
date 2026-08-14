'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import type { MembershipRow, MembershipStatus, PermissionRow, RoleRow, UserRow } from '@/types'

export type TeamMember = MembershipRow & {
  role: Pick<RoleRow, 'id' | 'key' | 'name_en' | 'name_my' | 'is_owner_role' | 'rank'> | null
  user: Pick<UserRow, 'id' | 'full_name' | 'email' | 'phone' | 'avatar_url'> | null
}

export function useTeamMembers() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: qk.members(tenant.id),
    queryFn: async (): Promise<TeamMember[]> => {
      // `users` is reached through `memberships_user_id_fkey` by name: this table
      // also has `invited_by -> users`, and an unqualified `users(...)` embed is
      // ambiguous (PGRST201). `invited_by` is deliberately not embedded — the
      // team list shows who a membership is *for*, not who sent it.
      const { data, error } = await supabase
        .from('memberships')
        .select(`
          *,
          role:roles(id,key,name_en,name_my,is_owner_role,rank),
          user:users!memberships_user_id_fkey(id,full_name,email,phone,avatar_url)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as TeamMember[]
    },
  })
}

export function useTenantRoles() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: ['roles', tenant.id],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('rank')
      if (error) throw error
      return (data ?? []) as RoleRow[]
    },
    staleTime: 5 * 60_000,
  })
}

/** The catalogue, so the override editor can list every grantable permission. */
export function usePermissionCatalogue() {
  const supabase = getSupabaseBrowserClient()

  return useQuery({
    queryKey: ['permission-catalogue'],
    queryFn: async (): Promise<PermissionRow[]> => {
      const { data, error } = await supabase.from('permissions').select('*').order('module')
      if (error) throw error
      return (data ?? []) as PermissionRow[]
    },
    staleTime: Infinity,
  })
}

export function useInviteMember() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      roleKey: string
      email?: string | null
      phone?: string | null
      warehouseScope?: string[]
    }) => {
      // invite_member() re-checks `members.invite` server-side and refuses to
      // mint an owner unless the caller is already one.
      const { data, error } = await supabase.rpc('invite_member', {
        p_tenant_id: tenant.id,
        p_role_key: input.roleKey,
        p_email: input.email ?? null,
        p_phone: input.phone ?? null,
        p_warehouse_scope: input.warehouseScope ?? [],
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.members(tenant.id) }),
  })
}

/**
 * Codes the invite endpoint can return. `EMAIL_NOT_FOUND` is the one the UI
 * treats specially — it means the address itself is wrong, which is worth a
 * blocking dialog rather than a toast that scrolls away.
 */
export type InviteErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'BAD_REQUEST'
  | 'INVALID_SYNTAX' | 'EMAIL_NOT_FOUND'
  | 'ALREADY_MEMBER' | 'ALREADY_INVITED'
  | 'SEND_FAILED' | 'NOT_CONFIGURED'
  | 'NETWORK'

export class InviteError extends Error {
  constructor(
    readonly code: InviteErrorCode,
    message: string,
    /** Technical cause, for the expandable detail line — never the whole message. */
    readonly detail?: string,
  ) {
    super(message)
    this.name = 'InviteError'
  }
}

interface InviteResponse {
  success: boolean
  message: string
  code?: InviteErrorCode
  detail?: string
  membershipId?: string
  emailSent?: boolean
}

/**
 * Email invitations go through `/api/team/invite` rather than straight to the
 * RPC: the MX lookup needs `node:dns` and the provider key must never reach the
 * browser. Phone invitations still use {@link useInviteMember}, which has no
 * email to verify or send.
 */
export function useInviteByEmail() {
  const { tenant } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      email: string
      roleKey: string
      fullName?: string
      warehouseScope?: string[]
    }): Promise<InviteResponse> => {
      let response: Response
      try {
        response = await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: tenant.id, ...input }),
        })
      } catch {
        throw new InviteError(
          'NETWORK',
          'ကွန်ရက်ချိတ်ဆက်မှု မရပါ။ (Could not reach the server — check your connection.)',
        )
      }

      // A crashed route — or one that redirected to an HTML page — hands back
      // something that is not JSON.
      const body: InviteResponse | null = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        // No parseable body means the response was not from the route at all.
        // Blaming the email provider here would send the owner hunting for a
        // problem with the address; a 401/403 is a session problem.
        if (!body) {
          const authProblem = response.status === 401 || response.status === 403
          throw new InviteError(
            authProblem ? 'UNAUTHENTICATED' : 'SEND_FAILED',
            authProblem
              ? 'အကောင့်ဝင်မှု သက်တမ်းကုန်ဆုံးပါပြီ။ ပြန်လည်ဝင်ပါ။ (Your session expired — please sign in again.)'
              : 'ဆာဗာမှ တုံ့ပြန်မှု မမှန်ကန်ပါ။ (The server returned an unexpected response.)',
            `HTTP ${response.status}`,
          )
        }

        throw new InviteError(
          body.code ?? 'SEND_FAILED',
          body.message ?? 'ဖိတ်ခေါ်လွှာ ပို့၍ မရပါ။ (The invitation could not be sent.)',
          body.detail,
        )
      }

      return body
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.members(tenant.id) }),
  })
}

export function useSetMemberStatus() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { membershipId: string; status: MembershipStatus }) => {
      const { data, error } = await supabase.rpc('set_member_status', {
        p_membership_id: input.membershipId,
        p_status: input.status,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.members(tenant.id) }),
  })
}

/** Changes a member's role, or their per-user permission grants/revokes. */
export function useUpdateMember() {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      membershipId: string
      roleId?: string
      overrides?: { granted: string[]; revoked: string[] }
      warehouseScope?: string[]
    }) => {
      // Typed as a partial row (not Record<string, unknown>) so PostgREST's
      // excess-property check can still catch a mistyped column name.
      const patch: Partial<MembershipRow> = {}
      if (input.roleId) patch.role_id = input.roleId
      if (input.overrides) patch.permission_overrides = input.overrides
      if (input.warehouseScope) patch.warehouse_scope = input.warehouseScope

      const { data, error } = await supabase
        .from('memberships')
        .update(patch)
        .eq('id', input.membershipId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.members(tenant.id) }),
  })
}
