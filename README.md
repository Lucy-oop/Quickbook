# Myanmar Universal ERP

Multi-tenant ERP, POS and accounting for businesses in Myanmar — retail, service,
restaurant and wholesale — with per-tenant custom fields, MMK/THB/USD support and
Burmese (Unicode) throughout.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · Recharts ·
Supabase (Postgres + RLS + Auth + Storage) · TanStack Query · Zustand

---

## 1. Getting started

```bash
npm install
cp .env.example .env.local        # fill in your Supabase project keys

# Local database (Docker required)
npx supabase start
npx supabase db reset             # runs every migration + seed in order

npm run dev
```

Against a hosted project instead:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

The 18 shadcn/ui primitives this codebase uses are committed under
`src/components/ui/` — no `npx shadcn add` step is needed. They are stock
new-york variants with two deliberate edits: inputs are `text-base` on mobile
(iOS Safari zooms the viewport on anything under 16px) and `<Table>` scrolls
inside its own container so the page never scrolls sideways.

Sign up, and `/onboarding` calls `create_tenant()` for you: one transaction that
creates the business, clones the six system roles with their permissions, seeds
a Myanmar chart of accounts, a default warehouse, the document-number sequences,
and your owner membership.

---

## 2. Project structure

```
supabase/
├── migrations/
│   ├── 20260810000100_core.sql                       # extensions, enums, tenants, users, RBAC, currencies
│   ├── 20260810000200_finance.sql                    # accounts, transactions+lines, invoices, items, payments
│   ├── 20260810000300_inventory.sql                  # warehouses, categories, products, stock ledger
│   ├── 20260810000400_custom_fields_audit.sql        # custom-field engine + validation + audit log
│   ├── 20260810000500_rls.sql                        # ⭐ security helpers, RLS policies, column grants
│   ├── 20260810000600_views_rpc.sql                  # masked views, provisioning, post_invoice, reports
│   └── 20260810000700_seed.sql                       # currencies, permissions, role templates
└── tests/
    └── rls_rbac_test.sql                             # 10 isolation / RBAC / custom-field assertions

src/
├── app/
│   ├── (app)/
│   │   ├── contacts/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── inventory/
│   │   │   ├── stock-in/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── invoices/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── pos/
│   │   │   └── page.tsx                              # full-bleed, no app chrome
│   │   ├── products/
│   │   │   └── page.tsx
│   │   ├── reports/
│   │   │   ├── cash-flow/
│   │   │   │   └── page.tsx
│   │   │   ├── profit-loss/
│   │   │   │   └── page.tsx
│   │   │   ├── receivables/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   ├── activity/
│   │   │   │   └── page.tsx
│   │   │   ├── custom-fields/
│   │   │   │   └── page.tsx
│   │   │   ├── team/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── transactions/
│   │   │   └── page.tsx
│   │   └── layout.tsx                                # ⭐ resolves the session once, hands it to the client
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   └── invoices/
│   │       └── [id]/
│   │           └── pdf/
│   │               └── route.ts
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts
│   ├── forbidden/
│   │   └── page.tsx
│   ├── onboarding/
│   │   └── page.tsx                                  # outside (app): a new user has no membership yet
│   ├── globals.css                                   # design tokens, chart tokens, Myanmar type, print CSS
│   ├── layout.tsx                                    # fonts (Inter + Padauk), theme, React Query, toaster
│   ├── not-found.tsx
│   └── page.tsx
├── components/
│   ├── auth/
│   │   ├── can.tsx
│   │   ├── login-form.tsx
│   │   └── signup-form.tsx
│   ├── charts/
│   │   └── chart-tokens.ts
│   ├── contacts/
│   │   └── contact-manager.tsx
│   ├── custom-fields/
│   │   └── custom-fields-form.tsx                    # renders the tenant's own fields
│   ├── dashboard/
│   │   ├── dashboard-view.tsx                        # ⭐ role-aware dashboard
│   │   ├── sales-trend-chart.tsx
│   │   ├── stat-card.tsx
│   │   └── top-products-chart.tsx
│   ├── inventory/
│   │   └── inventory-manager.tsx
│   ├── invoice/
│   │   └── invoice-document.tsx                      # ⭐ screen / 80mm / A4 from one component
│   ├── invoices/
│   │   ├── invoice-detail.tsx
│   │   └── invoice-list.tsx
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   └── tenant-switcher.tsx
│   ├── onboarding/
│   │   └── onboarding-wizard.tsx
│   ├── pos/
│   │   └── pos-terminal.tsx                          # ⭐ touch POS + barcode + payment + receipt
│   ├── products/
│   │   └── product-manager.tsx
│   ├── providers/
│   │   ├── query-provider.tsx
│   │   └── session-provider.tsx
│   ├── reports/
│   │   ├── cash-flow-report.tsx
│   │   ├── profit-loss-report.tsx
│   │   ├── receivables-report.tsx
│   │   └── report-shell.tsx
│   ├── settings/
│   │   ├── activity-log.tsx
│   │   ├── business-settings-form.tsx
│   │   ├── custom-fields-manager.tsx                 # the custom-fields designer
│   │   └── team-manager.tsx                          # sub-accounts, roles, permission overrides
│   ├── transactions/
│   │   ├── quick-transaction-dialog.tsx
│   │   └── transaction-list.tsx
│   └── ui/                                           # 18 shadcn/ui primitives, committed
├── hooks/
│   ├── use-barcode-scanner.ts                        # USB / Bluetooth keyboard-wedge scanners
│   ├── use-checkout.ts
│   ├── use-dashboard.ts
│   ├── use-permission.ts                             # ⭐ usePermission() / useCan()
│   ├── use-products.ts
│   ├── use-reports.ts
│   └── use-team.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── format.ts                                     # MMK formatting, Burmese numerals, Yangon dates
│   ├── i18n.tsx
│   ├── permissions.ts                                # pure evaluation + role presets + route map
│   ├── session.shared.ts                             # constants safe for client import
│   ├── session.ts                                    # ⭐ getSessionContext, requirePermission (server-only)
│   └── utils.ts
├── messages/
│   ├── en.ts
│   └── my.ts
├── stores/
│   └── cart-store.ts                                 # Zustand + localStorage, hold/resume
├── types/
│   ├── database.ts                                   # schema types — read the warning at the top
│   └── index.ts
└── middleware.ts                                     # session refresh + auth redirects
```

