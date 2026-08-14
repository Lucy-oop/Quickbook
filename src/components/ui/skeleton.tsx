import { cn } from '@/lib/utils'

/**
 * Loading placeholder.
 *
 * A travelling highlight rather than `animate-pulse`: on a dark ground a pulsing
 * block reads as a flicker or a rendering fault, while a sweep reads as work in
 * progress. The highlight is skipped under `prefers-reduced-motion` (handled
 * globally in globals.css), leaving a plain block — which is still a correct
 * placeholder.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-md bg-muted/60', className)}
      // A placeholder is not content; announcing it interrupts the screen reader
      // for something that conveys nothing.
      aria-hidden
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.07] to-transparent" />
    </div>
  )
}

export { Skeleton }
