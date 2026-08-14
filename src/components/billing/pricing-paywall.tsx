'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Clock, LogOut, Settings, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney } from '@/lib/format'
import { PLANS, monthlyEquivalent, planFeatures, planName, type Plan } from '@/lib/plans'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/**
 * The paywall.
 *
 * Shown when a business's trial or plan has lapsed. It is a dead end by design —
 * but never a trap: settings, switching business and signing out stay reachable
 * from here, because the owner needs a way to pay, to reach another shop they
 * belong to, or to get their data out.
 */
export interface RejectionNotice {
  note: string | null
  at: string | null
  plan: string
}

export function PricingPaywall({ rejection = null }: { rejection?: RejectionNotice | null }) {
  const { t, locale } = useI18n()
  const { tenant, access, isOwner } = useSession()
  const router = useRouter()

  const expired = access.isExpired
  const money = (v: number) => formatMoney(v, { currency: 'MMK', locale })

  const signOut = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    window.location.href = '/login'
  }

  // The plan travels in the URL, but the price does not — checkout re-reads it
  // from PLANS, so the amount cannot be edited in the address bar.
  const choose = (plan: Plan) => router.push(`/billing/checkout?plan=${plan.id}`)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="size-6 text-primary" aria-hidden />
        </span>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {expired ? t('billing.trialEnded') : t('billing.choosePlan')}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {t('billing.subtitle')}
        </p>

        {/* A declined slip must be explained. Showing the price list again with
            no word about the rejection reads as "your payment never arrived",
            and the shop resubmits the same slip. */}
        {rejection && (
          <div className="mx-auto mt-5 max-w-lg rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-left">
            <p className="flex items-start gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('billing.slipDeclined')}
            </p>
            {rejection.note && (
              <p className="mt-1.5 pl-6 text-sm leading-relaxed text-rose-700/90 dark:text-rose-300/90">
                {rejection.note}
              </p>
            )}
            <p className="mt-1.5 pl-6 text-xs text-muted-foreground">
              {t('billing.declinedHint')}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline" className="gap-1.5">{tenant.name}</Badge>
          {expired && (
            <Badge variant="danger" className="gap-1.5">
              <Clock className="size-3" aria-hidden />
              {t('billing.expired')}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Tiers ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              'relative flex flex-col',
              plan.popular && 'border-primary/40 shadow-md ring-1 ring-primary/20',
            )}
          >
            {plan.popular && (
              <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-sm">
                {t('billing.mostPopular')}
              </Badge>
            )}

            <CardHeader className="pb-3">
              <p className="text-sm font-medium text-muted-foreground">
                {planName(plan, locale)}
              </p>

              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums">{money(plan.price)}</span>
                <span className="text-xs text-muted-foreground">
                  / {plan.months === 1 ? t('billing.perMonth') : t('billing.months', { count: plan.months })}
                </span>
              </div>

              {/* The per-month figure is what makes a longer term comparable. */}
              {plan.months > 1 && (
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  ≈ {money(monthlyEquivalent(plan))} / {t('billing.perMonth')}
                </p>
              )}

              {plan.savingPct && (
                <Badge variant="success" className="mt-2 w-fit">
                  {t('billing.save', { percent: plan.savingPct })}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="flex flex-1 flex-col">
              <ul className="mb-5 flex-1 space-y-2">
                {planFeatures(plan, locale).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="h-11 w-full gap-1.5"
                variant={plan.popular ? 'default' : 'outline'}
                onClick={() => choose(plan)}
              >
                {t('billing.select', { plan: planName(plan, locale) })}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Escape hatches ────────────────────────────────────────────────
          Deliberately prominent. An owner whose trial lapsed still needs to
          reach settings, switch to another business, or sign out — a paywall
          that blocks all three strands them with no route forward. */}
      <div className="mt-8 rounded-xl border border-hairline bg-card p-4">
        <p className="mb-3 text-center text-xs text-muted-foreground">
          {t('billing.stillAvailable')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/settings">
              <Settings className="size-3.5" aria-hidden />
              {t('nav.settings')}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={signOut}>
            <LogOut className="size-3.5" aria-hidden />
            {t('billing.signOut')}
          </Button>
        </div>

        {!isOwner && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t('billing.askOwner')}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {localized(locale, 'Powered by Quick Cash', 'Quick Cash မှ ပံ့ပိုးသည်')}
      </p>
    </div>
  )
}
