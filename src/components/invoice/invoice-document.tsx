'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { useI18n } from '@/lib/i18n'
import { formatDate, formatMoney, formatNumber } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { INVOICE_ITEM_COLUMNS } from '@/lib/columns'
import type { InvoiceItemRow, InvoiceRow } from '@/types'

type Format = 'a4' | 'receipt'

interface Props {
  invoiceId: string
  /** 'receipt' = 58/80mm thermal POS slip; 'a4' = full page invoice for PDF. */
  format?: Format
  className?: string
}

/**
 * The printable invoice.
 *
 * One component serves three outputs:
 *   • on-screen preview
 *   • `window.print()` → thermal receipt or A4, driven by the `format` prop and
 *     the `@media print` rules in globals.css
 *   • PDF, by pointing the /api/invoices/[id]/pdf route at this same markup
 *
 * Keeping them identical is deliberate: a receipt the customer disputes should
 * match the PDF the accountant files, byte for byte.
 */
export function InvoiceDocument({ invoiceId, format = 'a4', className }: Props) {
  const { tenant } = useSession()
  const { t, locale } = useI18n()
  const supabase = getSupabaseBrowserClient()

  const { data, isLoading } = useQuery({
    queryKey: qk.invoice(tenant.id, invoiceId),
    queryFn: async () => {
      const [{ data: invoice, error: invoiceError }, { data: items, error: itemsError }] = await Promise.all([
        supabase.from('v_invoices').select('*').eq('id', invoiceId).single(),
        // Explicit columns, never '*': the cost columns are not granted to
        // `authenticated` and asking for them fails the whole select.
        supabase.from('invoice_items').select(INVOICE_ITEM_COLUMNS).eq('invoice_id', invoiceId).order('line_no'),
      ])
      if (invoiceError) throw invoiceError
      if (itemsError) throw itemsError
      return { invoice: invoice as InvoiceRow & { contact_name: string | null; contact_phone: string | null }, items: (items ?? []) as InvoiceItemRow[] }
    },
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const { invoice, items } = data
  const isReceipt = format === 'receipt'
  const currency = invoice.currency_code
  const money = (v: number | null | undefined) =>
    formatMoney(v ?? 0, { currency, locale, showSymbol: !isReceipt })

  const settings = tenant.settings ?? {}
  const footer = locale === 'my' ? settings.receipt_footer_my : settings.receipt_footer_en

  return (
    <article
      data-print-format={format}
      className={cn(
        'invoice-document bg-white text-black',
        isReceipt
          ? 'mx-auto w-full max-w-[80mm] px-3 py-4 font-mono text-[11px] leading-tight'
          : 'mx-auto w-full max-w-[210mm] p-8 text-sm',
        className,
      )}
    >
      {/* ── Business header ──────────────────────────────────────────── */}
      <header className={cn(isReceipt ? 'text-center' : 'flex items-start justify-between gap-6')}>
        <div className={isReceipt ? '' : 'max-w-[60%]'}>
          {tenant.logo_url && !isReceipt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt="" className="mb-3 h-12 w-auto object-contain" />
          )}
          <h1 className={cn('font-bold', isReceipt ? 'text-sm' : 'text-lg')}>{tenant.name}</h1>
          {tenant.address && <p className="whitespace-pre-line opacity-80">{tenant.address}</p>}
          {tenant.phone && <p className="opacity-80">{tenant.phone}</p>}
          {tenant.tax_number && <p className="opacity-80">TIN: {tenant.tax_number}</p>}
        </div>

        <div className={cn(isReceipt ? 'mt-2' : 'text-right')}>
          {!isReceipt && (
            <h2 className="mb-1 text-xl font-bold uppercase tracking-wide">{t('invoice.title')}</h2>
          )}
          <p>
            <span className="opacity-70">{t('invoice.number')}: </span>
            <span className="font-semibold">{invoice.number}</span>
          </p>
          <p>
            <span className="opacity-70">{t('invoice.date')}: </span>
            {formatDate(invoice.issue_date, locale)}
          </p>
          {invoice.due_date && (
            <p>
              <span className="opacity-70">{t('invoice.dueDate')}: </span>
              {formatDate(invoice.due_date, locale)}
            </p>
          )}
        </div>
      </header>

      <Divider isReceipt={isReceipt} />

      {/* ── Customer ─────────────────────────────────────────────────── */}
      {(invoice.contact_name || invoice.contact_snapshot?.name) && (
        <section className={isReceipt ? 'mb-2' : 'mb-6'}>
          <p className="mb-0.5 text-xs font-semibold uppercase opacity-70">{t('invoice.billTo')}</p>
          <p className="font-medium">{invoice.contact_name ?? invoice.contact_snapshot?.name}</p>
          {(invoice.contact_phone ?? invoice.contact_snapshot?.phone) && (
            <p className="opacity-80">{invoice.contact_phone ?? invoice.contact_snapshot?.phone}</p>
          )}
        </section>
      )}

      {/* ── Line items ───────────────────────────────────────────────── */}
      {isReceipt ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <p className="truncate">{item.description}</p>
              <p className="flex justify-between">
                <span>
                  {formatNumber(item.quantity, 0, locale)} × {money(item.unit_price)}
                </span>
                <span className="font-semibold tabular-nums">{money(item.line_total)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y text-left text-xs uppercase opacity-70">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">{t('invoice.item')}</th>
              <th className="py-2 pr-2 text-right font-semibold">{t('pos.qty')}</th>
              <th className="py-2 pr-2 text-right font-semibold">{t('invoice.price')}</th>
              <th className="py-2 text-right font-semibold">{t('invoice.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-b align-top">
                <td className="py-2 pr-2 tabular-nums opacity-70">{index + 1}</td>
                <td className="py-2 pr-2">
                  <p className="font-medium">{item.description}</p>
                  {item.sku && <p className="text-xs opacity-70">{item.sku}</p>}
                  {/* Custom fields flagged `show_on_print` land here, e.g. IMEI. */}
                  {Object.entries(item.custom_fields ?? {}).map(([key, value]) => (
                    <p key={key} className="text-xs opacity-70">
                      {key}: {String(value)}
                    </p>
                  ))}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {formatNumber(item.quantity, 0, locale)} {item.unit}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{money(item.unit_price)}</td>
                <td className="py-2 text-right font-medium tabular-nums">{money(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Divider isReceipt={isReceipt} />

      {/* ── Totals ───────────────────────────────────────────────────── */}
      <section className={cn('space-y-1', isReceipt ? '' : 'ml-auto max-w-xs')}>
        <TotalRow label={t('pos.subtotal')} value={money(invoice.subtotal)} />
        {invoice.discount_amount > 0 && (
          <TotalRow label={t('pos.discount')} value={`− ${money(invoice.discount_amount)}`} />
        )}
        {invoice.tax_amount > 0 && <TotalRow label={t('pos.tax')} value={money(invoice.tax_amount)} />}
        {invoice.shipping_amount > 0 && (
          <TotalRow label="Delivery" value={money(invoice.shipping_amount)} />
        )}

        <div className="flex justify-between border-t pt-1.5 text-base font-bold">
          <span>{t('pos.total')}</span>
          <span className="tabular-nums">{money(invoice.total)}</span>
        </div>

        {invoice.paid_amount > 0 && <TotalRow label={t('invoice.paid')} value={money(invoice.paid_amount)} />}
        {invoice.balance_due > 0 && (
          <TotalRow label={t('invoice.balanceDue')} value={money(invoice.balance_due)} bold />
        )}

        {/* Foreign-currency invoices show the MMK equivalent for the books. */}
        {currency !== tenant.base_currency && (
          <p className="pt-1 text-xs opacity-70">
            ≈ {formatMoney(invoice.total_base, { currency: tenant.base_currency, locale })} @{' '}
            {invoice.exchange_rate}
          </p>
        )}
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className={cn('mt-6', isReceipt && 'mt-4 text-center')}>
        {invoice.notes && <p className="mb-2 whitespace-pre-line opacity-80">{invoice.notes}</p>}
        {invoice.terms && !isReceipt && (
          <p className="mb-2 whitespace-pre-line text-xs opacity-70">{invoice.terms}</p>
        )}
        <p className={cn(isReceipt ? 'text-[10px]' : 'text-xs', 'opacity-70')}>
          {footer || t('invoice.thankYou')}
        </p>
        {isReceipt && (
          <p className="mt-2 text-[10px] opacity-60">
            {formatDate(invoice.issued_at ?? invoice.created_at, locale, 'datetime')}
          </p>
        )}
      </footer>
    </article>
  )
}

function Divider({ isReceipt }: { isReceipt: boolean }) {
  return isReceipt ? (
    <p className="my-2 select-none overflow-hidden opacity-60" aria-hidden>
      {'- '.repeat(24)}
    </p>
  ) : (
    <hr className="my-6" />
  )
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between', bold && 'font-semibold')}>
      <span className="opacity-80">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
