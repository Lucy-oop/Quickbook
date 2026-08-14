#!/usr/bin/env node
/**
 * End-to-end smoke test against a running Supabase (local or hosted).
 *
 *   npx supabase start && npx supabase db reset
 *   npm run smoke
 *
 * This exercises the paths that unit-level SQL tests cannot: real GoTrue
 * signup, real JWTs, and PostgREST's own behaviour — which is where column
 * privileges and RETURNING clauses actually bite.
 *
 * Idempotent: re-running signs the same fixtures back in rather than failing.
 */

const API = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!ANON) {
  console.error('Set NEXT_PUBLIC_SUPABASE_ANON_KEY (or run via `npm run smoke`, which reads .env.local).')
  process.exit(1)
}

let passed = 0
let failed = 0

function check(label, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
  } else {
    failed++
    console.log(`  \x1b[31m✗\x1b[0m ${label}  \x1b[31m${detail}\x1b[0m`)
  }
}

async function api(path, { method = 'GET', body, token, prefer } = {}) {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (prefer) headers.Prefer = prefer

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, ok: res.ok, body: json }
}

/** Sign up, falling back to sign-in when the fixture user already exists. */
async function authenticate(email, password, fullName) {
  const signup = await api('/auth/v1/signup', {
    method: 'POST',
    body: { email, password, data: { full_name: fullName } },
  })
  if (signup.ok && signup.body?.access_token) return signup.body.access_token

  const login = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  })
  if (!login.ok) throw new Error(`auth failed for ${email}: ${JSON.stringify(login.body)}`)
  return login.body.access_token
}

const stamp = Date.now()
const OWNER = { email: `owner+${stamp}@smoke.test`, password: 'SmokeTest123!' }
const CASHIER = { email: `cashier+${stamp}@smoke.test`, password: 'SmokeTest123!' }

console.log(`\nSmoke test against ${API}\n`)

// ── 1. Anonymous access ─────────────────────────────────────────────────────
console.log('1. Anonymous access is refused')
{
  const r = await api('/rest/v1/tenants?select=id')
  check('anon cannot read tenants', r.status === 401 || r.status === 403, `http ${r.status}`)
}

// ── 2. Signup + profile trigger ─────────────────────────────────────────────
console.log('\n2. Signup and profile provisioning')
const ownerToken = await authenticate(OWNER.email, OWNER.password, 'Smoke Owner')
check('owner signed up and got a JWT', !!ownerToken)
{
  const r = await api('/rest/v1/users?select=id,full_name', { token: ownerToken })
  check('tg_handle_new_auth_user created the profile', r.body?.[0]?.full_name === 'Smoke Owner',
    JSON.stringify(r.body?.[0] ?? r.body))
}

// ── 3. Tenant provisioning ──────────────────────────────────────────────────
console.log('\n3. create_tenant() provisions everything atomically')
const tenant = (await api('/rest/v1/rpc/create_tenant', {
  method: 'POST', token: ownerToken,
  body: { p_name: `Smoke Shop ${stamp}`, p_business_type: 'retail', p_base_currency: 'MMK', p_locale: 'my' },
})).body
const tid = tenant?.id
check('tenant created', !!tid, tid)

const ownerId = (await api('/rest/v1/users?select=id', { token: ownerToken })).body[0].id
const accounts = (await api(`/rest/v1/accounts?select=code,expense_group&tenant_id=eq.${tid}`, { token: ownerToken })).body
// 18: Repairs & Maintenance (6050) from 20260812000200, plus Supplier Refunds
// (4200) from 20260813000200.
check('chart of accounts seeded', accounts.length === 18, `${accounts.length} accounts`)
check(
  'expense accounts are classified for the breakdown',
  ['payroll', 'office', 'inventory', 'other'].every((group) =>
    accounts.some((a) => a.expense_group === group)),
  accounts.filter((a) => a.expense_group).map((a) => `${a.code}:${a.expense_group}`).join(' '),
)
const roles = (await api(`/rest/v1/roles?select=key&tenant_id=eq.${tid}`, { token: ownerToken })).body
check('six roles cloned for the tenant', roles.length === 6, roles.map((r) => r.key).join(','))
const warehouse = (await api(`/rest/v1/warehouses?select=id,code&tenant_id=eq.${tid}`, { token: ownerToken })).body[0]
check('default warehouse created', warehouse?.code === 'MAIN')

