import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

// `/accept-invite` must be listed explicitly: it does not start with `/invite`,
// so an invited cashier with no account was being bounced to /login by the
// catch-all below before they could ever redeem their token.
const PUBLIC_PATHS = [
  '/login', '/signup', '/auth', '/forgot-password', '/invite', '/accept-invite',
  '/api/team/accept-invite',
]

/**
 * Refreshes the Supabase session cookie on every request and keeps signed-out
 * users out of the app shell.
 *
 * This is a routing concern, not a security boundary — the security boundary is
 * RLS. A forged cookie gets you a redirect at worst and an empty result set at
 * best; it never gets you another tenant's rows.
 */
export async function middleware(request: NextRequest) {
  // A layout cannot see which path it is rendering, and the subscription guard
  // in `(app)/layout.tsx` needs it to know whether the request is for one of the
  // escape-hatch routes. Forwarding it as a request header is the supported way
  // to get it there without a second round trip.
  const forwarded = new Headers(request.headers)
  forwarded.set('x-pathname', request.nextUrl.pathname)

  let response = NextResponse.next({ request: { headers: forwarded } })

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        // Rebuilt with the same forwarded headers — dropping them here would
        // make the pathname vanish on exactly the requests that refresh the
        // session, which is most of them.
        response = NextResponse.next({ request: { headers: forwarded } })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Must be getUser(), not getSession(): only getUser() revalidates the JWT
  // against Supabase Auth.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  if (!user && !isPublic) {
    // An API route must answer in JSON. Redirecting it to /login sends a 307
    // that `fetch` follows automatically, so the caller gets 200 OK carrying an
    // HTML login page — `response.json()` then throws, and the client reports
    // whatever its generic failure message is. For /api/team/invite that read as
    // "the invitation could not be sent", pointing at the email provider when
    // the real problem was an expired session.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။ (Your session has expired — please sign in again.)',
        },
        { status: 401 },
      )
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation — those don't
     * need a session refresh and would triple the middleware invocations.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)',
  ],
}
