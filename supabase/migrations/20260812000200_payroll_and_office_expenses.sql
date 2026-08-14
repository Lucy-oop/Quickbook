-- =============================================================================
--  SALARY (လစာစရိတ်) & OFFICE EXPENSES (ရုံးသုံးစရိတ်)
--
--  Expense categories are already modelled as expense accounts in the chart of
--  accounts, so this migration does not invent a parallel category system. It
--  adds the one thing the chart could not express — which *kind* of spending an
--  account represents — plus the structured payroll detail a salary payment
--  needs and the chart of accounts has nowhere to put.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  Expense grouping
--
--  `subtype` is free text used for reporting labels; it is not a classification
--  the UI can branch on safely. An enum column makes "is this a salary entry?"
--  a typed question, which is what drives the conditional fields in the Add
--  Expense dialog and the dashboard breakdown.
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.expense_group as enum ('payroll','office','inventory','other');
exception when duplicate_object then null; end $$;

alter table public.accounts
  add column if not exists expense_group public.expense_group;

comment on column public.accounts.expense_group is
  'Set on expense accounts only. Drives the Add Expense dialog''s conditional '
  'fields and the dashboard expense breakdown. Null for non-expense accounts.';

create index if not exists accounts_tenant_expense_group_idx
  on public.accounts (tenant_id, expense_group) where is_active;

