import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Server Supabase client for Server Components, Route Handlers and Server
 * Actions. Still the anon key: RLS is the security boundary, not the runtime.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called from a Server Component: middleware refreshes the session
          // instead, so this is safe to swallow.
        }
      },
    },
  })
}

/**
 * Service-role client. BYPASSES RLS — never import this into anything that runs
 * near a request handler without checking the caller's permissions yourself.
 * Intended for webhooks, scheduled exchange-rate sync, and admin backfills.
 */
export function createServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')

  return createServerClient<Database>(supabaseUrl(), key, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
}

/**
 * Service-role client for the Auth **admin** API (`auth.admin.createUser`, …).
 *
 * Separate from `createServiceSupabase()` because the admin endpoints must not
 * inherit a cookie jar or a refresh loop: `createServerClient` is built to track
 * a user session, and letting it persist one here would mean an admin call could
 * pick up whichever session happened to be in scope. Also BYPASSES RLS.
 */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')

  return createClient<Database>(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
