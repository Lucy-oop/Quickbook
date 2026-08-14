-- =============================================================================
--  Myanmar Universal ERP — 0006 MASKED VIEWS, RPC & REPORTS
--
--  Views are `security_invoker = on`, so the caller's RLS policies still apply;
--  the cost/margin columns are produced by SECURITY DEFINER helpers that return
--  NULL unless the caller holds the matching permission.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- COST MASKING HELPERS
-- -----------------------------------------------------------------------------
create or replace function public.masked_product_cost(p_tenant_id uuid, p_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.has_permission(p_tenant_id, 'products.read_cost')
      then (select p.cost_price from public.products p where p.id = p_product_id)
    else null
  end;
$$;

create or replace function public.masked_avg_cost(p_tenant_id uuid, p_product_id uuid, p_warehouse_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.has_permission(p_tenant_id, 'products.read_cost')
      then (select s.avg_cost from public.stock_levels s
             where s.tenant_id = p_tenant_id and s.product_id = p_product_id
               and s.warehouse_id = p_warehouse_id)
    else null
  end;
$$;

create or replace function public.masked_invoice_cost(p_tenant_id uuid, p_invoice_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.has_permission(p_tenant_id, 'reports.margin')
      then (select i.cost_total from public.invoices i where i.id = p_invoice_id)
    else null
  end;
$$;

grant execute on function public.masked_product_cost(uuid, uuid) to authenticated;
grant execute on function public.masked_avg_cost(uuid, uuid, uuid) to authenticated;
grant execute on function public.masked_invoice_cost(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- VIEWS the client actually reads
-- -----------------------------------------------------------------------------
create or replace view public.v_products with (security_invoker = on) as
select
  p.id, p.tenant_id, p.category_id, c.name as category_name,
  p.sku, p.barcode, p.name, p.name_my, p.description, p.unit,
  p.track_inventory, p.selling_price, p.wholesale_price, p.currency_code,
  p.tax_rate, p.reorder_level, p.reorder_quantity, p.image_url,
  p.custom_fields, p.is_active, p.created_at, p.updated_at,
  public.masked_product_cost(p.tenant_id, p.id) as cost_price,
  coalesce((select sum(s.quantity) from public.stock_levels s where s.product_id = p.id), 0) as stock_on_hand,
  coalesce((select sum(s.quantity) from public.stock_levels s where s.product_id = p.id), 0) <= p.reorder_level
    and p.track_inventory as is_low_stock
from public.products p
left join public.product_categories c on c.id = p.category_id;

create or replace view public.v_stock_levels with (security_invoker = on) as
select
  s.tenant_id, s.product_id, s.warehouse_id, s.quantity, s.reserved, s.available,
  s.updated_at,
  public.masked_avg_cost(s.tenant_id, s.product_id, s.warehouse_id) as avg_cost
from public.stock_levels s;

create or replace view public.v_invoices with (security_invoker = on) as
select
  i.id, i.tenant_id, i.kind, i.status, i.number, i.contact_id, i.contact_snapshot,
  i.warehouse_id, i.issue_date, i.due_date, i.currency_code, i.exchange_rate,
  i.subtotal, i.discount_amount, i.tax_amount, i.shipping_amount, i.total,
  i.paid_amount, i.balance_due, i.total_base, i.payment_method, i.notes, i.terms,
  i.custom_fields, i.issued_at, i.created_by, i.created_at, i.updated_at,
  ct.name as contact_name, ct.phone as contact_phone,
  u.full_name as created_by_name,
  public.masked_invoice_cost(i.tenant_id, i.id) as cost_total,
  case
    when i.status in ('issued','partial','overdue') and i.due_date is not null and i.due_date < current_date
      then current_date - i.due_date
    else 0
  end as days_overdue
from public.invoices i
left join public.contacts ct on ct.id = i.contact_id
left join public.users u on u.id = i.created_by;

create or replace view public.v_low_stock with (security_invoker = on) as
select
  p.tenant_id, p.id as product_id, p.name, p.sku, p.barcode, p.unit,
  p.reorder_level, p.reorder_quantity,
  s.warehouse_id, w.name as warehouse_name,
  coalesce(s.quantity, 0) as quantity
from public.products p
join public.stock_levels s on s.product_id = p.id
join public.warehouses w on w.id = s.warehouse_id
where p.track_inventory
  and p.is_active
  and s.quantity <= p.reorder_level;

grant select on public.v_products, public.v_stock_levels, public.v_invoices, public.v_low_stock
  to authenticated;

-- =============================================================================
--  TENANT PROVISIONING
--  Creating a tenant needs privileged writes (tenant + roles + owner membership
--  must all appear atomically), so it lives behind one SECURITY DEFINER RPC.
-- =============================================================================
create or replace function public.create_tenant(
  p_name          text,
  p_business_type public.business_type default 'retail',
  p_base_currency char(3) default 'MMK',
  p_locale        text default 'my',
  p_phone         text default null
)
returns public.tenants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user     uuid := auth.uid();
  v_tenant   public.tenants;
  v_slug     citext;
  v_role     record;
  v_new_role uuid;
  v_owner_role uuid;
  v_wh       uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);

  insert into public.tenants (name, slug, business_type, base_currency, default_locale, phone, created_by, trial_ends_at)
  values (p_name, v_slug, p_business_type, p_base_currency, p_locale, p_phone, v_user, now() + interval '30 days')
  returning * into v_tenant;

  -- Clone every system role template (tenant_id is null) for this tenant.
  for v_role in select * from public.roles where tenant_id is null and is_system order by rank loop
    insert into public.roles (tenant_id, key, name_en, name_my, description, is_system, is_owner_role, rank)
    values (v_tenant.id, v_role.key, v_role.name_en, v_role.name_my, v_role.description, false, v_role.is_owner_role, v_role.rank)
    returning id into v_new_role;

    insert into public.roles_permissions (role_id, permission_key)
    select v_new_role, rp.permission_key
      from public.roles_permissions rp
     where rp.role_id = v_role.id;

    if v_role.is_owner_role then
      v_owner_role := v_new_role;
    end if;
  end loop;

  insert into public.memberships (tenant_id, user_id, role_id, status, joined_at)
  values (v_tenant.id, v_user, v_owner_role, 'active', now());

  update public.users set last_tenant_id = v_tenant.id where id = v_user;

  -- Default chart of accounts (Myanmar SME oriented).
  insert into public.accounts (tenant_id, code, name_en, name_my, type, subtype, is_cash_like, is_system)
  values
    (v_tenant.id, '1000', 'Cash on Hand',        'လက်ကျန်ငွေသား',       'asset',     'cash',          true,  true),
    (v_tenant.id, '1010', 'Bank Account',        'ဘဏ်စာရင်း',           'asset',     'bank',          true,  true),
    (v_tenant.id, '1020', 'Mobile Wallet',       'မိုဘိုင်းပိုက်ဆံအိတ်',   'asset',     'mobile_wallet', true,  true),
    (v_tenant.id, '1100', 'Accounts Receivable', 'ရရန်ရှိငွေ',            'asset',     'ar',            false, true),
    (v_tenant.id, '1200', 'Inventory',           'ကုန်ပစ္စည်းလက်ကျန်',    'asset',     'inventory',     false, true),
    (v_tenant.id, '2000', 'Accounts Payable',    'ပေးရန်ရှိငွေ',          'liability', 'ap',            false, true),
    (v_tenant.id, '3000', 'Owner Equity',        'ပိုင်ရှင်မတည်ငွေ',       'equity',    'capital',       false, true),
    (v_tenant.id, '4000', 'Sales Revenue',       'ရောင်းရငွေ',            'income',    'sales',         false, true),
    (v_tenant.id, '4100', 'Other Income',        'အခြားဝင်ငွေ',           'income',    'other',         false, false),
    (v_tenant.id, '5000', 'Cost of Goods Sold',  'ကုန်ကျစရိတ်',           'expense',   'cogs',          false, true),
    (v_tenant.id, '6000', 'Rent',                'အငှားခ',               'expense',   'opex',          false, false),
    (v_tenant.id, '6010', 'Salaries & Wages',    'လစာနှင့်လုပ်အားခ',      'expense',   'opex',          false, false),
    (v_tenant.id, '6020', 'Electricity & Water', 'မီးနှင့်ရေ',            'expense',   'opex',          false, false),
    (v_tenant.id, '6030', 'Transportation',      'သယ်ယူပို့ဆောင်ရေး',     'expense',   'opex',          false, false),
    (v_tenant.id, '6040', 'Supplies',            'ရုံးသုံးပစ္စည်း',        'expense',   'opex',          false, false),
    (v_tenant.id, '6900', 'Other Expenses',      'အခြားကုန်ကျစရိတ်',      'expense',   'other',         false, false);

  insert into public.warehouses (tenant_id, code, name, name_my, is_default)
  values (v_tenant.id, 'MAIN', 'Main Store', 'ပင်မဆိုင်', true)
  returning id into v_wh;

  insert into public.document_sequences (tenant_id, doc_type, prefix, padding, next_number)
  values
    (v_tenant.id, 'sales_invoice',    'INV-', 5, 1),
    (v_tenant.id, 'purchase_invoice', 'PUR-', 5, 1),
    (v_tenant.id, 'pos',              'POS-', 6, 1),
    (v_tenant.id, 'payment',          'PAY-', 5, 1),
    (v_tenant.id, 'journal',          'JV-',  5, 1);

  return v_tenant;
end;
$$;

grant execute on function public.create_tenant(text, public.business_type, char, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- DOCUMENT NUMBERING
-- -----------------------------------------------------------------------------
create or replace function public.next_document_number(p_tenant_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seq public.document_sequences;
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  insert into public.document_sequences (tenant_id, doc_type, prefix)
  values (p_tenant_id, p_doc_type, upper(left(p_doc_type, 3)) || '-')
  on conflict (tenant_id, doc_type) do nothing;

  update public.document_sequences
     set next_number = next_number + 1
   where tenant_id = p_tenant_id and doc_type = p_doc_type
  returning * into v_seq;

  return v_seq.prefix || lpad((v_seq.next_number - 1)::text, v_seq.padding, '0');
end;
$$;

grant execute on function public.next_document_number(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- MEMBER INVITATION / REVOCATION
-- -----------------------------------------------------------------------------
create or replace function public.invite_member(
  p_tenant_id       uuid,
  p_role_key        text,
  p_email           text default null,
  p_phone           text default null,
  p_warehouse_scope uuid[] default '{}'
)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid;
  v_user_id uuid;
  v_row     public.memberships;
begin
  if not public.has_permission(p_tenant_id, 'members.invite') then
    raise exception 'You do not have permission to invite members' using errcode = '42501';
  end if;
  if p_email is null and p_phone is null then
    raise exception 'An email address or phone number is required' using errcode = '22023';
  end if;

  select id into v_role_id from public.roles
   where tenant_id = p_tenant_id and key = p_role_key;
  if v_role_id is null then
    raise exception 'Unknown role "%"', p_role_key using errcode = '22023';
  end if;
  -- Only an existing owner may mint another owner.
  if exists (select 1 from public.roles where id = v_role_id and is_owner_role)
     and not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Only an owner can grant the owner role' using errcode = '42501';
  end if;

  select id into v_user_id from public.users
   where (p_email is not null and email = p_email::citext)
      or (p_phone is not null and phone = p_phone)
   limit 1;

  insert into public.memberships (
    tenant_id, user_id, role_id, status, warehouse_scope,
    invited_email, invited_phone, invited_by, joined_at
  ) values (
    p_tenant_id, v_user_id, v_role_id,
    (case when v_user_id is null then 'invited' else 'active' end)::public.membership_status,
    coalesce(p_warehouse_scope, '{}'),
    p_email::citext, p_phone, auth.uid(),
    case when v_user_id is null then null else now() end
  )
  on conflict (tenant_id, user_id) where user_id is not null
  do update set role_id = excluded.role_id,
                status = 'active',
                warehouse_scope = excluded.warehouse_scope,
                revoked_at = null
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.invite_member(uuid, text, text, text, uuid[]) to authenticated;

create or replace function public.set_member_status(p_membership_id uuid, p_status public.membership_status)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.memberships;
begin
  select * into v_row from public.memberships where id = p_membership_id;
  if v_row is null then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_row.tenant_id, 'members.manage') then
    raise exception 'You do not have permission to manage members' using errcode = '42501';
  end if;
  if v_row.user_id = auth.uid() then
    raise exception 'You cannot change your own membership' using errcode = '42501';
  end if;
  if exists (select 1 from public.roles r where r.id = v_row.role_id and r.is_owner_role)
     and not public.is_tenant_owner(v_row.tenant_id) then
    raise exception 'Only an owner can modify another owner' using errcode = '42501';
  end if;

  update public.memberships
     set status = p_status,
         revoked_at = case when p_status in ('revoked','suspended') then now() else null end
   where id = p_membership_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.set_member_status(uuid, public.membership_status) to authenticated;

-- =============================================================================
--  INVOICE POSTING
--  Draft -> issued: totals recalculated, number assigned, stock deducted,
--  a ledger transaction written, and (for POS) the payment recorded — one txn.
-- =============================================================================
create or replace function public.post_invoice(
  p_invoice_id  uuid,
  p_paid_amount numeric default 0,
  p_method      public.payment_method default 'cash'
)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv       public.invoices;
  v_item      record;
  v_wh        uuid;
  v_cost      numeric(20,4) := 0;
  v_unit_cost numeric(20,4);
  v_subtotal  numeric(20,4);
  v_tax       numeric(20,4);
  v_total     numeric(20,4);
  v_number    text;
  v_txn_id    uuid;
  v_income_acct  uuid;
  v_cash_acct    uuid;
  v_ar_acct      uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if v_inv is null then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_inv.tenant_id, 'invoices.create') then
    raise exception 'You do not have permission to issue invoices' using errcode = '42501';
  end if;
  if v_inv.status <> 'draft' then
    raise exception 'Invoice % has already been issued', v_inv.number using errcode = '22023';
  end if;

  v_wh := coalesce(
    v_inv.warehouse_id,
    (select id from public.warehouses where tenant_id = v_inv.tenant_id and is_default limit 1)
  );

  select sum(round(quantity * unit_price, 4) - discount_amount), sum(tax_amount)
    into v_subtotal, v_tax
    from public.invoice_items where invoice_id = p_invoice_id;

  v_subtotal := coalesce(v_subtotal, 0);
  v_tax      := coalesce(v_tax, 0);
  v_total    := v_subtotal - v_inv.discount_amount + v_tax + v_inv.shipping_amount;

  -- Deduct stock and snapshot the cost of each tracked line.
  for v_item in
    select ii.*, p.track_inventory
      from public.invoice_items ii
      join public.products p on p.id = ii.product_id
     where ii.invoice_id = p_invoice_id and p.track_inventory
  loop
    select coalesce(s.avg_cost, v_item.unit_cost, 0) into v_unit_cost
      from public.stock_levels s
     where s.tenant_id = v_inv.tenant_id and s.product_id = v_item.product_id and s.warehouse_id = v_wh;

    v_unit_cost := coalesce(v_unit_cost, 0);

    insert into public.stock_movements (
      tenant_id, product_id, warehouse_id, kind, quantity, unit_cost,
      reference_type, reference_id, invoice_id, created_by, notes
    ) values (
      v_inv.tenant_id, v_item.product_id, v_wh,
      (case when v_inv.kind = 'purchase' then 'purchase' else 'sale' end)::public.stock_move_kind,
      case when v_inv.kind = 'purchase' then v_item.quantity else -v_item.quantity end,
      case when v_inv.kind = 'purchase' then v_item.unit_price else v_unit_cost end,
      'invoice', p_invoice_id, p_invoice_id, auth.uid(), v_inv.number
    );

    update public.invoice_items set unit_cost = v_unit_cost where id = v_item.id;
    v_cost := v_cost + round(v_item.quantity * v_unit_cost, 4);
  end loop;

  -- Keep a number only if it is a real one. A client-side placeholder
  -- ('DRAFT-…') must not survive into the issued document.
  v_number := case
                when v_inv.number is null or v_inv.number = '' or v_inv.number like 'DRAFT-%'
                  then null
                else v_inv.number
              end;

  v_number := coalesce(v_number,
                       public.next_document_number(v_inv.tenant_id,
                         case v_inv.kind when 'purchase' then 'purchase_invoice'
                                         when 'pos' then 'pos'
                                         else 'sales_invoice' end));

  select id into v_income_acct from public.accounts
   where tenant_id = v_inv.tenant_id and code = case when v_inv.kind = 'purchase' then '5000' else '4000' end;
  select id into v_ar_acct from public.accounts where tenant_id = v_inv.tenant_id and code = '1100';
  select id into v_cash_acct from public.accounts
   where tenant_id = v_inv.tenant_id
     and code = case p_method when 'bank_transfer' then '1010'
                              when 'card' then '1010'
                              when 'cash' then '1000'
                              else '1020' end;

  insert into public.transactions (
    tenant_id, reference, type, status, occurred_on, contact_id,
    account_id, payment_account_id, payment_method, currency_code, exchange_rate,
    amount, tax_amount, description, invoice_id, created_by
  ) values (
    v_inv.tenant_id, v_number,
    (case when v_inv.kind = 'purchase' then 'expense' else 'income' end)::public.transaction_type,
    'posted', v_inv.issue_date, v_inv.contact_id,
    v_income_acct,
    case when p_paid_amount > 0 then v_cash_acct else v_ar_acct end,
    p_method, v_inv.currency_code, v_inv.exchange_rate,
    v_total, v_tax, 'Invoice ' || v_number, p_invoice_id, auth.uid()
  ) returning id into v_txn_id;

  if p_paid_amount > 0 then
    insert into public.payments (
      tenant_id, invoice_id, contact_id, transaction_id, account_id,
      number, direction, method, currency_code, exchange_rate, amount, paid_on, created_by
    ) values (
      v_inv.tenant_id, p_invoice_id, v_inv.contact_id, v_txn_id, v_cash_acct,
      public.next_document_number(v_inv.tenant_id, 'payment'),
      case when v_inv.kind = 'purchase' then 'out' else 'in' end,
      p_method, v_inv.currency_code, v_inv.exchange_rate,
      least(p_paid_amount, v_total), current_date, auth.uid()
    );
  end if;

  update public.invoices
     set number         = v_number,
         subtotal       = v_subtotal,
         tax_amount     = v_tax,
         total          = v_total,
         cost_total     = v_cost,
         paid_amount    = least(coalesce(p_paid_amount, 0), v_total),
         payment_method = p_method,
         warehouse_id   = v_wh,
         status         = (case
                            when coalesce(p_paid_amount, 0) >= v_total then 'paid'
                            when coalesce(p_paid_amount, 0) > 0        then 'partial'
                            else 'issued'
                          end)::public.invoice_status,
         issued_at      = now()
   where id = p_invoice_id
  returning * into v_inv;

  return v_inv;
end;
$$;

grant execute on function public.post_invoice(uuid, numeric, public.payment_method) to authenticated;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text default null)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invoices;
  v_mv  record;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if v_inv is null then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_inv.tenant_id, 'invoices.void') then
    raise exception 'You do not have permission to void invoices' using errcode = '42501';
  end if;
  if v_inv.status = 'void' then
    return v_inv;
  end if;

  -- Reverse stock with counter-movements; the ledger stays append-only.
  for v_mv in select * from public.stock_movements where invoice_id = p_invoice_id loop
    insert into public.stock_movements (
      tenant_id, product_id, warehouse_id, kind, quantity, unit_cost,
      reference_type, reference_id, created_by, notes
    ) values (
      v_mv.tenant_id, v_mv.product_id, v_mv.warehouse_id, 'return',
      abs(v_mv.quantity), v_mv.unit_cost, 'void', p_invoice_id, auth.uid(),
      coalesce(p_reason, 'Void ' || v_inv.number)
    );
  end loop;

  update public.transactions
     set status = 'void', voided_at = now(), voided_by = auth.uid()
   where invoice_id = p_invoice_id;

  update public.invoices
     set status = 'void', voided_at = now(), voided_by = auth.uid(),
         notes = coalesce(notes, '') || coalesce(E'\nVoided: ' || p_reason, '')
   where id = p_invoice_id
  returning * into v_inv;

  return v_inv;
end;
$$;

grant execute on function public.void_invoice(uuid, text) to authenticated;

-- =============================================================================
--  REPORTS — every one of these is permission-gated in its first statement,
--  because SECURITY DEFINER bypasses the RLS that would otherwise protect them.
-- =============================================================================

-- Profit & Loss ---------------------------------------------------------------
create or replace function public.report_profit_loss(
  p_tenant_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  section      text,
  account_id   uuid,
  account_code text,
  account_name text,
  amount       numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.pnl') then
    raise exception 'You do not have permission to view the Profit & Loss report' using errcode = '42501';
  end if;

  return query
  with movement as (
    select t.account_id, a.type, a.code, a.name_en, sum(t.amount_base) as total
      from public.transactions t
      join public.accounts a on a.id = t.account_id
     where t.tenant_id = p_tenant_id
       and t.status = 'posted'
       and t.occurred_on between p_from and p_to
       and a.type in ('income','expense')
     group by t.account_id, a.type, a.code, a.name_en
  ),
  cogs as (
    select coalesce(sum(i.cost_total * i.exchange_rate), 0) as total
      from public.invoices i
     where i.tenant_id = p_tenant_id
       and i.kind in ('sales','pos')
       and i.status in ('issued','partial','paid','overdue')
       and i.issue_date between p_from and p_to
  )
  select case when m.type = 'income' then 'revenue' else 'expense' end,
         m.account_id, m.code, m.name_en, round(m.total, 2)
    from movement m
  union all
  select 'cogs', null::uuid, '5000', 'Cost of Goods Sold', round(c.total, 2)
    from cogs c where c.total <> 0
  order by 1, 3;
end;
$$;

-- Cash flow summary -----------------------------------------------------------
create or replace function public.report_cash_flow(
  p_tenant_id uuid,
  p_from      date,
  p_to        date,
  p_bucket    text default 'day'          -- 'day' | 'week' | 'month'
)
returns table (
  period   date,
  inflow   numeric,
  outflow  numeric,
  net      numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.cashflow') then
    raise exception 'You do not have permission to view the Cash Flow report' using errcode = '42501';
  end if;

  return query
  select date_trunc(p_bucket, t.occurred_on)::date as period,
         round(coalesce(sum(t.amount_base) filter (where t.type = 'income'),  0), 2) as inflow,
         round(coalesce(sum(t.amount_base) filter (where t.type = 'expense'), 0), 2) as outflow,
         round(coalesce(sum(t.amount_base) filter (where t.type = 'income'),  0)
             - coalesce(sum(t.amount_base) filter (where t.type = 'expense'), 0), 2) as net
    from public.transactions t
    left join public.accounts a on a.id = t.payment_account_id
   where t.tenant_id = p_tenant_id
     and t.status = 'posted'
     and t.occurred_on between p_from and p_to
     and coalesce(a.is_cash_like, true)
   group by 1
   order by 1;
end;
$$;

-- Accounts receivable / payable aging -----------------------------------------
create or replace function public.report_ar_ap(
  p_tenant_id uuid,
  p_kind      text default 'receivable'   -- 'receivable' | 'payable'
)
returns table (
  contact_id   uuid,
  contact_name text,
  current_due  numeric,
  days_1_30    numeric,
  days_31_60   numeric,
  days_61_90   numeric,
  days_90_plus numeric,
  total_due    numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.ar_ap') then
    raise exception 'You do not have permission to view receivables and payables' using errcode = '42501';
  end if;

  return query
  with open_inv as (
    select i.contact_id,
           coalesce(c.name, 'Walk-in') as contact_name,
           i.balance_due * i.exchange_rate as due,
           greatest(current_date - coalesce(i.due_date, i.issue_date), 0) as age
      from public.invoices i
      left join public.contacts c on c.id = i.contact_id
     where i.tenant_id = p_tenant_id
       and i.status in ('issued','partial','overdue')
       and i.balance_due > 0
       and ((p_kind = 'receivable' and i.kind in ('sales','pos'))
         or (p_kind = 'payable'    and i.kind = 'purchase'))
  )
  select o.contact_id, o.contact_name,
         round(coalesce(sum(o.due) filter (where o.age = 0), 0), 2),
         round(coalesce(sum(o.due) filter (where o.age between 1 and 30), 0), 2),
         round(coalesce(sum(o.due) filter (where o.age between 31 and 60), 0), 2),
         round(coalesce(sum(o.due) filter (where o.age between 61 and 90), 0), 2),
         round(coalesce(sum(o.due) filter (where o.age > 90), 0), 2),
         round(sum(o.due), 2)
    from open_inv o
   group by o.contact_id, o.contact_name
   order by 8 desc;
end;
$$;

-- Dashboard summary -----------------------------------------------------------
-- Returns a single jsonb document. Keys the caller is not allowed to see are
-- simply absent, so a cashier's dashboard renders without profit tiles.
create or replace function public.dashboard_summary(
  p_tenant_id uuid,
  p_from      date default (current_date - 29),
  p_to        date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result     jsonb := '{}'::jsonb;
  v_can_pnl    boolean := public.has_permission(p_tenant_id, 'reports.pnl');
  v_can_margin boolean := public.has_permission(p_tenant_id, 'reports.margin');
  v_can_arap   boolean := public.has_permission(p_tenant_id, 'reports.ar_ap');
  v_can_inv    boolean := public.has_permission(p_tenant_id, 'inventory.read');
  v_own_only   boolean := not public.has_permission(p_tenant_id, 'reports.sales');
  v_uid        uuid := auth.uid();
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Sales — restricted to the caller's own invoices when they lack reports.sales
  select jsonb_build_object(
           'sales_today',   round(coalesce(sum(total_base) filter (where issue_date = current_date), 0), 2),
           'sales_period',  round(coalesce(sum(total_base), 0), 2),
           'invoice_count', count(*),
           'avg_ticket',    round(coalesce(avg(total_base), 0), 2)
         )
    into v_result
    from public.invoices
   where tenant_id = p_tenant_id
     and kind in ('sales','pos')
     and status <> 'void'
     and issue_date between p_from and p_to
     and (not v_own_only or created_by = v_uid);

  if v_can_pnl then
    v_result := v_result || (
      select jsonb_build_object(
        'income_period',  round(coalesce(sum(amount_base) filter (where type = 'income'),  0), 2),
        'expense_period', round(coalesce(sum(amount_base) filter (where type = 'expense'), 0), 2),
        'net_period',     round(coalesce(sum(amount_base) filter (where type = 'income'),  0)
                              - coalesce(sum(amount_base) filter (where type = 'expense'), 0), 2))
        from public.transactions
       where tenant_id = p_tenant_id and status = 'posted' and occurred_on between p_from and p_to
    );
  end if;

  if v_can_margin then
    v_result := v_result || (
      select jsonb_build_object(
        'gross_profit', round(coalesce(sum(total_base - (cost_total * exchange_rate)), 0), 2),
        'margin_pct',   case when coalesce(sum(total_base), 0) = 0 then 0
                             else round(100 * coalesce(sum(total_base - (cost_total * exchange_rate)), 0)
                                            / sum(total_base), 2) end)
        from public.invoices
       where tenant_id = p_tenant_id and kind in ('sales','pos')
         and status <> 'void' and issue_date between p_from and p_to
    );
  end if;

  if v_can_arap then
    v_result := v_result || (
      select jsonb_build_object(
        'receivable_total', round(coalesce(sum(balance_due * exchange_rate) filter (where kind in ('sales','pos')), 0), 2),
        'payable_total',    round(coalesce(sum(balance_due * exchange_rate) filter (where kind = 'purchase'), 0), 2),
        'overdue_count',    count(*) filter (where due_date < current_date))
        from public.invoices
       where tenant_id = p_tenant_id and status in ('issued','partial','overdue') and balance_due > 0
    );
  end if;

  if v_can_inv then
    v_result := v_result || (
      select jsonb_build_object(
        'low_stock_count', count(*),
        'product_count',   (select count(*) from public.products where tenant_id = p_tenant_id and is_active))
        from public.v_low_stock where tenant_id = p_tenant_id
    );
  end if;

  return v_result;
end;
$$;

-- Sales / expense trend for the dashboard chart -------------------------------
create or replace function public.report_sales_trend(
  p_tenant_id uuid,
  p_from      date default (current_date - 29),
  p_to        date default current_date
)
returns table (day date, sales numeric, expenses numeric, orders bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_expense boolean := public.has_permission(p_tenant_id, 'reports.pnl');
  v_own_only    boolean := not public.has_permission(p_tenant_id, 'reports.sales');
  v_uid         uuid := auth.uid();
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
  select d::date as day,
         round(coalesce((
           select sum(i.total_base) from public.invoices i
            where i.tenant_id = p_tenant_id and i.kind in ('sales','pos')
              and i.status <> 'void' and i.issue_date = d::date
              and (not v_own_only or i.created_by = v_uid)), 0), 2),
         case when v_can_expense then round(coalesce((
           select sum(t.amount_base) from public.transactions t
            where t.tenant_id = p_tenant_id and t.status = 'posted'
              and t.type = 'expense' and t.occurred_on = d::date), 0), 2) else 0 end,
         coalesce((
           select count(*) from public.invoices i
            where i.tenant_id = p_tenant_id and i.kind in ('sales','pos')
              and i.status <> 'void' and i.issue_date = d::date
              and (not v_own_only or i.created_by = v_uid)), 0)
    from generate_series(p_from, p_to, interval '1 day') d
   order by 1;
end;
$$;

-- Top selling products --------------------------------------------------------
create or replace function public.report_top_products(
  p_tenant_id uuid,
  p_from      date default (current_date - 29),
  p_to        date default current_date,
  p_limit     int  default 5
)
returns table (product_id uuid, name text, quantity numeric, revenue numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.sales') then
    raise exception 'You do not have permission to view sales reports' using errcode = '42501';
  end if;

  return query
  select ii.product_id,
         coalesce(p.name, ii.description) as name,
         round(sum(ii.quantity), 2),
         round(sum(ii.line_total * i.exchange_rate), 2)
    from public.invoice_items ii
    join public.invoices i on i.id = ii.invoice_id
    left join public.products p on p.id = ii.product_id
   where i.tenant_id = p_tenant_id
     and i.kind in ('sales','pos')
     and i.status <> 'void'
     and i.issue_date between p_from and p_to
   group by ii.product_id, coalesce(p.name, ii.description)
   order by 4 desc
   limit p_limit;
end;
$$;

grant execute on function public.report_profit_loss(uuid, date, date) to authenticated;
grant execute on function public.report_cash_flow(uuid, date, date, text) to authenticated;
grant execute on function public.report_ar_ap(uuid, text) to authenticated;
grant execute on function public.dashboard_summary(uuid, date, date) to authenticated;
grant execute on function public.report_sales_trend(uuid, date, date) to authenticated;
grant execute on function public.report_top_products(uuid, date, date, int) to authenticated;
