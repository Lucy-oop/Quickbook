/**
 * Environment access with an error that says what to do.
 *
 * Supabase's own failure for a missing key is "Your project's URL and Key are
 * required to create a Supabase client!", which does not say *which* variable,
 * *which* file, or where to get the value. These helpers do.
 *
 * Only NEXT_PUBLIC_* vars may be read here — Next.js inlines those at build
 * time, so they must be referenced as literal `process.env.NEXT_PUBLIC_FOO`
 * rather than looked up dynamically, or the replacement never happens.
 */

const SETUP_HINT = [
  'Create `.env.local` in the project root (copy `.env.example`), then restart `npm run dev`.',
  '',
  '  Local Supabase:  npx supabase start   — prints "API URL" and "anon key"',
  '  Hosted project:  https://supabase.com/dashboard/project/_/settings/api',
].join('\n')

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '' || value.includes('your-')) {
    throw new Error(
      `Missing environment variable ${name}.\n\n${SETUP_HINT}\n`,
    )
  }
  return value
}

export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ktetyldwbuezpbrtorrm.supabase.co'
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

/**
 * True when both public Supabase vars look usable. Lets a page render a setup
 * screen instead of throwing a stack trace at someone who has just cloned the
 * repo and has no idea what an anon key is.
 */
export function isSupabaseConfigured(): boolean {
  try {
    supabaseUrl()
    supabaseAnonKey()
    return true
  } catch {
    return false
  }
}
