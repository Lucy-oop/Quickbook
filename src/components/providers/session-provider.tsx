'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SessionContext as Session } from '@/types'

const SessionCtx = createContext<Session | null>(null)

/**
 * The server layout resolves the session once (lib/session.ts) and hands it
 * down. Nothing here re-fetches it, so every client component reads the same
 * permission set the server rendered with.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: Session
  children: ReactNode
}) {
  const value = useMemo(() => session, [session])
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession(): Session {
  const ctx = useContext(SessionCtx)
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>. Is this component under (app)/layout.tsx?')
  }
  return ctx
}

/** Safe variant for components that also render on public pages. */
export function useOptionalSession(): Session | null {
  return useContext(SessionCtx)
}
