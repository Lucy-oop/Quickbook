'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { COMPANY } from '@/lib/billing-accounts'
import { BrandMonogram } from '@/components/brand/brand-monogram'

/**
 * The company lockup: mark above the name.
 *
 * Source of the mark is `COMPANY.logoSrc`:
 *  - a path — loaded through `next/image`, falling back to the inline monogram
 *    if the file is missing or fails to decode, so a bad deploy degrades to
 *    something designed instead of a torn-image icon.
 *  - null — draws the monogram directly and makes no request at all. That is the
 *    correct default when there is no artwork: the earlier version requested
 *    `/logo.png` unconditionally and logged a failed request on every page load
 *    while the file was absent.
 *
 * `next/image` earns its place here specifically because the supplied artwork is
 * 1280×1280 and displayed at 56–64px. Serving the original would ship ~47 KB to
 * paint a thumbnail; the optimiser resizes and re-encodes to WebP/AVIF. (A small,
 * correctly-sized asset would not need it.)
 */
export function CompanyMark({
  size = 56,
  showName = true,
  className,
  priority = false,
}: {
  size?: number
  showName?: boolean
  className?: string
  /** Set on the auth screens, where the mark is the largest thing above the fold. */
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const useImage = Boolean(COMPANY.logoSrc) && !failed

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {useImage ? (
        <Image
          src={COMPANY.logoSrc as string}
          alt={COMPANY.name}
          width={size}
          height={size}
          priority={priority}
          // Retina: request 2× so the mark stays crisp on a phone screen.
          quality={90}
          className="rounded-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <BrandMonogram size={size} title={COMPANY.name} />
      )}

      {showName && (
        <span className="text-center text-base font-semibold tracking-tight">
          {COMPANY.name}
        </span>
      )}
    </div>
  )
}
