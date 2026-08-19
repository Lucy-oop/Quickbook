'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, ArrowLeft, Building2, Check, Copy, CreditCard, Globe, Headphones,
  Loader2, MapPin, Phone, Smartphone, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney } from '@/lib/format'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { friendlyDbError, cn } from '@/lib/utils'
import { monthlyEquivalent, planName, type Plan } from '@/lib/plans'
import {
  BANK_ACCOUNTS, BILLING_ACCOUNTS_CONFIGURED, COMPANY, PAYMENT_CHANNELS, WALLET_ACCOUNTS,
  missingBillingConfig,
} from '@/lib/billing-accounts'
import { QrPlaceholder } from '@/components/billing/qr-placeholder'

const MAX_SLIP_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

/**
 * Manual payment checkout.
 *
 * Three things in order: what you are buying, where to send the money, and proof
 * that you did. The slip upload is the only part the server can verify later, so
 * it is the only field that is genuinely required.
 */
export function PaymentCheckout({ plan }: { plan: Plan }) {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const router = useRouter()

  const [method, setMethod] = useState<string>(PAYMENT_CHANNELS[0]?.value ?? 'other')
  const [senderName, setSenderName] = useState('')
  const [txRef, setTxRef] = useState('')
  const [slip, setSlip] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const money = (v: number) => formatMoney(v, { currency: 'MMK', locale })

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} ${t('billing.copied')}`)
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers.
      toast.error(t('billing.copyFailed'))
    }
  }

  const pickFile = (file: File | null) => {
    if (!file) return

    if (!ACCEPTED.includes(file.type)) {
      toast.error(t('billing.slipType'))
      return
    }
    // Checked here as well as in the bucket policy: a 5 MB limit enforced only
    // server-side means the shop owner waits through the whole upload to be told.
    if (file.size > MAX_SLIP_BYTES) {
      toast.error(t('billing.slipTooBig'))
      return
    }

    setSlip(file)
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    setSlip(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    if (!slip) {
      toast.error(t('billing.slipRequired'))
      return
    }

    setSubmitting(true)
    const supabase = getSupabaseBrowserClient()

    try {
      // Path must start with the tenant id — every storage policy on this bucket
      // pivots on the first folder segment.
      const ext = slip.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${tenant.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('payment-slips')
        .upload(path, slip, { contentType: slip.type, upsert: false })

      if (uploadError) throw uploadError

      const { error: rpcError } = await supabase.rpc('submit_payment_slip', {
        p_tenant_id: tenant.id,
        p_plan: plan.id,
        p_amount: plan.price,
        p_payment_method: method,
        p_sender_name: senderName.trim() || null,
        p_tx_ref: txRef.trim() || null,
        p_slip_path: path,
      })

      if (rpcError) throw rpcError

      toast.success(t('billing.submitted'), { description: t('billing.reviewing') })
      // Hard navigation, not router.push: the subscription state lives in the
      // server-rendered layout, and a client transition would keep showing the
      // paywall until something else forced a refresh.
      window.location.href = '/dashboard'
    } catch (error) {
      toast.error(friendlyDbError(error))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-1.5">
        <Link href="/billing/subscribe">
          <ArrowLeft className="size-4" aria-hidden />
          {t('billing.backToPlans')}
        </Link>
      </Button>

      {/* Disappears on its own: BILLING_ACCOUNTS_CONFIGURED is derived from the
          env values actually present, not a flag anyone has to remember to flip.
          The missing-key list is development-only — a customer needs to know to
          call, not which variable is unset. */}
      {!BILLING_ACCOUNTS_CONFIGURED && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p>{t('billing.accountsNotConfigured')}</p>
            {process.env.NODE_ENV !== 'production' && (
              <p className="mt-1 font-mono text-xs opacity-80">
                missing: {missingBillingConfig().join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Who you are paying ──────────────────────────────────────────
          Placed above the order so the shop sees a named business, an address
          and a phone number before it transfers money to an account number. */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-start gap-4 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="size-5 text-primary" aria-hidden />
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold leading-tight">{COMPANY.name}</p>

            {/* Rendered only when set — an empty `tel:` link is a dead target
                that still looks tappable. */}
            {COMPANY.phone && (
              <a
                href={`tel:${COMPANY.phone.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Phone className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{COMPANY.phone}</span>
              </a>
            )}

            {COMPANY.altPhone && (
              <a
                href={`tel:${COMPANY.altPhone.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Phone className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{COMPANY.altPhone}</span>
              </a>
            )}

            {COMPANY.address && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{COMPANY.address}</span>
              </p>
            )}

            {COMPANY.website && (
              <a
                href={COMPANY.website}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Globe className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{COMPANY.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 1. What you are buying ──────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('billing.orderSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label={t('billing.business')} value={tenant.name} />
          <Row label={t('billing.plan')} value={planName(plan, locale)} />
          <Row
            label={t('billing.duration')}
            value={plan.months === 1 ? t('billing.perMonth') : t('billing.months', { count: plan.months })}
          />
          {plan.months > 1 && (
            <Row label={t('billing.perMonthCost')} value={`≈ ${money(monthlyEquivalent(plan))}`} muted />
          )}
          <div className="flex items-center justify-between border-t border-hairline pt-2 text-base font-semibold">
            <span>{t('billing.totalDue')}</span>
            <span className="tabular-nums">{money(plan.price)}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Where to send it ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('billing.payTo')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('billing.payToHint')}</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="wallet">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wallet" className="gap-1.5">
                <Smartphone className="size-3.5" aria-hidden />
                {t('billing.mobileWallet')}
              </TabsTrigger>
              <TabsTrigger value="bank" className="gap-1.5">
                <CreditCard className="size-3.5" aria-hidden />
                {t('billing.bankTransfer')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="wallet" className="mt-3 space-y-3">
              {!WALLET_ACCOUNTS.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('billing.noChannel')}
                </p>
              )}
              {WALLET_ACCOUNTS.map((w) => (
                <div key={w.id} className="rounded-lg border border-hairline p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">{localized(locale, w.labelEn, w.labelMy)}</span>
                    <Badge variant="outline" className="text-[10px]">{w.accountName}</Badge>
                  </div>
                  <CopyRow value={w.phone} onCopy={() => copy(w.phone, w.labelEn)} />

                  <div className="mt-3 flex items-center gap-3">
                    {w.qrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.qrImage}
                        alt={`${w.labelEn} QR`}
                        className="size-28 rounded-md border border-hairline"
                      />
                    ) : (
                      <QrPlaceholder size={112} label={t('billing.qrPlaceholder')} />
                    )}
                    <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                      {t('billing.qrHint')}
                    </p>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="bank" className="mt-3 space-y-3">
              {!BANK_ACCOUNTS.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('billing.noChannel')}
                </p>
              )}
              {BANK_ACCOUNTS.map((b) => (
                <div key={b.id} className="rounded-lg border border-hairline p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">{localized(locale, b.bankEn, b.bankMy)}</span>
                    <Badge variant="outline" className="text-[10px]">{b.accountName}</Badge>
                  </div>
                  <CopyRow value={b.accountNumber} onCopy={() => copy(b.accountNumber, b.bankEn)} />
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Escalation ──────────────────────────────────────────────────
          Pinned directly under the account numbers, which is where someone looks
          when a transfer has failed or an amount looks wrong. Falls back to a
          tel: link so it is never a dead button. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-overlay-subtle px-4 py-3">
        <p className="text-sm text-muted-foreground">{t('billing.needHelp')}</p>
        {(COMPANY.supportUrl || COMPANY.phone) && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a
              href={COMPANY.supportUrl ?? `tel:${COMPANY.phone.replace(/[^\d+]/g, '')}`}
              target={COMPANY.supportUrl ? '_blank' : undefined}
              rel={COMPANY.supportUrl ? 'noreferrer noopener' : undefined}
            >
              <Headphones className="size-3.5" aria-hidden />
              {localized(locale, COMPANY.supportLabelEn, COMPANY.supportLabelMy)}
            </a>
          </Button>
        )}
      </div>

      {/* ── 3. Prove it ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('billing.sendSlip')}</CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('billing.slipSteps')}</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>{t('billing.paidWith')}</Label>
              <Select value={method} onValueChange={setMethod} disabled={submitting}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {localized(locale, c.labelEn, c.labelMy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pc-sender">{t('billing.senderName')}</Label>
                <Input
                  id="pc-sender" value={senderName} onChange={(e) => setSenderName(e.target.value)}
                  className="h-12" disabled={submitting} placeholder={t('billing.senderHint')}
                />
              </div>
              <div>
                <Label htmlFor="pc-ref">{t('billing.txRef')}</Label>
                <Input
                  id="pc-ref" value={txRef} onChange={(e) => setTxRef(e.target.value)}
                  className="h-12" disabled={submitting} placeholder={t('billing.txRefHint')}
                />
              </div>
            </div>

            {/* Slip upload */}
            <div>
              <Label htmlFor="pc-slip">
                {t('billing.slipImage')} <span className="text-destructive">*</span>
              </Label>

              {slip ? (
                <div className="mt-1 flex items-center gap-3 rounded-lg border border-hairline p-3">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="size-16 rounded-md object-cover" />
                  ) : (
                    <span className="flex size-16 items-center justify-center rounded-md bg-muted">
                      <Check className="size-5 text-emerald-500" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{slip.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {(slip.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button
                    type="button" size="icon" variant="ghost" onClick={clearFile}
                    disabled={submitting} aria-label={t('common.delete')}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="pc-slip"
                  className={cn(
                    'mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg',
                    'border border-dashed border-hairline-strong px-4 py-8 text-center transition-colors',
                    'hover:bg-overlay-hover',
                  )}
                >
                  <Upload className="size-6 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">{t('billing.chooseSlip')}</span>
                  <span className="text-xs text-muted-foreground">{t('billing.slipFormats')}</span>
                </label>
              )}

              <input
                ref={fileRef}
                id="pc-slip"
                type="file"
                accept={ACCEPTED.join(',')}
                className="sr-only"
                disabled={submitting}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button type="submit" size="lg" className="h-12 w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {submitting ? t('billing.submitting') : t('billing.submitSlip')}
            </Button>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              {t('billing.afterSubmit')}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', muted && 'text-muted-foreground')}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('truncate text-right', !muted && 'font-medium')}>{value}</span>
    </div>
  )
}

function CopyRow({ value, onCopy }: { value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-overlay-subtle px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-sm">{value}</code>
      <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={onCopy}>
        <Copy className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}