// `memberships` has two FKs into `users` (user_id, invited_by), so an
// unqualified embed fails with PGRST201. This is the query the team screen and
// the invite endpoint both run; it broke invitations once already.
const embed = await api(
  `/rest/v1/memberships?select=id,user:users!memberships_user_id_fkey(email)&tenant_id=eq.${tid}`,
  { token: ownerToken },
)
check(
  'memberships→users embed is unambiguous',
  embed.status === 200 && Array.isArray(embed.body),
  embed.body?.code ? `${embed.body.code} ${embed.body.message ?? ''}`.slice(0, 90) : `${embed.body.length} rows`,
)

const ambiguous = await api(`/rest/v1/memberships?select=id,users(email)&tenant_id=eq.${tid}`, { token: ownerToken })
check(
  'unqualified embed still rejected (guards the fix above)',
  ambiguous.body?.code === 'PGRST201',
  ambiguous.body?.code ?? `unexpectedly ${ambiguous.status}`,
)

// ── 4. Custom fields enforced by the database ───────────────────────────────
console.log('\n4. Custom-field engine')
await api('/rest/v1/custom_fields_schema', {
  method: 'POST', token: ownerToken,
  body: {
    tenant_id: tid, entity: 'product', field_key: 'imei', label_en: 'IMEI Number',
    field_type: 'text', is_required: true, is_unique: true, validation: { regex: '^[0-9]{15}$' },
  },
})
{
  const bad = await api('/rest/v1/products', {
    method: 'POST', token: ownerToken,
    body: { tenant_id: tid, name: 'Bad', selling_price: 1, custom_fields: { imei: '123' } },
  })
  check('malformed IMEI rejected by the DB trigger', !bad.ok, bad.body?.message)

  const missing = await api('/rest/v1/products', {
    method: 'POST', token: ownerToken,
    body: { tenant_id: tid, name: 'NoImei', selling_price: 1 },
  })
  check('missing required field rejected', !missing.ok, missing.body?.message)
}

// ── 5. Column privileges: the RETURNING trap ────────────────────────────────
console.log('\n5. Cost columns are withheld at the grant level')
{
  const wide = await api('/rest/v1/products?select=*', {
    method: 'POST', token: ownerToken, prefer: 'return=representation',
    body: { tenant_id: tid, name: 'Wide', selling_price: 1, custom_fields: { imei: '111111111111111' } },
  })
  check('insert...RETURNING * is refused (cost_price not granted)', wide.status === 403, `http ${wide.status}`)

  const narrow = await api('/rest/v1/products?select=id', {
    method: 'POST', token: ownerToken, prefer: 'return=representation',
    body: { tenant_id: tid, name: 'Narrow', selling_price: 1, custom_fields: { imei: '222222222222222' } },
  })
  check('insert...RETURNING id succeeds', narrow.ok && !!narrow.body?.[0]?.id, `http ${narrow.status}`)
}

const product = (await api('/rest/v1/products?select=id', {
  method: 'POST', token: ownerToken, prefer: 'return=representation',
  body: {
    tenant_id: tid, name: 'Galaxy A15', sku: `SKU-${stamp}`, barcode: `${stamp}`,
    cost_price: 350000, selling_price: 450000, custom_fields: { imei: '356938035643809' },
  },
})).body[0]
check('product created with a valid IMEI', !!product?.id)

// ── 6. Stock ledger ─────────────────────────────────────────────────────────
console.log('\n6. Stock ledger and weighted-average cost')
await api('/rest/v1/stock_movements', {
  method: 'POST', token: ownerToken,
  body: {
    tenant_id: tid, product_id: product.id, warehouse_id: warehouse.id,
    kind: 'in', quantity: 10, unit_cost: 350000, created_by: ownerId,
  },
})
{
  const r = (await api(`/rest/v1/v_products?select=stock_on_hand,cost_price&id=eq.${product.id}`, { token: ownerToken })).body[0]
  check('stock level is 10', Number(r.stock_on_hand) === 10, `${r.stock_on_hand}`)
  check('owner sees cost_price through v_products', Number(r.cost_price) === 350000, `${r.cost_price}`)
}

