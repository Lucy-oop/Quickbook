-- =============================================================================
--  LOW STOCK — one row per product, summed across warehouses
--
--  `v_low_stock` was per (product, warehouse) while `v_products.is_low_stock`
--  compares the tenant-wide SUM. With one warehouse the two agree by accident;
--  with two they contradict each other on the same product.
--
--  That is what the "Comfy Dress still shows 0/10 after saving 20" report was.
--  The 20 landed in one warehouse, a stale 0-quantity row survived in a second
--  warehouse of the same name, and the per-warehouse view kept reporting the
--  zero — a live figure for a different row, which looks exactly like a stale
--  figure for the row that was edited.
--
--  `reorder_level` is a product-level column, so the tenant-wide sum is the only
--  comparison it can support without silently changing meaning: a level of 10
--  across three shops must mean "10 in total", not "10 in each".
--
--  Cost of this choice, stated plainly: no warehouse column. Which branch is
--  short is a stock-by-location question and belongs in the inventory report,
--  not in a dashboard alert.
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
  p.reorder_level as threshold,
  -- Summed over every warehouse. `coalesce` matters: a tracked product that has
  -- never been received owns no stock_levels row at all and must still surface at
  -- zero rather than vanish from the alert.
  coalesce((
    select sum(s.quantity)
      from public.stock_levels s
     where s.product_id = p.id
  ), 0) as quantity
from public.products p
where p.track_inventory
  and p.is_active
  and p.reorder_level > 0
  and coalesce((
    select sum(s.quantity)
      from public.stock_levels s
     where s.product_id = p.id
  ), 0) <= p.reorder_level;

grant select on public.v_low_stock to authenticated;

comment on view public.v_low_stock is
  'One row per product whose tenant-wide stock has reached its own reorder level. '
  'Deliberately aggregated across warehouses so it cannot disagree with '
  'v_products.is_low_stock, which compares the same sum.';
