/**
 * The A/D monogram, drawn rather than fetched.
 *
 * This is the default mark. It costs no network request, so there is no 404 in
 * the console and no broken-image flash before an `onError` handler swaps
 * something in — which is what a `<img src="/logo.png">` pointing at a file that
 * is not there produces on every single page load.
 *
 * It is an approximation of the real gold lockup, not a substitute for it. Set
 * `COMPANY.logoSrc` once the artwork is in `/public` and `CompanyMark` uses that
 * instead; this stays as the fallback for when the file fails to load.
 *
 * Pure SVG with no external font: `font-family` here would resolve differently
 * on every device, and a monogram that reflows is worse than one that is drawn.
 */
export function BrandMonogram({
  size = 64,
  className,
  title = 'AD Digital Service',
}: {
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        {/* Two-stop gold with a lighter core, which is what reads as metallic at
            small sizes — a flat fill looks like mustard. */}
        <linearGradient id="ad-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C36B" />
          <stop offset="45%" stopColor="#F5E39B" />
          <stop offset="100%" stopColor="#C9A24A" />
        </linearGradient>
      </defs>

      <circle cx="64" cy="64" r="59" fill="none" stroke="url(#ad-gold)" strokeWidth="4" />

      {/* Letterforms as paths, so they are identical everywhere. */}
      <g fill="url(#ad-gold)">
        {/* A */}
        <path d="M46.5 30 L30 84 h8.6 l3.9-13.4h14.8L61.2 84h8.8L53.4 30h-6.9Zm-1.6 32.6 5.1-17.7 5.1 17.7H44.9Z" />
        {/* Slash */}
        <path d="M84.6 26.5 3.6 0 39.4 101.5 43 103 84.6 26.5Z" transform="translate(0 0)" opacity="0" />
        <rect x="61" y="22" width="4.4" height="84" rx="2.2" transform="rotate(16 63.2 64)" />
        {/* D */}
        <path d="M74 44v40h15.8c12.4 0 20.2-7.7 20.2-20s-7.8-20-20.2-20H74Zm8.4 7.2h6.9c8 0 12.4 4.8 12.4 12.8s-4.4 12.8-12.4 12.8h-6.9V51.2Z" />
      </g>
    </svg>
  )
}
