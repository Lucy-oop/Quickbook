-- =============================================================================
--  RLS / RBAC / custom-field assertions.
--
--  Run against a FRESH database (`npx supabase db reset` first) — the fixtures
--  insert fixed auth.users ids, so a second run on the same database trips
--  users_pkey before it reaches the assertions.
--
--  ON_ERROR_STOP is off on purpose: several assertions ARE the errors, and the
--  script must keep going past them.
-- =============================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── Fixtures: two businesses, three users ────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','owner-a@test.mm','{"full_name":"Owner A"}'),
  ('22222222-2222-2222-2222-222222222222','owner-b@test.mm','{"full_name":"Owner B"}'),
  ('33333333-3333-3333-3333-333333333333','cashier-a@test.mm','{"full_name":"Cashier A"}');

-- Tenant A (owner A)
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id as tenant_a from public.create_tenant('Shwe Phone Shop', 'retail', 'MMK', 'my') \gset
-- Tenant B (owner B)
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select id as tenant_b from public.create_tenant('Yangon Mart', 'retail', 'MMK', 'en') \gset

-- Cashier joins tenant A
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id from public.invite_member(:'tenant_a', 'cashier', 'cashier-a@test.mm');

-- Custom field: IMEI on products, required + unique + 15 digits
insert into public.custom_fields_schema (tenant_id, entity, field_key, label_en, field_type, is_required, is_unique, validation)
values (:'tenant_a', 'product', 'imei', 'IMEI Number', 'text', true, true, '{"regex":"^[0-9]{15}$"}');

-- Products in each tenant
insert into public.products (tenant_id, name, sku, barcode, cost_price, selling_price, custom_fields)
values (:'tenant_a', 'Galaxy A15', 'SKU-A15', '8801643000001', 350000, 450000, '{"imei":"356938035643809"}')
returning id as product_a \gset
insert into public.products (tenant_id, name, sku, cost_price, selling_price)
values (:'tenant_b', 'Instant Noodles', 'SKU-NDL', 400, 600) returning id as product_b \gset

-- Stock in for tenant A
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, quantity, unit_cost, created_by)
select :'tenant_a', :'product_a', w.id, 'in', 10, 350000, '11111111-1111-1111-1111-111111111111'
from public.warehouses w where w.tenant_id = :'tenant_a' and w.is_default;

\echo ''
\echo '=== TEST 1: custom field validation is enforced in the DATABASE ==='
-- Bad IMEI (12 digits) must be rejected by tg_validate_custom_fields
insert into public.products (tenant_id, name, custom_fields)
values (:'tenant_a', 'Bad Phone', '{"imei":"12345"}');
\echo '(expected: ERROR invalid format)'
-- Missing required IMEI must be rejected
insert into public.products (tenant_id, name) values (:'tenant_a', 'No IMEI Phone');
\echo '(expected: ERROR required)'
-- Duplicate IMEI must be rejected
insert into public.products (tenant_id, name, custom_fields)
values (:'tenant_a', 'Clone', '{"imei":"356938035643809"}');
\echo '(expected: ERROR must be unique)'

\echo ''
\echo '=== TEST 2: tenant isolation — Owner B queries as authenticated ==='
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as "tenant_B_sees_own_products" from public.v_products;
select count(*) as "tenant_B_sees_tenant_A_rows" from public.v_products where tenant_id = :'tenant_a';
select count(*) as "tenant_B_sees_A_tenant_row" from public.tenants where id = :'tenant_a';
reset role;

\echo ''
\echo '=== TEST 3: owner sees cost price, cashier does not ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select name, cost_price as "owner_sees_cost", selling_price from public.v_products;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select name, cost_price as "cashier_sees_cost", selling_price, stock_on_hand from public.v_products;
\echo '-- and the base column is not even selectable for the cashier:'
select cost_price from public.products limit 1;
\echo '(expected: ERROR permission denied for column cost_price)'
reset role;

\echo ''
\echo '=== TEST 4: cashier is blocked from the P&L report ==='
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select * from public.report_profit_loss(:'tenant_a', current_date - 30, current_date);
\echo '(expected: ERROR 42501 permission)'
reset role;

\echo ''
\echo '=== TEST 5: POS sale end-to-end as the CASHIER ==='
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.invoices (tenant_id, kind, status, number, currency_code, created_by)
values (:'tenant_a', 'pos', 'draft', null, 'MMK', '33333333-3333-3333-3333-333333333333')
returning id as inv \gset
insert into public.invoice_items (tenant_id, invoice_id, product_id, description, quantity, unit_price)
values (:'tenant_a', :'inv', :'product_a', 'Galaxy A15', 2, 450000);
select number, status, total, paid_amount, balance_due from public.post_invoice(:'inv', 900000, 'cash');
reset role;