---

## 3. How multi-tenancy is enforced

Three layers, innermost first. **Only the innermost one is security.**

| Layer | Where | What it does |
|---|---|---|
| Row Level Security | Postgres | Filters every row by `tenant_id` and permission. Cannot be bypassed by the client. |
| Column grants | Postgres | `cost_price`, `unit_cost`, `cost_total`, `avg_cost` are **not granted** to `authenticated`. RLS cannot hide a column, so those columns are surfaced only through masked views. |
| Server route guards | `requirePermission()` | Decides whether a page renders. |
| `usePermission()` | Browser | Decides whether a button renders. Convenience only. |

Every policy is built from two helpers in `20260810000500_rls.sql`:

```sql
tenant_id = any (select public.user_tenant_ids())   -- isolation
public.has_permission(tenant_id, 'reports.pnl')     -- RBAC
```

Both are `SECURITY DEFINER` on purpose — a policy on `memberships` that read
`memberships` under RLS would recurse forever.

Permission resolution order: **owner → per-user grant → per-user revoke → role
grant → deny.** A revoke beats the role, and a grant beats the revoke, so an
owner can hand one cashier the P&L without inventing a new role.

### What each role actually sees

| | Owner | Admin | Manager | Accountant | Cashier | Viewer |
|---|---|---|---|---|---|---|
| POS / create sales | ✅ | ✅ | ✅ | — | ✅ | — |
| All transactions | ✅ | ✅ | ✅ | ✅ | **own only** | own only |
| Cost price & margin | ✅ | ✅ | ✅ | ✅ | **hidden** | — |
| Profit & Loss | ✅ | ✅ | ✅ | ✅ | **hidden** | — |
| Inventory adjust | ✅ | ✅ | ✅ | — | — | — |
| Team & settings | ✅ | ✅ | — | — | — | — |
| Activity log | ✅ | ✅ | — | ✅ | — | — |

The cashier restriction is real, not cosmetic: `dashboard_summary()` omits the
profit keys from its JSON, `report_profit_loss()` raises `42501`, `v_products`
returns `cost_price` as `NULL`, and `SELECT products.cost_price` fails on
privileges before RLS is even consulted.

---

## 4. Custom fields engine

Schema rows in `custom_fields_schema` (one per user-defined field); values in a
`custom_fields jsonb` column on the owning table, GIN-indexed with
`jsonb_path_ops` so `custom_fields @> '{"imei":"…"}'` is an index scan.

