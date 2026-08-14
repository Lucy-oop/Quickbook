-- =============================================================================
--  Fix 1 & 2 — the category / payment-method pickers in the quick income and
--  expense dialogs came back EMPTY for some roles, which reads to the user as
--  "the dropdown will not open" (Radix renders a zero-height popover when it
--  has no items).
--
--  Cause: `accounts_select` demanded `accounts.read`, but the dialogs are gated
--  on `transactions.create`. The CASHIER role — and any custom role built the
--  same way — holds `transactions.create` WITHOUT `accounts.read`, so RLS
--  silently filtered every row. Writes still worked (FK checks bypass RLS),
--  which is why this never surfaced as an error.
--
--  Recording money requires choosing the account it lands in, so the read
--  permission now follows from the write permission.
-- =============================================================================
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select to authenticated
  using (
    public.has_permission(tenant_id, 'accounts.read')
    or public.has_permission(tenant_id, 'transactions.create')
    or public.has_permission(tenant_id, 'payments.create')
  );

-- =============================================================================
--  Fix 3 — the "low stock" threshold, defined once.
--
--  An explicitly configured reorder level always wins. It is only when the
--  level was never set (the column defaults to 0) that we fall back to 5 units,
--  because comparing against 0 means "low stock" can only ever mean "already
--  out of stock" — which is why the dashboard card never had anything to show.
--
--  Both v_products.is_low_stock and v_low_stock call this, so the products
--  screen, the dashboard card and dashboard_summary.low_stock_count cannot
--  disagree with each other.
-- =============================================================================
create or replace function public.effective_reorder_level(p_reorder_level numeric)
returns numeric
language sql
immutable
parallel safe
set search_path to 'public', 'pg_temp'
as $$
  select case when coalesce(p_reorder_level, 0) > 0 then p_reorder_level else 5 end
$$;

grant execute on function public.effective_reorder_level(numeric) to authenticated;

-- v_products keeps its exact column list and order, so it can be replaced in
-- place; only the `is_low_stock` expression changes.
create or replace view public.v_products with (security_invoker = on) as
select
  p.id, p.tenant_id, p.category_id, c.name as category_name,
  p.sku, p.barcode, p.name, p.name_my, p.description, p.unit,
  p.track_inventory, p.selling_price, p.wholesale_price, p.currency_code,
  p.tax_rate, p.reorder_level, p.reorder_quantity, p.image_url,
  p.custom_fields, p.is_active, p.created_at, p.updated_at,
  public.masked_product_cost(p.tenant_id, p.id) as cost_price,
  coalesce((select sum(s.quantity) from public.stock_levels s where s.product_id = p.id), 0) as stock_on_hand,
  p.track_inventory
    and coalesce((select sum(s.quantity) from public.stock_levels s where s.product_id = p.id), 0)
        <= public.effective_reorder_level(p.reorder_level) as is_low_stock
from public.products p
left join public.product_categories c on c.id = p.category_id;

-- =============================================================================
--  Fix 3 (continued) — the low-stock card was permanently empty.
--
--  Beyond the threshold fix above, `stock_levels` becomes a LEFT join: a tracked
--  product that had never been received owned no stock row at all, so it was
--  invisible here even though it had nothing on the shelf.
--
--  The comparison value is exposed as `threshold` so the card can show what it
--  is measuring against. Column names change, so the view is dropped rather
--  than replaced.
-- =============================================================================
drop view if exists public.v_low_stock;

create view public.v_low_stock with (security_invoker = on) as
select
  p.tenant_id,
  p.id as product_id,
  p.name,
  p.name_my,
  p.sku,
  p.barcode,
  p.unit,
  p.reorder_level,
  p.reorder_quantity,
  public.effective_reorder_level(p.reorder_level) as threshold,
  s.warehouse_id,
  w.name as warehouse_name,
  coalesce(s.quantity, 0) as quantity
from public.products p
left join public.stock_levels s on s.product_id = p.id
left join public.warehouses w on w.id = s.warehouse_id
where p.track_inventory
  and p.is_active
  and coalesce(s.quantity, 0) <= public.effective_reorder_level(p.reorder_level);

grant select on public.v_low_stock to authenticated;