\echo ''
\echo '=== TEST 6: stock was deducted and cost captured ==='
select p.name, s.quantity as "stock_after_sale", s.avg_cost
  from public.stock_levels s join public.products p on p.id = s.product_id
 where s.tenant_id = :'tenant_a';
select number, total, cost_total, (total - cost_total) as gross_profit from public.invoices where id = :'inv';

\echo ''
\echo '=== TEST 7: dashboard_summary hides profit keys from the cashier ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select jsonb_pretty(public.dashboard_summary(:'tenant_a')) as owner_dashboard;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select jsonb_pretty(public.dashboard_summary(:'tenant_a')) as cashier_dashboard;
reset role;

\echo ''
\echo '=== TEST 8: owner P&L works ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select section, account_code, account_name, amount from public.report_profit_loss(:'tenant_a', current_date - 30, current_date);
reset role;

\echo ''
\echo '=== TEST 9: audit log captured the writes ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select action, table_name, user_email, changed_keys
  from public.audit_logs where tenant_id = :'tenant_a' order by id desc limit 6;
\echo '-- cashier may not read the audit log:'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select count(*) as "cashier_audit_rows" from public.audit_logs;
reset role;

\echo ''
\echo '=== TEST 10: cashier cannot escalate — invite, settings, other users rows ==='
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.invite_member(:'tenant_a', 'owner', 'hacker@test.mm');
\echo '(expected: ERROR no permission to invite)'
update public.tenants set name = 'Hacked' where id = :'tenant_a';
\echo '(expected: UPDATE 0 — RLS filtered the row out)'
select count(*) as "cashier_sees_own_txns_only" from public.transactions;
reset role;

\echo ''
\echo '=== TEST 11: exchange-rate upsert (ON CONFLICT needs a non-partial index) ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.exchange_rates (tenant_id, base_code, quote_code, rate, rate_date, source, created_by)
values (:'tenant_a', 'MMK', 'USD', 4500, current_date, 'manual', '11111111-1111-1111-1111-111111111111')
on conflict (tenant_id, base_code, quote_code, rate_date)
do update set rate = excluded.rate;
-- Saving again the same day must REPLACE, not duplicate.
insert into public.exchange_rates (tenant_id, base_code, quote_code, rate, rate_date, source, created_by)
values (:'tenant_a', 'MMK', 'USD', 4650, current_date, 'manual', '11111111-1111-1111-1111-111111111111')
on conflict (tenant_id, base_code, quote_code, rate_date)
do update set rate = excluded.rate;
select count(*) as "rows_for_today", max(rate) as "current_rate"
  from public.exchange_rates where tenant_id = :'tenant_a' and quote_code = 'USD';
\echo '(expected: 1 row, rate 4650)'
reset role;

\echo ''
\echo '=== TEST 12: warehouse transfer moves stock and nets to zero ==='
-- Second location for tenant A
insert into public.warehouses (tenant_id, code, name, is_default)
values (:'tenant_a', 'BR2', 'Branch 2', false) returning id as wh2 \gset
select id as wh1 from public.warehouses where tenant_id = :'tenant_a' and is_default \gset

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, quantity, unit_cost, transfer_group, created_by)
values
  (:'tenant_a', :'product_a', :'wh1', 'transfer', -3, 350000, gen_random_uuid(), '11111111-1111-1111-1111-111111111111');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, quantity, unit_cost, transfer_group, created_by)
values
  (:'tenant_a', :'product_a', :'wh2', 'transfer', 3, 350000, gen_random_uuid(), '11111111-1111-1111-1111-111111111111');
reset role;

select w.code, s.quantity, s.avg_cost
  from public.stock_levels s join public.warehouses w on w.id = s.warehouse_id
 where s.tenant_id = :'tenant_a' and s.product_id = :'product_a'
 order by w.code;
\echo '(expected: BR2 = 3, MAIN = 5 — total still 8, cost preserved at 350000)'

\echo ''
\echo '=== TEST 13: stock ledger is append-only even for the owner ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.stock_movements set quantity = 999 where tenant_id = :'tenant_a';
\echo '(expected: UPDATE 0 — corrections require a counter-movement)'
delete from public.stock_movements where tenant_id = :'tenant_a';
\echo '(expected: DELETE 0)'
reset role;
