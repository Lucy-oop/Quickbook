-- =============================================================================
--  ACCOUNTING CORRECTIONS
--
--  Three defects that made the P&L and Cash Flow reports disagree with the sales
--  report and with each other. None has corrupted data yet — there are currently
--  no purchase invoices — so this is preventive, and no repair pass is needed.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  A1. A purchase is not an operating expense
--
--  `post_invoice` posts purchase invoices to `5000 COGS`. `report_profit_loss`
--  then counted that as an operating expense, while separately deriving Cost of
--  Sales from `invoices.cost_total` on the sales side. Buy and sell in one
--  period and the same goods cost appears in both sections.
--
--  Buying stock converts cash into inventory; it does not consume anything. The
--  cost becomes an expense when the goods are SOLD, which the sales-side `cogs`
--  CTE already handles.
--
--  Fixed in the READ path, not by rewriting `post_invoice`. Changing where the
--  purchase posts would mean reproducing that function wholesale — it also
--  computes invoice totals, moves stock, allocates the document number and
--  writes the payment row — to alter one account lookup. Excluding account 5000
--  from the expense side of every report reaches the same numbers without
--  putting invoice posting at risk, and it also corrects rows already written.
--
--  Net effect: stock bought and not yet sold sits in inventory and shows up in
--  neither section, which is correct; once sold, it appears exactly once, as
--  Cost of Sales.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
--  A2 + A1 guard. Profit & Loss.
--
--    * revenue is reported NET OF TAX. The transaction keeps the gross figure
--      because it is also the cash record; tax is subtracted here, where the
--      question is "what did we earn", not "what moved".
--    * the movement CTE now filters on the ACCOUNT type, and explicitly excludes
--      COGS (5000). Cost of Sales has exactly one source: the sales-side `cogs`
--      CTE. The exclusion covers historical rows posted before A1.
-- -----------------------------------------------------------------------------
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
    select t.account_id, a.type, a.code, a.name_en,
           sum(
             case when a.type = 'income'
                  then t.amount_base - (coalesce(t.tax_amount, 0) * t.exchange_rate)
                  else t.amount_base
             end
           ) as total
      from public.transactions t
      join public.accounts a on a.id = t.account_id
     where t.tenant_id = p_tenant_id
       and t.status = 'posted'
       and t.occurred_on between p_from and p_to
       and a.type in ('income','expense')
       and a.code <> '5000'
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
   where m.total <> 0
  union all
  select 'cogs', null::uuid, '5000', 'Cost of Goods Sold', round(c.total, 2)
    from cogs c where c.total <> 0
  order by 1, 3;
end;
$$;

grant execute on function public.report_profit_loss(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
--  A3. Cash flow follows actual payments
--
--  Previously every income/expense transaction whose payment account looked
--  cash-like contributed its FULL amount. `post_invoice` books the whole invoice
--  total against the cash account as soon as any part of it is paid, so a 10,000
--  invoice with 2,000 received appeared as 10,000 of inflow.
--
--  `payments` records what actually moved, and `report_sales` already reads it,
--  so using it here makes the two reports agree.
--
--  Manual entries have no payment row — rent paid in cash is a transaction and
--  nothing else — so they are unioned in, filtered to `invoice_id is null` so
--  invoice money is never counted from both sources.
-- -----------------------------------------------------------------------------
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
  with moved as (
    -- Invoice money: what was actually received or paid.
    select date_trunc(p_bucket, p.paid_on)::date as period,
           case when p.direction = 'in'  then p.amount_base else 0 end as cash_in,
           case when p.direction = 'out' then p.amount_base else 0 end as cash_out
      from public.payments p
     where p.tenant_id = p_tenant_id
       and p.paid_on between p_from and p_to

    union all

    -- Standalone entries, which never produce a payment row.
    select date_trunc(p_bucket, t.occurred_on)::date,
           case when t.type = 'income'  then t.amount_base else 0 end,
           case when t.type = 'expense' then t.amount_base else 0 end
      from public.transactions t
      left join public.accounts a on a.id = t.payment_account_id
     where t.tenant_id = p_tenant_id
       and t.status = 'posted'
       and t.invoice_id is null
       and t.occurred_on between p_from and p_to
       and coalesce(a.is_cash_like, true)
  )
  select m.period,
         round(sum(m.cash_in), 2),
         round(sum(m.cash_out), 2),
         round(sum(m.cash_in) - sum(m.cash_out), 2)
    from moved m
   group by m.period
   order by m.period;
end;
$$;

grant execute on function public.report_cash_flow(uuid, date, date, text) to authenticated;

-- -----------------------------------------------------------------------------
--  A4. dashboard_summary must agree with the reports
--
--  It summed `transactions` by `type` alone, so a purchase invoice — which posts
--  `type='expense'` against COGS — counted as an operating expense here. The very
--  double-count A1 removes from the P&L would otherwise reappear on the
--  dashboard, and `net_period` would disagree with the P&L's net.
--
--  Every other report already qualifies by ACCOUNT type (`report_expenses`,
--  `report_income`, `report_profit_loss`); this brings the dashboard in line, and
--  nets tax out of income for the same reason as A2.
-- -----------------------------------------------------------------------------
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
        'income_period',  round(coalesce(sum(
            case when a.type = 'income'
                 then t.amount_base - (coalesce(t.tax_amount, 0) * t.exchange_rate) end), 0), 2),
        'expense_period', round(coalesce(sum(
            case when a.type = 'expense' and a.code <> '5000' then t.amount_base end), 0), 2),
        'net_period',     round(
            coalesce(sum(case when a.type = 'income'
                              then t.amount_base - (coalesce(t.tax_amount, 0) * t.exchange_rate) end), 0)
          - coalesce(sum(case when a.type = 'expense' and a.code <> '5000'
                              then t.amount_base end), 0), 2))
        from public.transactions t
        join public.accounts a on a.id = t.account_id
       where t.tenant_id = p_tenant_id
         and t.status = 'posted'
         and t.occurred_on between p_from and p_to
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

grant execute on function public.dashboard_summary(uuid, date, date) to authenticated;
