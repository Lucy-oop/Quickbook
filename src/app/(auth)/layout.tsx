import { Building2 } from 'lucide-react'

/** Auth screens get no app chrome — no sidebar, no tenant, no session. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-muted/40 px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary">
          <Building2 className="size-5 text-primary-foreground" />
        </span>
        <span className="text-lg font-semibold">Myanmar ERP</span>
      </div>

      <div className="w-full max-w-sm">{children}</div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        မြန်မာနိုင်ငံရှိ လုပ်ငန်းများအတွက် စီမံခန့်ခွဲမှုစနစ်
      </p>
    </div>
  )
}
