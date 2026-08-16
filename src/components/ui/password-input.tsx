'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Password field with a reveal toggle.
 *
 * One component rather than the same markup in login, signup and accept-invite —
 * the three had four password inputs between them and no way to check a typo,
 * which matters most on a phone keyboard entering a password you just invented.
 *
 * The toggle is a real `<button type="button">`: inside a form, a bare `<button>`
 * defaults to `type="submit"` and revealing the password would submit the form.
 */
export interface PasswordInputProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'type'> {
  /** Accessible labels for the toggle. */
  showLabel?: string
  hideLabel?: string
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel = 'Show password', hideLabel = 'Hide password', disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          // Room for the toggle so a long password never runs under the icon.
          className={cn('pr-11', className)}
          disabled={disabled}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          // Not in the tab order: it sits between the password and the submit
          // button, and a keyboard user tabbing to submit should not land here.
          // Still reachable by pointer, and by screen readers via the label.
          tabIndex={-1}
          className={cn(
            'absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center',
            'rounded-md text-muted-foreground transition-colors',
            'hover:bg-overlay-hover hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
