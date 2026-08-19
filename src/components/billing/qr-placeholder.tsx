/**
 * Stand-in for a payment QR that has not been supplied.
 *
 * Drawn inline rather than pointing at a file in `/public/qr/`: a placeholder
 * image is still a network request, and if that file is also missing it 404s on
 * every render — trading one missing asset for another. This costs nothing and
 * cannot fail.
 *
 * It is deliberately NOT scannable. Three finder squares and a scatter of
 * modules read as "a QR belongs here" at a glance, while a camera gets nothing —
 * which is correct, because pointing a real scanner at a decorative code and
 * having it resolve to something would be far worse than it simply not working.
 */
export function QrPlaceholder({
  size = 112,
  label,
}: {
  size?: number
  /** Rendered under the code, e.g. "Add KBZPay QR". */
  label?: string
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-hairline-strong p-2"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 32 32"
        className="text-muted-foreground/50"
        role="img"
        aria-label={label ?? 'QR code placeholder'}
      >
        <g fill="currentColor">
          {/* Finder squares: the three corners that make it read as a QR. */}
          {[
            [0, 0],
            [21, 0],
            [0, 21],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="11" height="11" rx="1.5" opacity="0.35" />
              <rect x={x + 3} y={y + 3} width="5" height="5" rx="0.75" />
            </g>
          ))}
          {/* Fixed module scatter — not random, so it does not change per render. */}
          {[
            [14, 3], [17, 6], [14, 9], [20, 12], [14, 14], [17, 17],
            [23, 17], [26, 20], [14, 20], [20, 23], [14, 26], [23, 26], [26, 14],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" rx="0.5" opacity="0.5" />
          ))}
        </g>
      </svg>

      {label && (
        <span className="px-1 text-center text-[10px] leading-tight text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  )
}
