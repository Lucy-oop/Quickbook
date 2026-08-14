import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/session'

/**
 * Root decides where a visitor belongs:
 *   no session            -> /login
 *   session, no business  -> /onboarding
 *   session + business    -> /dashboard
 */
export default async function RootPage() {
  const session = await getSessionContext()
  redirect(session ? '/dashboard' : '/login')
}
