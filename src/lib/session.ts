import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { ACTIVE_TENANT_COOKIE } from '@/lib/session.shared'
import type { Permission, SessionContext, SubscriptionAccess, TenantOption } from '@/types'

export { ACTIVE_TENANT_COOKIE }

/**
 * Resolves the signed-in user, their active business, and the effective
 * permission set for that business — in one round trip, cached per request.
 *
 * The permission set computed here is a *convenience for rendering*. It is not
 * the security boundary: the database recomputes the same thing inside
 * public.has_permission() for every row it returns.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createServerSupabase()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const cookieStore = await cookies()
  const requestedTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) return null

  const { data: memberships } = await supabase
    .from('memberships')
    .select('*, role:roles(*), tenant:tenants(*)')
    .eq('user_id', authUser.id)
    .eq('status', 'active')

  if (!memberships?.length) return null

  const membership =
    memberships.find((m) => m.tenant_id === requestedTenantId) ??
    memberships.find((m) => m.tenant_id === profile.last_tenant_id) ??
    memberships[0]

  const role = (membership as any).role
  const tenant = (membership as any).tenant
  if (!role || !tenant) return null

  const { data: rolePerms } = await supabase
    .from('roles_permissions')
    .select('permission_key')
    .eq('role_id', role.id)

  const overrides = membership.permission_overrides ?? { granted: [], revoked: [] }
  const granted = new Set<string>(rolePerms?.map((r) => r.permission_key) ?? [])

  for (const key of overrides.revoked ?? []) granted.delete(key)
  for (const key of overrides.granted ?? []) granted.add(key)

  return {
    user: profile,
    tenant,
    membership,
    role,
    permissions: [...granted] as Permission[],
    isOwner: role.is_owner_role === true,
    warehouseScope: membership.warehouse_scope ?? [],
    locale: (profile.locale ?? tenant.default_locale ?? 'my') as SessionContext['locale'],
    access: resolveAccess(tenant),
  }
})

/**
 * Mirrors `public.tenant_access_state()` exactly.
 *
 * Deliberately computed from columns already fetched with the tenant rather than
 * by calling the RPC: this runs on every authenticated request, and the rule is
 * three comparisons. The SQL function remains the authority for anything
 * server-side that is not this hot path, and the two must be changed together.
 */
export function resolveAccess(tenant: {
  subscription_status: string | null
  trial_ends_at: string | null
  plan_expires_at?: string | null
}): SubscriptionAccess {
  const status = tenant.subscription_status ?? 'trialing'
  const now = Date.now()

  // A paid plan waiting on slip review keeps working — see the type doc.
  if (status === 'pending_approval') {
    return { state: 'pending_approval', isExpired: false, trialDaysLeft: null, endsAt: null }
  }

  if (status === 'active') {
    const endsAt = tenant.plan_expires_at ?? null
    const live = !endsAt || new Date(endsAt).getTime() > now
    return {
      state: live ? 'ok' : 'expired',
      isExpired: !live,
      trialDaysLeft: null,
      endsAt,
    }
  }

  if (status === 'trialing') {
    const endsAt = tenant.trial_ends_at ?? null
    // A missing trial date reads as open, not expired. Failing closed on absent
    // data would lock out every tenant created before trials were stamped.
    if (!endsAt) {
      return { state: 'trialing', isExpired: false, trialDaysLeft: null, endsAt: null }
    }
    const msLeft = new Date(endsAt).getTime() - now
    return msLeft > 0
      ? {
          state: 'trialing',
          isExpired: false,
          trialDaysLeft: Math.max(0, Math.floor(msLeft / 86_400_000)),
          endsAt,
        }
      : { state: 'expired', isExpired: true, trialDaysLeft: 0, endsAt }
  }

  // 'expired', 'cancelled', or anything the CHECK constraint would now reject.
  return { state: 'expired', isExpired: true, trialDaysLeft: null, endsAt: tenant.trial_ends_at ?? null }
}

/** Use in layouts/pages that must not render for signed-out or tenant-less users. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext()
  if (!session) redirect('/login')
  return session
}

/**
 * Server-side permission gate. Throws rather than returning false so a missed
 * check fails closed.
 */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const session = await requireSession()
  if (!session.isOwner && !session.permissions.includes(permission)) {
    redirect('/forbidden')
  }
  return session
}

export async function listTenantOptions(): Promise<TenantOption[]> {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('memberships')
    .select('status, tenant:tenants(id,name,slug,logo_url,base_currency,business_type), role:roles(key,name_en,name_my)')
    .eq('status', 'active')

  return (data ?? []).map((row: any) => ({
    tenant: row.tenant,
    role: row.role,
    status: row.status,
  }))
}
