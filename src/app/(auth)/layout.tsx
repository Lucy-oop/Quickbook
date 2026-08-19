import { CompanyMark } from '@/components/brand/company-mark'

/**
 * Auth screens get no app chrome — no sidebar, no tenant, no session.
 *
 * The company lockup lives here rather than inside each form, so login and
 * signup cannot drift apart on branding.
 *
 * Layout notes:
 *  - Three bands, not one centred block. The card centres in whatever space is
 *    left between the lockup and the footer, so a short form (login) sits
 *    comfortably centred while a long one (signup) scrolls without shoving the
 *    footer off-screen or crowding it.
 *  - `flex-1` + `justify-center` beats a single `justify-center` parent: with one
 *    centred column the footer travels with the content, which is what produced
 *    the bottom-heavy crowding on tall forms.
 *  - a11y / ergonomics: `pb-safe-b` on the footer clears the iOS and Android
 *    gesture bars, which otherwise sit on top of the last line of text.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/40 px-4">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-8 sm:py-10">
        <CompanyMark size={64} priority />
        {children}
      </main>

      <footer className="mx-auto w-full max-w-sm pb-safe-b pt-4 text-center">
        <p className="text-xs leading-relaxed text-muted-foreground">
          မြန်မာနိုင်ငံရှိ လုပ်ငန်းများအတွက် စီမံခန့်ခွဲမှုစနစ်
        </p>
        {/* text-muted-foreground, not a /60 or /70 alpha of it. The token is the
            one tuned to clear AA against both themes' backgrounds; fading it is
            what drops small text under the threshold. */}
        <p className="mt-1 text-xs text-muted-foreground">
          Powered by AD Digital Service
        </p>
      </footer>
    </div>
  )
}
