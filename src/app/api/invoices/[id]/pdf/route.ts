import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { formatDate, formatMoney } from '@/lib/format'
import { INVOICE_ITEM_COLUMNS } from '@/lib/columns'
import type { InvoiceItemRow, InvoiceRow, TenantRow } from '@/types'

/**
 * Printable invoice document.
 *
 * Returns a self-contained HTML page that opens the browser's print dialog, so
 * the user saves a PDF with no server-side Chromium and no extra dependency —
 * which matters for a self-hosted deployment on a small VPS.
 *
 * To emit a real application/pdf byte stream instead, render this same markup
 * through Puppeteer (`page.pdf()`) or Gotenberg and change the response type.
 * Nothing else needs to change; the markup below is already print-ruled.
 *
 * Security: this route uses the *user's* Supabase session, so RLS decides
 * whether the invoice is visible. There is no service-role key here — a member
 * of another tenant gets a 404, not a document.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const format = new URL(request.url).searchParams.get('format') === 'receipt' ? 'receipt' : 'a4'

  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const [{ data: invoice }, { data: items }] = await Promise.all([
    supabase.from('v_invoices').select('*').eq('id', id).maybeSingle(),
    // Explicit columns, never '*': the cost columns are not granted to
    // `authenticated` and asking for them fails the whole select.
    supabase.from('invoice_items').select(INVOICE_ITEM_COLUMNS).eq('invoice_id', id).order('line_no'),
  ])

  if (!invoice) return new NextResponse('Not found', { status: 404 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', invoice.tenant_id)
    .single()

  if (!tenant) return new NextResponse('Not found', { status: 404 })

  const html = renderInvoiceHtml({
    invoice: invoice as InvoiceRow & { contact_name: string | null; contact_phone: string | null },
    items: (items ?? []) as InvoiceItemRow[],
    tenant: tenant as TenantRow,
    format,
  })

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${invoice.number ?? id}.html"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

function renderInvoiceHtml({
  invoice, items, tenant, format,
}: {
  invoice: InvoiceRow & { contact_name: string | null; contact_phone: string | null }
  items: InvoiceItemRow[]
  tenant: TenantRow
  format: 'a4' | 'receipt'
}): string {
  const locale = tenant.default_locale
  const currency = invoice.currency_code
  const money = (value: number | null | undefined) => formatMoney(value ?? 0, { currency, locale })
  const isReceipt = format === 'receipt'

  const rows = items
    .map(
      (item, index) => `
      <tr>
        <td class="num">${index + 1}</td>
        <td>
          <div class="strong">${escapeHtml(item.description)}</div>
          ${item.sku ? `<div class="muted small">${escapeHtml(item.sku)}</div>` : ''}
          ${Object.entries(item.custom_fields ?? {})
            .map(([key, value]) => `<div class="muted small">${escapeHtml(key)}: ${escapeHtml(String(value))}</div>`)
            .join('')}
        </td>
        <td class="right">${item.quantity} ${escapeHtml(item.unit ?? '')}</td>
        <td class="right">${money(item.unit_price)}</td>
        <td class="right strong">${money(item.line_total)}</td>
      </tr>`,
    )
    .join('')

  const footer =
    (locale === 'my' ? tenant.settings?.receipt_footer_my : tenant.settings?.receipt_footer_en) ??
    'ကျေးဇူးတင်ပါသည် / Thank you for your business!'

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(invoice.number ?? 'Invoice')} — ${escapeHtml(tenant.name)}</title>
<style>
  /* Burmese Unicode needs the taller line-height or diacritics clip. */
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&display=swap');
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: ${isReceipt ? '8mm 4mm' : '14mm'};
    font-family: 'Padauk', system-ui, -apple-system, sans-serif;
    line-height: 1.8; color: #000; background: #fff;
    ${isReceipt ? 'max-width: 80mm; font-size: 11px;' : 'max-width: 210mm; font-size: 13px;'}
    margin-inline: auto;
  }
  h1 { font-size: ${isReceipt ? '14px' : '20px'}; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .04em; }
  .head { display: flex; justify-content: space-between; gap: 24px; ${isReceipt ? 'display:block; text-align:center;' : ''} }
  .muted { opacity: .7; }
  .small { font-size: ${isReceipt ? '10px' : '11px'}; }
  .strong { font-weight: 700; }
  .right { text-align: right; }
  .num { color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
       opacity: .7; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 4px; }
  td { padding: 6px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .totals { margin-left: auto; ${isReceipt ? '' : 'max-width: 280px;'} }
  .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
  .totals .grand { border-top: 1px solid #000; margin-top: 4px; padding-top: 6px; font-size: 15px; font-weight: 700; }
  .footer { margin-top: 20px; ${isReceipt ? 'text-align:center;' : ''} }
  .badge { display: inline-block; border: 1px solid #000; padding: 1px 6px; font-size: 10px; text-transform: uppercase; }
  .toolbar { position: fixed; top: 8px; right: 8px; }
  .toolbar button { font: inherit; padding: 8px 14px; cursor: pointer; }
  tr { break-inside: avoid; }
  @page { margin: 0; size: ${isReceipt ? '80mm auto' : 'A4'}; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>

  <div class="head">
    <div>
      <h1>${escapeHtml(tenant.name)}</h1>
      ${tenant.address ? `<div class="muted">${escapeHtml(tenant.address)}</div>` : ''}
      ${tenant.phone ? `<div class="muted">${escapeHtml(tenant.phone)}</div>` : ''}
      ${tenant.tax_number ? `<div class="muted">TIN: ${escapeHtml(tenant.tax_number)}</div>` : ''}
    </div>
    <div class="${isReceipt ? '' : 'right'}">
      ${isReceipt ? '' : '<h2>Invoice</h2>'}
      <div><span class="muted">No: </span><span class="strong">${escapeHtml(invoice.number ?? '—')}</span></div>
      <div><span class="muted">Date: </span>${formatDate(invoice.issue_date, locale)}</div>
      ${invoice.due_date ? `<div><span class="muted">Due: </span>${formatDate(invoice.due_date, locale)}</div>` : ''}
      ${invoice.status === 'void' ? '<div class="badge">VOID</div>' : ''}
    </div>
  </div>

  ${
    invoice.contact_name
      ? `<div style="margin-top:12px">
           <div class="small muted strong">BILL TO</div>
           <div class="strong">${escapeHtml(invoice.contact_name)}</div>
           ${invoice.contact_phone ? `<div class="muted">${escapeHtml(invoice.contact_phone)}</div>` : ''}
         </div>`
      : ''
  }

  <table>
    <thead>
      <tr><th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span class="muted">Subtotal</span><span>${money(invoice.subtotal)}</span></div>
    ${invoice.discount_amount > 0 ? `<div><span class="muted">Discount</span><span>− ${money(invoice.discount_amount)}</span></div>` : ''}
    ${invoice.tax_amount > 0 ? `<div><span class="muted">Tax</span><span>${money(invoice.tax_amount)}</span></div>` : ''}
    ${invoice.shipping_amount > 0 ? `<div><span class="muted">Delivery</span><span>${money(invoice.shipping_amount)}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>${money(invoice.total)}</span></div>
    ${invoice.paid_amount > 0 ? `<div><span class="muted">Paid</span><span>${money(invoice.paid_amount)}</span></div>` : ''}
    ${invoice.balance_due > 0 ? `<div class="strong"><span>Balance Due</span><span>${money(invoice.balance_due)}</span></div>` : ''}
    ${
      currency !== tenant.base_currency
        ? `<div class="small muted"><span>≈ ${formatMoney(invoice.total_base, { currency: tenant.base_currency, locale })}</span><span>@ ${invoice.exchange_rate}</span></div>`
        : ''
    }
  </div>

  <div class="footer">
    ${invoice.notes ? `<div class="muted">${escapeHtml(invoice.notes)}</div>` : ''}
    <div class="small muted">${escapeHtml(footer)}</div>
  </div>

  <script>
    // Auto-open the print dialog, but only for a real navigation — not when the
    // page is being scraped or rendered headlessly for a server-side PDF.
    if (!navigator.webdriver) {
      window.addEventListener('load', () => setTimeout(() => window.print(), 300))
    }
  </script>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
