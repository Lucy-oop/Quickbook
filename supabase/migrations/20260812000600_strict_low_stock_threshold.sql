-- =============================================================================
--  LOW STOCK — strictly the product's own threshold
--
--  Supersedes the fallback introduced in 20260812000100. That migration treated
--  an unset reorder level (0) as "warn me at 5 units", which fixed the original
--  complaint (nothing ever appeared) by over-correcting: the widget then warned
--  about products nobody had asked to be warned about.
--
--  The rule is now exactly three conditions, with no invented numbers:
--
--    track_inventory = true          stock is actually being counted
--    reorder_level  > 0              the owner has set a warning quantity
--    quantity      <= reorder_level  it has reached or passed that quantity
--
--  Consequence worth being explicit about: a product sitting at zero with NO
--  reorder level set is now hidden. That is what "no hardcoded fallback" means —
--  with no threshold there is no statement about when it matters, and the widget
--  does not guess. Such products still show their zero balance on the products
--  screen; they simply do not raise an alert here.
--
--  The LEFT JOIN from 20260812000100 is retained: a tracked product with a
--  reorder level that has never been received has no stock_levels row at all,
--  and must still surface at zero rather than vanish.
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
  -- Kept as a column so the UI can render "3 / 10" without re-deriving the rule.
  -- Now simply the product's own level; no fallback is applied.
  p.reorder_level as threshold,
  s.warehouse_id,
  w.name as warehouse_name,
  coalesce(s.quantity, 0) as quantity
from public.products p
left join public.stock_levels s on s.product_id = p.id
left join public.warehouses w on w.id = s.warehouse_id
where p.track_inventory
  and p.is_active
  and p.reorder_level > 0
  and coalesce(s.quantity, 0) <= p.reorder_level;

grant select on public.v_low_stock to authenticated;

-- `is_low_stock` must agree, or the products screen and its low-stock filter
-- would disagree with the dashboard card about the same product.
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
    and p.reorder_level > 0
    and coalesce((select sum(s.quantity) from public.stock_levels s where s.product_id = p.id), 0)
        <= p.reorder_level as is_low_stock
from public.products p
left join public.product_categories c on c.id = p.category_id;

-- Nothing references it now that both views state the rule directly, and leaving
-- it would invite a third definition of "low" to grow back.
drop function if exists public.effective_reorder_level(numeric);
