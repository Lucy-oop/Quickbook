import { CompanyMark } from '@/components/brand/company-mark'

/**
 * Auth screens get no app chrome — no sidebar, no tenant, no session.
 *
 * The company lockup lives here rather than inside each form, so login and
 * signup cannot drift apart on branding.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-muted/40 px-4 py-8">
      <CompanyMark className="mb-6" size={64} />

      <div className="w-full max-w-sm">{children}</div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        မြန်မာနိုင်ငံရှိ လုပ်ငန်းများအတွက် စီမံခန့်ခွဲမှုစနစ်
      </p>
    </div>
  )
}
