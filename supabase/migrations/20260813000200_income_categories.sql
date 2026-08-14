-- =============================================================================
--  INCOME — categories for non-sales money, and a report to match
--
--  Every income row in the system is written by `post_invoice` against
--  `4000 Sales Revenue`. There are no manual income entries at all, because the
--  only thing the picker offered was that same system account — recording
--  anything through it would have double-counted the sale.
--
--  Manual income is therefore scoped to money that is NOT a sale: owner capital,
--  supplier refunds, and a catch-all. Sales continue to flow through POS and
--  invoicing, which is where stock and receivables are handled too.
--
--  Deliberately NOT mirroring `expense_group` here. Expense has that enum because
--  it has eight accounts across four kinds; income will have three. A group
--  selector would add a tap to reach a three-item list, which works against the
--  reason this was raised. Reporting groups by account instead, exactly as
--  `report_expenses` already does.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  New account for every existing tenant.
--
--  A refund ideally nets against the expense account it came from, but
--  `transactions.amount` carries `check (amount >= 0)`, so a negative expense is
--  not representable. Booking it as income grosses up both sides slightly rather
--  than netting them — the tradeoff is accepted here rather than relaxing a
--  constraint that guards every other write.
--
--  `is_system = false`, so it is offered in the manual picker (see the
--  `is_system` filter in quick-transaction-dialog) and can be renamed or
--  deactivated by the owner.
-- -----------------------------------------------------------------------------
insert into public.accounts (tenant_id, code, name_en, name_my, type, subtype, is_cash_like, is_system)
select t.id, '4200', 'Supplier Refunds & Rebates', 'ပေးသွင်းသူထံမှ ပြန်အမ်းငွေ',
       'income', 'refund', false, false
  from public.tenants t
on conflict (tenant_id, code) do nothing;

-- New tenants get it too.
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
    -- Owner capital is equity, not income, so it keeps its own account. The
    -- Add Income screen surfaces it anyway, because that is where an owner looks
    -- for "money I put in".
    (p_tenant_id, '3000', 'Owner Equity',        'ပိုင်ရှင်မတည်ငွေ',        'equity',    'capital',            null,        false, true),
    (p_tenant_id, '4000', 'Sales Revenue',       'ရောင်းရငွေ',             'income',    'sales',              null,        false, true),
    (p_tenant_id, '4100', 'Other Income',        'အခြားဝင်ငွေ',            'income',    'other',              null,        false, false),
    (p_tenant_id, '4200', 'Supplier Refunds & Rebates', 'ပေးသွင်းသူထံမှ ပြန်အမ်းငွေ', 'income', 'refund',    null,        false, false),
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

-- -----------------------------------------------------------------------------
--  report_income — the mirror of report_expenses
--
--  Income is reported NET OF TAX for the same reason the P&L is: the transaction
--  holds the gross figure because it doubles as the cash record, and tax
--  collected on a sale was never the shop's money.
--
--  `4000 Sales Revenue` is included: this report answers "where did income come
--  from", and sales are overwhelmingly the answer. It is the manual *entry*
--  picker that excludes system accounts, not the reporting.
-- -----------------------------------------------------------------------------
create or replace function public.report_income(
  p_tenant_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  account_id      uuid,
  account_code    text,
  account_name    text,
  account_name_my text,
  entry_count     bigint,
  amount          numeric,
  share           numeric      -- percent of total income, 0-100
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.pnl') then
    raise exception 'You do not have permission to view the Income report' using errcode = '42501';
  end if;

  return query
  with earned as (
    select t.account_id, a.code, a.name_en, a.name_my,
           count(*) as n,
           sum(t.amount_base - (coalesce(t.tax_amount, 0) * t.exchange_rate)) as total
      from public.transactions t
      join public.accounts a on a.id = t.account_id
     where t.tenant_id = p_tenant_id
       and t.status = 'posted'
       and a.type = 'income'
       and t.occurred_on between p_from and p_to
     group by t.account_id, a.code, a.name_en, a.name_my
  ),
  grand as (select coalesce(sum(total), 0) as total from earned)
  select e.account_id, e.code, e.name_en, e.name_my, e.n,
         round(e.total, 2),
         case when g.total = 0 then 0 else round(e.total * 100 / g.total, 2) end
    from earned e cross join grand g
   order by e.total desc;
end;
$$;

grant execute on function public.report_income(uuid, date, date) to authenticated;