```sql
insert into custom_fields_schema (tenant_id, entity, field_key, label_en, label_my,
                                  field_type, is_required, is_unique, validation, show_on_print)
values (:tenant, 'product', 'imei', 'IMEI Number', 'IMEI နံပါတ်',
        'text', true, true, '{"regex":"^[0-9]{15}$"}', true);
```

`tg_validate_custom_fields` enforces required/type/range/regex/option/uniqueness
**in the database**, so a bad payload is rejected even if it never went through
the form. `<CustomFieldsForm entity="product" />` renders the same rules in the UI.

---

## 5. Money & multi-currency

Amounts are stored in the document currency alongside `exchange_rate`, with a
`STORED` generated `*_base` column in the tenant's base currency. Reports read
only the `_base` columns, so a tenant invoicing in THB and USD still gets one
coherent MMK P&L. MMK renders with zero decimals and a trailing `K`, per local
convention; Burmese numerals are available via `formatMoney(..., { burmeseNumerals: true })`.

---

## 6. Charts

Two validated categorical slots, chosen per surface rather than flipped:

| | Light | Dark |
|---|---|---|
| Series 1 (sales) | `#2a78d6` | `#3987e5` |
| Series 2 (expenses) | `#eb6834` | `#d95926` |

Worst adjacent CVD ΔE 24.7 light / 26.8 dark; normal-vision ΔE 33.6 / 31.8; both
clear 3:1 against their surface. Sales and expenses share **one** y-axis because
they share a unit — order counts live in their own tile, never a second axis.

---

## 7. Audit logging

`tg_write_audit_log` fires on insert/update/delete across fifteen tables and
records the acting user, the table, the record id, the changed keys only, and
the before/after payloads. Updates that change nothing but `updated_at` are
skipped. `audit_logs` is readable with `audit.read` and writable by no client
role at all.

---

## 8. Verifying the security model

`supabase/tests/rls_rbac_test.sql` sets up two businesses and three users
(two owners and a cashier), then asserts the claims above against a live
database:

```bash
npx supabase start
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/tests/rls_rbac_test.sql
```

| # | Assertion | Result |
|---|---|---|
| 1 | Bad / missing / duplicate IMEI rejected by the DB, not just the form | 3 errors raised |
| 2 | Owner B sees 0 of tenant A's products and 0 of its tenant rows | isolated |
| 3 | Owner reads `cost_price`; cashier gets `NULL`, and the base column errors | masked |
| 4 | Cashier calling `report_profit_loss` | `42501` |
| 5 | Cashier completes a POS sale end to end | `POS-000001`, paid |
| 6 | Stock 10 → 8, cost snapshotted at 350,000/unit | correct |
| 7 | `dashboard_summary` returns 14 keys to the owner, 6 to the cashier | profit hidden |
| 8 | Owner P&L: revenue 900,000 / COGS 700,000 | correct |
| 9 | Audit log records the cashier's writes; cashier reads 0 rows of it | write-only to them |
| 10 | Cashier inviting an owner, or renaming the business | denied / 0 rows |
| 11 | Saving a USD rate twice in one day replaces rather than duplicates | 1 row, latest rate |
| 12 | Transfer moves 3 units MAIN → BR2, total unchanged at 8, cost preserved | correct |
| 13 | Owner trying to UPDATE or DELETE the stock ledger | denied at grant level |

Run it after any migration change — the enum-cast and invoice-numbering bugs
this suite caught during development were both invisible to type checking.

## 9. Build status

Verified locally:

```
npx tsc --noEmit     ✓ 0 errors
npx next build       ✓ 26 routes compiled
npm run smoke        ✓ 30/30 against a live Supabase stack
psql -f supabase/tests/rls_rbac_test.sql   ✓ 13/13 assertions
```

Complete and working end to end:

- **Auth** — phone OTP (E.164-normalised for 09…/9…/+95… input) and email+password, PKCE callback, invitation auto-claim on sign-up
- **Onboarding** — one `create_tenant()` call provisions tenant, roles, chart of accounts, warehouse and sequences, plus trade-specific custom fields
- **Dashboard** — role-aware KPI tiles, Recharts trend and best-sellers, low-stock panel, quick actions
- **POS** — touch grid, barcode wedge scanning, hold/resume cart, split payment methods (KBZPay / WavePay / AYA Pay / cash / bank / credit), change calculation, thermal receipt
- **Invoices** — list with filters, detail view, payment recording, void with stock counter-movement, 80mm + A4 printing, `/api/invoices/[id]/pdf`
- **Products / Inventory / Contacts** — CRUD with per-tenant custom fields, stock in/out against the append-only ledger, low-stock view
- **Transactions** — income/expense list plus the mobile quick-entry dialog
- **Reports** — P&L, Cash Flow, AR/AP aging, each with CSV export and a locked state when the role lacks the permission
- **Settings** — business profile, team & roles with per-user permission overrides, custom-fields designer, activity log

