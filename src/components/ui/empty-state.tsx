import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * An empty panel is the first thing a new business sees, so it carries the
 * next action rather than just reporting absence. `action` is omitted when the
 * member lacks the permission to perform it — a cashier reads "no sales yet"
 * without being offered an import button they cannot use.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: { href: string; label: string; icon?: LucideIcon }
  className?: string
}) {
  const ActionIcon = action?.icon
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-10 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </span>

      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="mx-auto max-w-64 text-xs text-muted-foreground">{hint}</p>}
      </div>

      {action && (
        <Button asChild size="sm" className="gap-1.5">
          <Link href={action.href}>
            {ActionIcon && <ActionIcon className="size-3.5" />}
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  )
}