// ── 7. POS sale ─────────────────────────────────────────────────────────────
console.log('\n7. POS sale through post_invoice()')
const draft = (await api('/rest/v1/invoices?select=id', {
  method: 'POST', token: ownerToken, prefer: 'return=representation',
  body: { tenant_id: tid, kind: 'pos', status: 'draft', currency_code: 'MMK', warehouse_id: warehouse.id, created_by: ownerId },
})).body[0]
check('draft invoice created with no number', !!draft?.id)

await api('/rest/v1/invoice_items', {
  method: 'POST', token: ownerToken,
  body: {
    tenant_id: tid, invoice_id: draft.id, product_id: product.id,
    description: 'Galaxy A15', quantity: 2, unit_price: 450000,
  },
})

const posted = (await api('/rest/v1/rpc/post_invoice', {
  method: 'POST', token: ownerToken,
  body: { p_invoice_id: draft.id, p_paid_amount: 900000, p_method: 'cash' },
})).body
check('invoice numbered from the sequence', /^POS-\d+$/.test(posted?.number ?? ''), posted?.number)
check('invoice marked paid', posted?.status === 'paid', posted?.status)
check('total is 900,000', Number(posted?.total) === 900000, posted?.total)
{
  const r = (await api(`/rest/v1/v_products?select=stock_on_hand&id=eq.${product.id}`, { token: ownerToken })).body[0]
  check('stock deducted to 8', Number(r.stock_on_hand) === 8, `${r.stock_on_hand}`)
}

// Overselling is what filled the low-stock widget with negative balances: stock
// was sold that had never been received, and nothing refused it.
{
  const oversell = await api('/rest/v1/stock_movements', {
    method: 'POST',
    token: ownerToken,
    body: {
      tenant_id: tid,
      product_id: product.id,
      warehouse_id: warehouse.id,
      kind: 'sale',
      quantity: -99, // only 8 on hand
      // stock_movements_insert requires created_by = auth.uid(); without it the
      // insert is refused by RLS and never reaches the guard being tested.
      created_by: ownerId,
    },
  })
  check(
    'overselling is refused',
    oversell.status >= 400 && /not enough stock/i.test(JSON.stringify(oversell.body)),
    `http ${oversell.status}`,
  )

  const after = (await api(`/rest/v1/v_products?select=stock_on_hand&id=eq.${product.id}`, { token: ownerToken })).body[0]
  check('stock never goes negative', Number(after.stock_on_hand) === 8, `${after.stock_on_hand}`)
}

