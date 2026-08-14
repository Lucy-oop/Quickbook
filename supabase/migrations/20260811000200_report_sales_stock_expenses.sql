-- =============================================================================
--  Three report modules: sales, stock valuation, expense breakdown.
--
--  Same contract as the reports already in 20260810000600: SECURITY DEFINER so
--  the aggregate can read rows the caller's RLS would filter, with an explicit
--  has_permission() gate standing in for that RLS. Every query is pinned to
--  p_tenant_id — the gate authorises, it does not scope.
--
--  Money is reported in the tenant's base currency. Invoice columns are stored
--  in the *invoice's* currency, so anything read off `invoices` is multiplied by
--  its exchange_rate; `transactions` and `payments` already carry amount_base.
-- =============================================================================

-- Sales summary + how customers actually paid ---------------------------------
create or replace function public.report_sales(
  p_tenant_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  section       text,      -- 'total' | 'method'
  label         text,      -- metric name, or the payment method
  invoice_count bigint,
  amount        numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.sales') then
    raise exception 'You do not have permission to view the Sales report' using errcode = '42501';
  end if;

  return query
  with sold as (
    select i.subtotal        * i.exchange_rate as gross,
           i.discount_amount * i.exchange_rate as discount,
           i.tax_amount      * i.exchange_rate as tax,
           i.shipping_amount * i.exchange_rate as shipping,
           i.total           * i.exchange_rate as net,
           i.cost_total      * i.exchange_rate as cost
      from public.invoices i
     where i.tenant_id = p_tenant_id
       and i.kind in ('sales','pos')
       -- Drafts are not sales yet and voided invoices never were.
       and i.status in ('issued','partial','paid','overdue')
       and i.issue_date between p_from and p_to
  ),
  totals as (
    select count(*)                        as n,
           coalesce(sum(gross),    0) as gross,
           coalesce(sum(discount), 0) as discount,
           coalesce(sum(tax),      0) as tax,
           coalesce(sum(shipping), 0) as shipping,
           coalesce(sum(net),      0) as net,
           coalesce(sum(cost),     0) as cost
      from sold
  )
  -- Wrapped in a subquery so ORDER BY can qualify its columns: bare `label`
  -- would be ambiguous against this function's OUT parameter of the same name.
  select r.section, r.label, r.n, round(r.amount, 2)
  from (
    select v.section, v.label, v.n, v.amount
      from totals t
      cross join lateral (values
        ('total', 'gross',    t.n, t.gross),
        ('total', 'discount', t.n, t.discount),
        ('total', 'tax',      t.n, t.tax),
        ('total', 'shipping', t.n, t.shipping),
        ('total', 'net',      t.n, t.net),
        ('total', 'cost',     t.n, t.cost),
        ('total', 'profit',   t.n, t.net - t.cost)
      ) as v(section, label, n, amount)

    union all

    -- Cash actually received in the window, by method. Read from `payments`
    -- rather than invoices.payment_method: a part-paid invoice can be settled
    -- across several methods, and only the payment rows know that.
    select 'method',
           p.method::text,
           count(*),
           round(coalesce(sum(p.amount_base), 0), 2)
      from public.payments p
     where p.tenant_id = p_tenant_id
       and p.direction = 'in'
       and p.paid_on between p_from and p_to
     group by p.method
  ) as r(section, label, n, amount)
  -- 'total' sorts before 'method' (descending), and the metrics read in
  -- statement order rather than by size.
  order by r.section desc,
           array_position(
             array['gross','discount','tax','shipping','net','cost','profit'], r.label),
           r.amount desc;
end;
$$;

-- Stock on hand and what it is worth ------------------------------------------
create or replace function public.report_stock_valuation(
  p_tenant_id    uuid,
  p_warehouse_id uuid default null            -- null = every warehouse
)
returns table (
  product_id     uuid,
  sku            text,
  name           text,
  name_my        text,
  unit           text,
  warehouse_id   uuid,
  warehouse_name text,
  quantity       numeric,
  avg_cost       numeric,
  stock_value    numeric,
  retail_value   numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.inventory') then
    raise exception 'You do not have permission to view the Stock Valuation report' using errcode = '42501';
  end if;

  return query
  select p.id, p.sku, p.name, p.name_my, p.unit,
         w.id, w.name,
         round(sl.quantity, 4),
         round(sl.avg_cost, 4),
         -- Valued at moving-average cost, which is what the stock ledger keeps.
         round(sl.quantity * sl.avg_cost, 2),
         round(sl.quantity * p.selling_price, 2)
    from public.stock_levels sl
    join public.products   p on p.id = sl.product_id
    join public.warehouses w on w.id = sl.warehouse_id
   where sl.tenant_id = p_tenant_id
     and (p_warehouse_id is null or sl.warehouse_id = p_warehouse_id)
     and p.is_active
     and p.track_inventory
     -- Zero rows are noise in a valuation; negatives are real and must show.
     and sl.quantity <> 0
   order by round(sl.quantity * sl.avg_cost, 2) desc, p.name;
end;
$$;

-- Where the money went --------------------------------------------------------
create or replace function public.report_expenses(
  p_tenant_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  account_id   uuid,
  account_code text,
  account_name text,
  account_name_my text,
  entry_count  bigint,
  amount       numeric,
  share        numeric      -- percent of total expenses, 0-100
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'reports.pnl') then
    raise exception 'You do not have permission to view the Expenses report' using errcode = '42501';
  end if;

  return query
  with spend as (
    select t.account_id, a.code, a.name_en, a.name_my,
           count(*) as n, sum(t.amount_base) as total
      from public.transactions t
      join public.accounts a on a.id = t.account_id
     where t.tenant_id = p_tenant_id
       and t.status = 'posted'
       and a.type = 'expense'
       and t.occurred_on between p_from and p_to
     group by t.account_id, a.code, a.name_en, a.name_my
  ),
  grand as (select coalesce(sum(total), 0) as total from spend)
  select s.account_id, s.code, s.name_en, s.name_my, s.n,
         round(s.total, 2),
         case when g.total = 0 then 0 else round(s.total * 100 / g.total, 2) end
    from spend s cross join grand g
   order by s.total desc;
end;
$$;

grant execute on function public.report_sales(uuid, date, date)            to authenticated;
grant execute on function public.report_stock_valuation(uuid, uuid)        to authenticated;
grant execute on function public.report_expenses(uuid, date, date)         to authenticated;