- **Barcode scanning, both paths** — USB/Bluetooth wedge scanners work everywhere with no permission prompt (`useBarcodeScanner`); phone cameras use the native `BarcodeDetector` where present (`CameraScanner`), and say so plainly where it is missing rather than failing silently
- **Multi-currency** — dated manual rates in Settings → Exchange rates, with a currency switcher in the POS cart; every document stores its own rate so past reports never move
- **Multi-location** — warehouse CRUD, and transfers written as paired ledger rows sharing a `transfer_group`
- **PWA** — manifest, maskable icon and app shortcuts to POS / Stock In / Dashboard

Deliberately left for you:

- **Real PDF bytes** — `/api/invoices/[id]/pdf` returns a print-ruled HTML page that opens the browser's print dialog, so no headless Chromium is needed. Pipe the same markup through Puppeteer's `page.pdf()` or Gotenberg if you need a true `application/pdf` stream.
- **ZXing fallback for older browsers** — `CameraScanner` currently tells the user to reach for a USB scanner when `BarcodeDetector` is absent (iOS Safari before 17, older Android WebViews). Adding `@zxing/browser` behind the same component interface is a contained change.
- **Offline POS queue** — a service worker plus an IndexedDB outbox, for shops with unreliable connectivity. The cart already survives a reload via `localStorage`; the missing half is replaying checkouts.
- **Scheduled rate fetching** — the manual path and the `tenant_id is null` fallback both work; wire a cron job to `EXCHANGE_RATE_API_KEY`.
- **Purchase order screens** — `invoice_kind = 'purchase'` flows all the way through `post_invoice()` (it adds stock instead of removing it, and posts to COGS instead of revenue); only the UI is missing.
- **Replace the SVG app icons with PNGs** — `public/icon.svg` renders fine in Chrome and Safari, but some Android launchers still want raster.

## 10. End-to-end smoke test

`supabase/tests/rls_rbac_test.sql` proves the policies at the SQL level. It
cannot prove the layer above: real JWTs, PostgREST's request translation, and
column privileges — which is where the sharpest edges turned out to be.

```bash
npx supabase start
npx supabase db reset
npm run smoke          # reads .env.local, signs up fixtures, exercises 30 assertions
```

It signs up through GoTrue, provisions a tenant, defines a custom field, sells a
phone, reads the P&L, then repeats the sensitive calls as a cashier and as an
unrelated tenant. Every run uses fresh timestamped fixture emails, so it is safe
to run repeatedly against the same database.

This is what caught the `RETURNING *` bug below — the SQL tests could not have.

### The RETURNING trap

`cost_price`, `cost_total`, `unit_cost` and `avg_cost` are withheld from
`authenticated` at the **grant** level. PostgREST turns `.select()` into
`INSERT … RETURNING *`, which requires SELECT on *every* column — so a bare
`.select()` after a write to `products`, `invoices` or `invoice_items` fails
with `42501`, even for an owner.

```ts
.insert({ … }).select()        // ✗ 403 — RETURNING * touches cost_total
.insert({ … }).select('id')    // ✓ RETURNING id only
.insert({ … })                 // ✓ return=minimal
```

Tables with full grants (`transactions`, `memberships`, `contacts`) are
unaffected. The smoke test asserts both halves of this so a regression is caught
rather than discovered at a shop counter.

## 11. Two things that will bite you if you change them

**Row types must be `type` aliases, not `interface`.** postgrest-js constrains a
schema to `Record<string, unknown>`, and TypeScript only grants implicit index
signatures to type aliases. An `interface` silently fails the constraint,
`Schema` collapses to `never`, and every query result in the app becomes `never`
— with no error pointing at the cause. `src/types/database.ts` carries this
warning inline.

**`@supabase/ssr` and `@supabase/supabase-js` must be version-matched.** Their
generic signatures for `SupabaseClient` drift between majors, and a mismatch
produces exactly the same `never` collapse. The pinned pair in `package.json`
(ssr 0.12.x / supabase-js 2.112.x) is the combination this codebase was built
and type-checked against.
# Quickbook
