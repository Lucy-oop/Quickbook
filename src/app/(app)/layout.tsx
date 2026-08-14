import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSessionContext, listTenantOptions } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { SessionProvider } from '@/components/providers/session-provider'
import { I18nProvider } from '@/lib/i18n'
import { AppShell } from '@/components/layout/app-shell'

/**
 * Every authenticated route hangs off this layout.
 *
 * The session — user, tenant, role and the effective permission set — is
 * resolved once here on the server and handed to the client through context.
 * Client components never re-derive permissions from scratch, and every query
 * they issue is still filtered by RLS on the way out of Postgres.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext()

  if (!session) {
    // No session context has two distinct causes, and they route differently:
    // not signed in at all -> /login; signed in but not a member of any
    // business yet -> /onboarding. Collapsing them would loop forever.
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    redirect(user ? '/onboarding' : '/login')
  }

  // ── Subscription gate ────────────────────────────────────────────────
  // An expired business is redirected to the paywall — except on the routes it
  // needs to get *out* of that state. Locking the owner out of settings and the
  // tenant switcher would trap them: no way to pay, no way to reach another
  // business they belong to, no way to export their own data. A paywall that
  // cannot be escaped is a hostage situation, not a prompt.
  if (session.access.isExpired) {
    const pathname = (await headers()).get('x-pathname')

    if (!pathname) {
      // Without the path we cannot tell whether this IS the paywall, and
      // redirecting blind would send /billing/subscribe to itself forever.
      // Fail open: this guard is a commercial prompt, not a security boundary —
      // RLS is — so the cost of letting a lapsed tenant through is far lower
      // than trapping every tenant in a redirect loop.
      console.warn('[subscription guard] x-pathname missing; skipping redirect')
    } else {
      const escapeHatch =
        pathname.startsWith('/billing')
        || pathname.startsWith('/settings')
        || pathname.startsWith('/forbidden')

      if (!escapeHatch) redirect('/billing/subscribe')
    }
  }

  const tenants = await listTenantOptions()

  return (
    <SessionProvider session={session}>
      <I18nProvider locale={session.locale}>
        <AppShell tenants={tenants}>{children}</AppShell>
      </I18nProvider>
    </SessionProvider>
  )
}