// Low stock is strictly the product's own threshold: tracked, reorder_level > 0,
// and quantity <= reorder_level. No fallback for unset levels.
{
  const inView = async () =>
    (await api(`/rest/v1/v_low_stock?select=product_id,quantity,threshold&product_id=eq.${product.id}`,
      { token: ownerToken })).body

  // 8 on hand, no reorder level -> not an alert, however low it looks.
  await api(`/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH', token: ownerToken, body: { reorder_level: 0 },
  })
  check('threshold 0 is excluded (no hardcoded fallback)', (await inView()).length === 0)

  // 8 on hand, reorder level 10 -> at or below, so it is an alert.
  await api(`/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH', token: ownerToken, body: { reorder_level: 10 },
  })
  const low = await inView()
  check('quantity <= threshold is included', low.length === 1 && Number(low[0].threshold) === 10,
    low.length ? `${low[0].quantity}/${low[0].threshold}` : 'missing')

  // 8 on hand, reorder level 5 -> above the line, so it must disappear.
  await api(`/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH', token: ownerToken, body: { reorder_level: 5 },
  })
  check('quantity > threshold is excluded', (await inView()).length === 0)

  // Untracked is never an alert, whatever the numbers say.
  await api(`/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH', token: ownerToken, body: { reorder_level: 10, track_inventory: false },
  })
  check('untracked product is excluded', (await inView()).length === 0)

  await api(`/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH', token: ownerToken, body: { track_inventory: true, reorder_level: 0 },
  })
}

// v_low_stock aggregates across warehouses, so it cannot disagree with
// v_products.stock_on_hand. Per-warehouse grain is what made an edited product
// keep showing 0/10: the new stock landed in one warehouse and a stale zero row
// in another kept satisfying the threshold.
{
  // PostgREST returns an empty body on insert unless asked for representation.
  const created = await api('/rest/v1/warehouses', {
    method: 'POST', token: ownerToken, prefer: 'return=representation',
    body: { tenant_id: tid, code: 'BR2', name: 'Branch 2', is_default: false },
  })
  const second = Array.isArray(created.body) ? created.body[0] : null
  if (!second) {
    check('second warehouse created for aggregation test', false,
      `http ${created.status} ${JSON.stringify(created.body).slice(0, 90)}`)
  }

  // 8 already sit in MAIN. Put 5 more in the second warehouse, threshold 10.
  if (second) await api('/rest/v1/stock_movements', {
    method: 'POST', token: ownerToken,
    body: {
      tenant_id: tid, product_id: product.id, warehouse_id: second.id,
      kind: 'in', quantity: 5, unit_cost: 1000, created_by: ownerId,
    },
  })
  await api(`/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH', token: ownerToken, body: { reorder_level: 10 },
  })

  const view = (await api(`/rest/v1/v_products?select=stock_on_hand,is_low_stock&id=eq.${product.id}`,
    { token: ownerToken })).body[0]
  const rows = (await api(`/rest/v1/v_low_stock?select=product_id,quantity&product_id=eq.${product.id}`,
    { token: ownerToken })).body

  check('stock sums across warehouses', Number(view.stock_on_hand) === 13, `${view.stock_on_hand}`)
  // 13 > 10, so it must be absent from BOTH the view and the flag.
  check('above threshold once summed -> not low', view.is_low_stock === false && rows.length === 0,
    `is_low_stock=${view.is_low_stock}, rows=${rows.length}`)
  check('one row per product, not per warehouse', rows.length <= 1, `${rows.length}`)

  await api(`/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH', token: ownerToken, body: { reorder_level: 0 },
  })
}

// The tenant-isolation half of this lives in section 10, where a second tenant
// (and therefore a genuinely foreign warehouse) already exists.

// ── 8. Reports ──────────────────────────────────────────────────────────────
console.log('\n8. Reports')
{
  const pl = (await api('/rest/v1/rpc/report_profit_loss', {
    method: 'POST', token: ownerToken,
    body: { p_tenant_id: tid, p_from: '2000-01-01', p_to: '2100-01-01' },
  })).body
  const revenue = pl.find((r) => r.section === 'revenue')
  const cogs = pl.find((r) => r.section === 'cogs')
  check('P&L revenue is 900,000', Number(revenue?.amount) === 900000, `${revenue?.amount}`)
  check('P&L COGS is 700,000', Number(cogs?.amount) === 700000, `${cogs?.amount}`)

  const dash = (await api('/rest/v1/rpc/dashboard_summary', {
    method: 'POST', token: ownerToken, body: { p_tenant_id: tid },
  })).body
  check('owner dashboard includes profit keys', 'net_period' in dash && 'gross_profit' in dash,
    `${Object.keys(dash).length} keys`)
}

// ── 9. Cashier restrictions ─────────────────────────────────────────────────
console.log('\n9. Cashier is restricted')
const cashierToken = await authenticate(CASHIER.email, CASHIER.password, 'Smoke Cashier')
await api('/rest/v1/rpc/invite_member', {
  method: 'POST', token: ownerToken,
  body: { p_tenant_id: tid, p_role_key: 'cashier', p_email: CASHIER.email },
})
{
  const r = (await api(`/rest/v1/v_products?select=name,cost_price&id=eq.${product.id}`, { token: cashierToken })).body
  check('cashier sees the product', r.length === 1)
  check('cashier gets cost_price as null', r[0]?.cost_price === null, `${r[0]?.cost_price}`)

  const pl = await api('/rest/v1/rpc/report_profit_loss', {
    method: 'POST', token: cashierToken,
    body: { p_tenant_id: tid, p_from: '2000-01-01', p_to: '2100-01-01' },
  })
  check('cashier blocked from P&L', !pl.ok, pl.body?.message)

  const dash = (await api('/rest/v1/rpc/dashboard_summary', {
    method: 'POST', token: cashierToken, body: { p_tenant_id: tid },
  })).body
  check('cashier dashboard omits profit keys', !('net_period' in dash) && !('gross_profit' in dash),
    Object.keys(dash).join(','))

  const invite = await api('/rest/v1/rpc/invite_member', {
    method: 'POST', token: cashierToken,
    body: { p_tenant_id: tid, p_role_key: 'owner', p_email: 'attacker@smoke.test' },
  })
  check('cashier cannot invite an owner', !invite.ok, invite.body?.message)

  const rename = await api(`/rest/v1/tenants?id=eq.${tid}`, {
    method: 'PATCH', token: cashierToken, prefer: 'return=representation', body: { name: 'Hacked' },
  })
  check('cashier cannot rename the business', !rename.ok || rename.body?.length === 0,
    `http ${rename.status}`)
}

// ── 9b. Income & expense semantics ──────────────────────────────────────────
console.log('\n9b. Income, expenses and voiding')
{
  const rpc = (fn, body) => api(`/rest/v1/rpc/${fn}`, { method: 'POST', token: ownerToken, body })
  const today = new Date().toISOString().slice(0, 10)
  const period = { p_tenant_id: tid, p_from: '2000-01-01', p_to: '2100-01-01' }

  // The manual picker must not offer the system sales account, or the same cash
  // can be booked twice: once through POS, once typed in by hand.
  const incomeAccts = (await api(
    `/rest/v1/accounts?select=code,subtype,type&tenant_id=eq.${tid}&type=eq.income`,
    { token: ownerToken },
  )).body
  check('Sales Revenue is a system account (excluded from manual income)',
    incomeAccts.some((a) => a.code === '4000' && a.subtype === 'sales'))
  check('a non-sales income account is seeded',
    incomeAccts.some((a) => a.code === '4200'), incomeAccts.map((a) => a.code).join(','))

  // P&L revenue is net of tax; the sale above was 900,000 with no tax.
  const pnl = (await rpc('report_profit_loss', period)).body
  const revenue = pnl.filter((r) => r.section === 'revenue').reduce((n, r) => n + Number(r.amount), 0)
  const cogsRows = pnl.filter((r) => r.section === 'cogs')
  check('P&L revenue present', revenue > 0, `${revenue}`)
  check('Cost of Sales appears exactly once', cogsRows.length <= 1, `${cogsRows.length} rows`)
  check('no COGS account in the expense section (double-count guard)',
    !pnl.some((r) => r.section === 'expense' && r.account_code === '5000'))

  // report_income mirrors report_expenses.
  const income = (await rpc('report_income', period)).body
  check('report_income returns per-account rows', Array.isArray(income) && income.length > 0,
    `${income.length} rows`)
  check('income shares total 100%',
    Math.abs(income.reduce((n, r) => n + Number(r.share), 0) - 100) < 0.5,
    `${income.reduce((n, r) => n + Number(r.share), 0)}`)

  // Cash flow must follow payments, not the full invoice value. The POS sale was
  // paid in full, so inflow should equal it — not exceed it.
  const cf = (await rpc('report_cash_flow', { ...period, p_bucket: 'month' })).body
  const inflow = cf.reduce((n, r) => n + Number(r.inflow), 0)
  check('cash inflow does not exceed booked revenue', inflow <= revenue + 0.01,
    `inflow ${inflow} vs revenue ${revenue}`)

  // Void: a standalone entry leaves the reports; an invoice-linked one is refused.
  const otherIncome = incomeAccts.find((a) => a.code === '4100')
  const acctId = (await api(
    `/rest/v1/accounts?select=id&tenant_id=eq.${tid}&code=eq.4100`, { token: ownerToken },
  )).body?.[0]?.id

  const manual = await api('/rest/v1/transactions?select=id', {
    method: 'POST', token: ownerToken, prefer: 'return=representation',
    body: {
      tenant_id: tid, type: 'income', status: 'posted', occurred_on: today,
      account_id: acctId, amount: 12345, currency_code: 'MMK', created_by: ownerId,
    },
  })
  const manualId = manual.body?.[0]?.id
  check('manual income entry created', !!manualId && !!otherIncome, `http ${manual.status}`)

  if (manualId) {
    const before = (await rpc('report_income', period)).body
      .reduce((n, r) => n + Number(r.amount), 0)

    const voided = await rpc('void_transaction', { p_transaction_id: manualId, p_reason: 'smoke' })
    check('void_transaction succeeds on a standalone entry', voided.status === 200, `http ${voided.status}`)

    const after = (await rpc('report_income', period)).body
      .reduce((n, r) => n + Number(r.amount), 0)
    check('voided entry leaves the income report', Math.abs(before - after - 12345) < 0.01,
      `${before} -> ${after}`)
  }

  const linked = (await api(
    `/rest/v1/transactions?select=id&tenant_id=eq.${tid}&invoice_id=not.is.null&limit=1`,
    { token: ownerToken },
  )).body?.[0]
  if (linked) {
    const refused = await rpc('void_transaction', { p_transaction_id: linked.id, p_reason: 'x' })
    check('void_transaction refuses an invoice-linked entry', refused.status >= 400,
      `http ${refused.status}`)
  }
}

// ── 10. Cross-tenant isolation ──────────────────────────────────────────────
console.log('\n10. Cross-tenant isolation')
{
  const outsiderToken = await authenticate(`outsider+${stamp}@smoke.test`, 'SmokeTest123!', 'Outsider')
  await api('/rest/v1/rpc/create_tenant', {
    method: 'POST', token: outsiderToken,
    body: { p_name: `Other Shop ${stamp}`, p_business_type: 'retail' },
  })
  const seen = (await api(`/rest/v1/v_products?select=id&tenant_id=eq.${tid}`, { token: outsiderToken })).body
  check('another tenant sees none of these products', Array.isArray(seen) && seen.length === 0,
    `${Array.isArray(seen) ? seen.length : seen} rows`)

  const tenants = (await api('/rest/v1/tenants?select=id', { token: outsiderToken })).body
  check('another tenant sees only its own business', tenants.length === 1, `${tenants.length} tenants`)

  // The composite FKs from 20260812000800. This is the assertion that would have
  // caught 45 rows pointing at another tenant's warehouse: a plain FK on
  // warehouse_id alone says nothing about tenancy, so the write was accepted.
  const foreignWh = (await api('/rest/v1/warehouses?select=id', { token: outsiderToken })).body?.[0]
  if (!foreignWh) {
    check('cross-tenant stock write is refused', false, 'no foreign warehouse to test with')
  } else {
    const res = await api('/rest/v1/stock_movements', {
      method: 'POST', token: ownerToken,
      body: {
        tenant_id: tid, product_id: product.id, warehouse_id: foreignWh.id,
        kind: 'in', quantity: 1, created_by: ownerId,
      },
    })
    check('cross-tenant stock write is refused', res.status >= 400, `http ${res.status}`)

    // Same shape via the invoice path, which was 23 of the 45 bad rows.
    const inv = await api('/rest/v1/invoices', {
      method: 'POST', token: ownerToken,
      body: {
        tenant_id: tid, kind: 'sales', status: 'draft',
        warehouse_id: foreignWh.id, issue_date: new Date().toISOString().slice(0, 10),
        currency_code: 'MMK', created_by: ownerId,
      },
    })
    check('cross-tenant invoice warehouse is refused', inv.status >= 400, `http ${inv.status}`)
  }
}

console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m\n`)
process.exit(failed === 0 ? 0 : 1)
