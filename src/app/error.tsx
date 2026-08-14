'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Root error boundary for the App Router.
 *
 * Without one, an uncaught render error leaves the browser showing
 * "missing required error components, refreshing…" and looping — a message that
 * tells the shop owner nothing and the developer almost nothing.
 *
 * Deliberately does NOT use `useI18n`. This has to render when something has
 * already gone wrong, including a failure inside a provider, so it cannot depend
 * on context being present. Strings are inline and bilingual for the same reason.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The server strips messages from production errors and leaves only
    // `digest`, which is what correlates this screen with the server log.
    console.error('[app error boundary]', error.digest ?? '', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
          </span>
          <CardTitle className="text-lg">တစ်ခုခု မှားယွင်းသွားပါသည်</CardTitle>
          <CardDescription className="leading-relaxed">
            စာမျက်နှာ ပြသရာတွင် အမှားဖြစ်ပွားပါသည်။ ထပ်မံကြိုးစားပါ။
            <span className="mt-1 block">Something went wrong while loading this page.</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2">
          <Button className="h-12 w-full gap-2" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden />
            ထပ်မံကြိုးစားရန် / Try again
          </Button>
          <Button asChild variant="outline" className="h-12 w-full">
            <Link href="/dashboard">ပင်မစာမျက်နှာ / Go to dashboard</Link>
          </Button>

          {/* The one thing worth quoting to whoever is looking at the logs. */}
          {error.digest && (
            <p className="pt-1 text-center font-mono text-[11px] text-muted-foreground">
              ref: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
