'use client'

/**
 * Last-resort boundary.
 *
 * `error.tsx` renders *inside* the root layout, so it cannot catch a failure in
 * the layout itself — the theme provider, the query provider, or font loading.
 * This one replaces the whole document, which is why it has to supply its own
 * `<html>` and `<body>`.
 *
 * Styling is inline on purpose. This is the screen that renders when the usual
 * assumptions have already failed, so it must not depend on the stylesheet, the
 * design tokens or any component that could be part of the problem.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="my">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0f0f12',
          color: '#fafafa',
          fontFamily: "'Padauk','Noto Sans Myanmar',system-ui,-apple-system,sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center', lineHeight: 1.9 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
            စနစ်အမှား ဖြစ်ပွားပါသည်
          </h1>
          <p style={{ fontSize: 14, color: '#a1a1aa', margin: '0 0 20px' }}>
            အပလီကေးရှင်း စတင်၍ မရပါ။ စာမျက်နှာကို ပြန်လည်ဖွင့်ပါ။
            <span style={{ display: 'block', marginTop: 4 }}>
              The application failed to start. Please reload the page.
            </span>
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 15,
              fontWeight: 600,
              color: '#fff',
              background: '#2563eb',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            ထပ်မံကြိုးစားရန် / Try again
          </button>

          {error.digest && (
            <p style={{ marginTop: 14, fontSize: 11, fontFamily: 'ui-monospace,monospace', color: '#71717a' }}>
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
