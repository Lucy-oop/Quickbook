'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { COMPANY } from '@/lib/billing-accounts'

/**
 * The company lockup: logo above the name.
 *
 * The logo falls back to an "A/D" monogram if `/logo.png` is missing or fails to
 * load. That is not defensive padding — the file genuinely is not in `/public`
 * yet, and a broken-image icon at the top of the sign-in page is a worse first
 * impression than a plain monogram. Drop the file in and it takes over with no
 * code change.
 *
 * `<img>` rather than `next/image`: this is a single small asset above the fold
 * with a known size, so the optimiser buys nothing, and `onError` fallback is
 * simpler without it.
 */
export function CompanyMark({
  size = 56,
  showName = true,
  className,
}: {
  size?: number
  showName?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {failed ? (
        <span
          className="flex items-center justify-center rounded-full border-2 border-amber-500/70 font-serif text-amber-600 dark:text-amber-400"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
          aria-hidden
        >
          A/D
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt={COMPANY.name}
          width={size}
          height={size}
          className="rounded-full object-contain"
          onError={() => setFailed(true)}
        />
      )}

      {showName && (
        <span className="text-center text-base font-semibold tracking-tight">
          {COMPANY.name}
        </span>
      )}
    </div>
  )
}
