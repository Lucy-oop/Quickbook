'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/**
 * Browser Supabase client. Uses the anon key — every query it makes is subject
 * to the RLS policies in supabase/migrations/20260810000500_rls.sql.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
}

let browserClient: ReturnType<typeof createClient> | undefined

/** Singleton so React Query and the realtime channels share one socket. */
export function getSupabaseBrowserClient() {
  browserClient ??= createClient()
  return browserClient
}