-- -----------------------------------------------------------------------------
--  EMPLOYEES
--  Deliberately not folded into `contacts`: contacts is a customer/supplier
--  ledger that appears in invoice pickers, and staff records carry a base
--  salary that must not leak into that surface.
-- -----------------------------------------------------------------------------
create table if not exists public.employees (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  code           text,                       -- payroll / staff ID
  name           text not null,
  name_my        text,
  position       text,
  phone          text,
  -- Pre-fills the salary form; the transaction still stores what was paid.
  base_salary    numeric(20,4) not null default 0 check (base_salary >= 0),
  payment_method public.payment_method not null default 'cash',
  is_active      boolean not null default true,
  note           text,
  custom_fields  jsonb not null default '{}'::jsonb,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists employees_tenant_code_unique
  on public.employees (tenant_id, code) where code is not null;
create index if not exists employees_tenant_active_idx
  on public.employees (tenant_id, name) where is_active;

drop trigger if exists set_updated_at on public.employees;
create trigger set_updated_at before update on public.employees
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
--  PAYROLL ENTRIES
--  One row per salary payment, hanging off the expense transaction that carries
--  the money. Kept in a side table rather than as nullable columns on
--  `transactions` so that salary figures can be read under their own permission
--  — a member allowed to record expenses is not automatically allowed to read
--  everyone's pay.
--
--  `amount` on the transaction stays the source of truth for the ledger; the
--  breakdown here explains how it was arrived at.
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_entries (
  transaction_id   uuid primary key references public.transactions(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete restrict,
  -- Always the first of the month being paid for, so a period is one comparable
  -- value instead of a (year, month) pair that has to be sorted by hand.
  pay_period       date not null,
  base_amount      numeric(20,4) not null default 0 check (base_amount >= 0),
  bonus_amount     numeric(20,4) not null default 0 check (bonus_amount >= 0),
  deduction_amount numeric(20,4) not null default 0 check (deduction_amount >= 0),
  note             text,
  created_at       timestamptz not null default now(),
  constraint payroll_period_is_month_start check (extract(day from pay_period) = 1)
);

create index if not exists payroll_entries_tenant_period_idx
  on public.payroll_entries (tenant_id, pay_period desc);
create index if not exists payroll_entries_employee_idx
  on public.payroll_entries (tenant_id, employee_id, pay_period desc);

-- One salary payment per employee per period, so a double-tap on Save cannot
-- pay someone twice for the same month.
create unique index if not exists payroll_entries_employee_period_unique
  on public.payroll_entries (tenant_id, employee_id, pay_period);

-- -----------------------------------------------------------------------------
--  PERMISSIONS
--  Salary data is sensitive: a cashier may record expenses but must not read
--  the payroll of the shop.
-- -----------------------------------------------------------------------------
insert into public.permissions (key, module, label_en, label_my, is_sensitive)
values
  ('employees.read',   'payroll', 'View employees & payroll', 'ဝန်ထမ်းနှင့်လစာကြည့်ရန်', true),
  ('employees.manage', 'payroll', 'Manage employees',         'ဝန်ထမ်းစီမံရန်',          true)
on conflict (key) do nothing;

-- Granted to the system role *templates* (tenant_id is null) so newly created
-- tenants inherit it, and to the already-cloned roles of existing tenants.
insert into public.roles_permissions (role_id, permission_key)
select r.id, p.key
  from public.roles r
 cross join (values ('employees.read'), ('employees.manage')) as p(key)
 where r.key in ('owner', 'admin')
on conflict (role_id, permission_key) do nothing;

-- Managers and accountants run payroll but do not edit the staff list.
insert into public.roles_permissions (role_id, permission_key)
select r.id, 'employees.read'
  from public.roles r
 where r.key in ('manager', 'accountant')
on conflict (role_id, permission_key) do nothing;

-- -----------------------------------------------------------------------------
--  RLS
-- -----------------------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.payroll_entries enable row level security;

revoke all on public.employees from anon;
revoke all on public.payroll_entries from anon;

grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.payroll_entries to authenticated;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using (public.has_permission(tenant_id, 'employees.read'));

drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
  for all to authenticated
  using (public.has_permission(tenant_id, 'employees.manage'))
  with check (public.has_permission(tenant_id, 'employees.manage'));

drop policy if exists payroll_entries_select on public.payroll_entries;
create policy payroll_entries_select on public.payroll_entries
  for select to authenticated
  using (public.has_permission(tenant_id, 'employees.read'));

-- Recording a salary needs both halves: the right to write money out, and the
-- right to see the staff it is being paid to.
drop policy if exists payroll_entries_write on public.payroll_entries;
create policy payroll_entries_write on public.payroll_entries
  for all to authenticated
  using (
    public.has_permission(tenant_id, 'employees.read')
    and public.has_permission(tenant_id, 'transactions.create')
  )
  with check (
    public.has_permission(tenant_id, 'employees.read')
    and public.has_permission(tenant_id, 'transactions.create')
  );

-- -----------------------------------------------------------------------------
--  CHART OF ACCOUNTS — classify existing tenants' expense accounts and add the
--  office accounts the default chart was missing (maintenance).
-- -----------------------------------------------------------------------------
update public.accounts set expense_group = 'inventory' where type = 'expense' and subtype = 'cogs';
update public.accounts set expense_group = 'payroll'   where type = 'expense' and code = '6010';
update public.accounts set expense_group = 'office'    where type = 'expense' and code in ('6000','6020','6040','6050');
update public.accounts set expense_group = 'other'     where type = 'expense' and expense_group is null;

-- Salaries & Wages gets a payroll subtype so reports can name it.
update public.accounts set subtype = 'payroll' where type = 'expense' and code = '6010';

update public.accounts
   set subtype = 'office_rent'
 where type = 'expense' and code = '6000';

-- Utilities covers internet as well as power and water — the original account
-- was named for only two of the three.
update public.accounts
   set subtype = 'office_utilities',
       name_en = 'Utilities (Electricity, Water, Internet)',
       name_my = 'မီး၊ ရေ၊ အင်တာနက်'
 where type = 'expense' and code = '6020';

update public.accounts
   set subtype = 'office_supplies'
 where type = 'expense' and code = '6040';

-- Maintenance & repairs, absent from the original default chart.
insert into public.accounts (tenant_id, code, name_en, name_my, type, subtype, expense_group, is_cash_like, is_system)
select t.id, '6050', 'Repairs & Maintenance', 'ပြင်ဆင်ထိန်းသိမ်းစရိတ်', 'expense', 'office_maintenance', 'office', false, false
  from public.tenants t
on conflict (tenant_id, code) do nothing;

-- -----------------------------------------------------------------------------
--  New tenants get the same chart. `create_tenant` used to carry the default
--  chart inline; it is redefined below to call this instead, so the classified
--  chart lives in exactly one place.
-- -----------------------------------------------------------------------------
create or replace function public.seed_default_accounts(p_tenant_id uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  insert into public.accounts (tenant_id, code, name_en, name_my, type, subtype, expense_group, is_cash_like, is_system)
  values
    (p_tenant_id, '1000', 'Cash on Hand',        'လက်ကျန်ငွေသား',        'asset',     'cash',               null,        true,  true),
    (p_tenant_id, '1010', 'Bank Account',        'ဘဏ်စာရင်း',            'asset',     'bank',               null,        true,  true),
    (p_tenant_id, '1020', 'Mobile Wallet',       'မိုဘိုင်းပိုက်ဆံအိတ်',    'asset',     'mobile_wallet',      null,        true,  true),
    (p_tenant_id, '1100', 'Accounts Receivable', 'ရရန်ရှိငွေ',             'asset',     'ar',                 null,        false, true),
    (p_tenant_id, '1200', 'Inventory',           'ကုန်ပစ္စည်းလက်ကျန်',     'asset',     'inventory',          null,        false, true),
    (p_tenant_id, '2000', 'Accounts Payable',    'ပေးရန်ရှိငွေ',           'liability', 'ap',                 null,        false, true),
    (p_tenant_id, '3000', 'Owner Equity',        'ပိုင်ရှင်မတည်ငွေ',        'equity',    'capital',            null,        false, true),
    (p_tenant_id, '4000', 'Sales Revenue',       'ရောင်းရငွေ',             'income',    'sales',              null,        false, true),
    (p_tenant_id, '4100', 'Other Income',        'အခြားဝင်ငွေ',            'income',    'other',              null,        false, false),
    (p_tenant_id, '5000', 'Cost of Goods Sold',  'ကုန်ကျစရိတ်',            'expense',   'cogs',               'inventory', false, true),
    (p_tenant_id, '6000', 'Rent',                'ဆိုင်/ရုံးခန်းငှားရမ်းခ',  'expense',   'office_rent',        'office',    false, false),
    (p_tenant_id, '6010', 'Salaries & Wages',    'လစာနှင့်လုပ်အားခ',       'expense',   'payroll',            'payroll',   false, false),
    (p_tenant_id, '6020', 'Utilities (Electricity, Water, Internet)', 'မီး၊ ရေ၊ အင်တာနက်', 'expense', 'office_utilities', 'office', false, false),
    (p_tenant_id, '6030', 'Transportation',      'သယ်ယူပို့ဆောင်ရေး',      'expense',   'transport',          'other',     false, false),
    (p_tenant_id, '6040', 'Supplies',            'ရုံးသုံးပစ္စည်း',         'expense',   'office_supplies',    'office',    false, false),
    (p_tenant_id, '6050', 'Repairs & Maintenance','ပြင်ဆင်ထိန်းသိမ်းစရိတ်',  'expense',   'office_maintenance', 'office',    false, false),
    (p_tenant_id, '6900', 'Other Expenses',      'အခြားကုန်ကျစရိတ်',       'expense',   'other',              'other',     false, false)
  on conflict (tenant_id, code) do nothing;
$$;

revoke all on function public.seed_default_accounts(uuid) from public, anon, authenticated;

-- Redefined verbatim from 20260810000600_views_rpc.sql except for the accounts
-- block, which now delegates to seed_default_accounts().
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

  perform public.seed_default_accounts(v_tenant.id);

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
--  RECORD ONE SALARY PAYMENT
--
--  The transaction row and its payroll detail must appear together or not at
--  all. Doing it as two PostgREST calls from the browser cannot guarantee that:
--  if the payroll insert trips the one-payment-per-period unique index, undoing
--  the transaction needs `transactions.delete`, which the manager and accountant
--  roles deliberately do not hold — the orphan would be unremovable.
--
--  One function body is one transaction, so a failure anywhere rolls back the
--  whole payment.
-- -----------------------------------------------------------------------------
create or replace function public.record_salary_expense(
  p_tenant_id          uuid,
  p_account_id         uuid,
  p_employee_id        uuid,
  p_pay_period         date,
  p_base               numeric,
  p_bonus              numeric default 0,
  p_deduction          numeric default 0,
  p_payment_account_id uuid default null,
  p_payment_method     public.payment_method default 'cash',
  p_occurred_on        date default current_date,
  p_description        text default null,
  p_note               text default null,
  p_exchange_rate      numeric default 1
)
returns public.transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_txn      public.transactions;
  v_net      numeric := coalesce(p_base, 0) + coalesce(p_bonus, 0) - coalesce(p_deduction, 0);
  -- Normalised here as well as in the client: the check constraint on
  -- payroll_entries demands the first of the month.
  v_period   date := date_trunc('month', p_pay_period)::date;
  v_currency char(3);
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Both halves are required: the right to move money out, and the right to see
  -- the staff it is paid to.
  if not public.has_permission(p_tenant_id, 'transactions.create')
     or not public.has_permission(p_tenant_id, 'employees.read') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if v_net <= 0 then
    raise exception 'Net salary must be greater than zero' using errcode = '23514';
  end if;

  -- The FK alone would accept another tenant's employee.
  if not exists (
    select 1 from public.employees e
     where e.id = p_employee_id and e.tenant_id = p_tenant_id
  ) then
    raise exception 'Employee not found in this business' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.accounts a
     where a.id = p_account_id and a.tenant_id = p_tenant_id and a.type = 'expense'
  ) then
    raise exception 'Expense account not found in this business' using errcode = 'P0002';
  end if;

  select base_currency into v_currency from public.tenants where id = p_tenant_id;

  insert into public.transactions (
    tenant_id, type, status, occurred_on, account_id, payment_account_id,
    payment_method, currency_code, exchange_rate, amount, description, created_by
  )
  values (
    p_tenant_id, 'expense', 'posted', p_occurred_on, p_account_id, p_payment_account_id,
    p_payment_method, v_currency, coalesce(p_exchange_rate, 1), v_net, p_description, auth.uid()
  )
  returning * into v_txn;

  insert into public.payroll_entries (
    transaction_id, tenant_id, employee_id, pay_period,
    base_amount, bonus_amount, deduction_amount, note
  )
  values (
    v_txn.id, p_tenant_id, p_employee_id, v_period,
    coalesce(p_base, 0), coalesce(p_bonus, 0), coalesce(p_deduction, 0), p_note
  );

  return v_txn;
end;
$$;

grant execute on function public.record_salary_expense(
  uuid, uuid, uuid, date, numeric, numeric, numeric, uuid,
  public.payment_method, date, text, text, numeric
) to authenticated;

-- -----------------------------------------------------------------------------
--  EXPENSE BREAKDOWN
--  Powers the dashboard widget: monthly salary vs office operations vs
--  inventory cost. Grouped in SQL rather than in the client so the numbers
--  agree with dashboard_summary, which reads the same transactions.
-- -----------------------------------------------------------------------------
create or replace function public.report_expense_breakdown(
  p_tenant_id uuid,
  p_from      date default (current_date - 29),
  p_to        date default current_date
)
returns table (expense_group public.expense_group, total numeric, entry_count bigint)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Same gate as the P&L figures on the dashboard: a cashier sees no breakdown.
  if not public.has_permission(p_tenant_id, 'reports.pnl') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
  select coalesce(a.expense_group, 'other')::public.expense_group,
         round(coalesce(sum(t.amount_base), 0), 2),
         count(*)
    from public.transactions t
    left join public.accounts a on a.id = t.account_id
   where t.tenant_id = p_tenant_id
     and t.type = 'expense'
     and t.status = 'posted'
     and t.occurred_on between p_from and p_to
   group by coalesce(a.expense_group, 'other')
   order by 2 desc;
end;
$$;

grant execute on function public.report_expense_breakdown(uuid, date, date) to authenticated;
