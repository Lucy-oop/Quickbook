import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-hairline-strong text-foreground',

        /* Semantic tints. Tinted fill + matching text + faint ring reads as a
           status at a glance while staying quiet enough to sit in a dense table.
           Each pairs a 600 text step for light with a 400 for dark, because the
           400s that carry on #0F0F12 fall below contrast on white. */
        success:
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        warning:
          'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        danger:
          'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400',
        info:
          'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
