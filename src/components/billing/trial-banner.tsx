'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Hourglass, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/components/providers/session-provider'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Trial countdown.
 *
 * Dismissal is remembered per tenant AND per remaining-day count, so closing it
 * at "12 days left" hides it until the number changes. A banner that never comes
 * back is useless a week later; one that reappears every page load is noise.
 *
 * Under three days it cannot be dismissed at all — at that point it is the only
 * warning before the shop stops working.
 */
export function TrialBanner() {
  const { t } = useI18n()
  const { tenant, access } = useSession()
  const [dismissed, setDismissed] = useState(true) // assume hidden until localStorage is read

  const days = access.trialDaysLeft
  const showing = access.state === 'trialing' && days !== null
  const urgent = showing && days <= 3
  const storageKey = showing ? `qc-trial-dismissed:${tenant.id}:${days}` : ''

  // Read after mount: localStorage does not exist on the server, and rendering
  // the banner then hiding it would flash on every navigation.
  useEffect(() => {
    if (!showing) return
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1')
    } catch {
      setDismissed(false) // private mode — show it rather than swallow the warning
    }
  }, [showing, storageKey])

  // A slip under review gets its own, non-dismissible notice. The shop is
  // working normally, but the state is temporary and they should know why they
  // were let back in — and that it is not yet settled.
  if (access.state === 'pending_approval') {
    return (
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-sm text-blue-800 dark:text-blue-300"
        role="status"
      >
        <Hourglass className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">{t('billing.pendingReview')}</span>
      </div>
    )
  }

  if (!showing) return null
  if (dismissed && !urgent) return null

  const close = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      // Nothing to do — it reappears next load, which is the safe direction.
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
        urgent
          ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          : 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      )}
      role={urgent ? 'alert' : 'status'}
    >
      <Clock className="size-4 shrink-0" aria-hidden />

      <span className="min-w-0 flex-1">
        {days === 0
          ? t('billing.trialLastDay')
          : t('billing.trialDaysLeft', { count: days })}
      </span>

      <Button asChild size="sm" className="h-8 shrink-0 px-3">
        <Link href="/billing/subscribe">{t('billing.upgradeNow')}</Link>
      </Button>

      {!urgent && (
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
