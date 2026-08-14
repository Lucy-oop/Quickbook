-- =============================================================================
--  NEGATIVE STOCK
--
--  Symptom: every tracked product appeared in the low-stock widget at a negative
--  quantity (-20/18, -3/10, …), because a negative number is trivially <= any
--  threshold.
--
--  What the data actually showed: the ledger arithmetic was never wrong. Taking
--  "Diamond Skirt" — three `sale` movements of -1 and *nothing else*, summing to
--  -3, with stock_levels.quantity also exactly -3. Receipts and sales reconcile
--  perfectly. What was missing was the receipt itself: goods were sold that had
--  never been recorded as arriving.
--
--  Note there is no stored "initial stock" column being ignored anywhere —
--  `v_products.stock_on_hand` is itself derived as sum(stock_levels.quantity),
--  so `(initial + in) - sold` is already what the view computes. The hole was
--  upstream of the maths:
--
--    1. `tg_apply_stock_movement` did `v_prev_qty + new.quantity` with no floor,
--       so a sale could always drive stock below zero. That is the real defect —
--       overselling was silently permitted, and the negative balance was the
--       honest consequence.
--    2. Product creation posts the opening-stock movement as a SECOND statement
--       after the product insert, so a failure between them (no warehouse, an
--       RLS refusal) leaves a product with no opening stock. Handled by
--       `create_product_with_stock` below.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  1. Opt-out flag
--
--  A hard block is wrong as an absolute rule: plenty of shops sell from a pile
--  they have not finished entering, and would rather record the sale and
--  reconcile later. So the guard is the default, not the law.
-- -----------------------------------------------------------------------------
alter table public.tenants
  add column if not exists allow_negative_stock boolean not null default false;

comment on column public.tenants.allow_negative_stock is
  'When true, sales may drive stock below zero (backorder-style). Default false: '
  'an oversell is refused and the cashier is told to receive stock first.';

-- -----------------------------------------------------------------------------
--  2. The guard
--
--  Applies to outbound movements only. `adjustment` is deliberately exempt —
--  correcting a count is exactly how you dig out of a negative balance, and
--  blocking it would make the problem unfixable from the UI.
-- -----------------------------------------------------------------------------
create or replace function public.tg_apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_qty  numeric(20,4);
  v_prev_cost numeric(20,4);
  v_new_qty   numeric(20,4);
  v_new_cost  numeric(20,4);
  v_allow_neg boolean;
  v_name      text;
begin
  insert into public.stock_levels (tenant_id, product_id, warehouse_id, quantity, avg_cost)
  values (new.tenant_id, new.product_id, new.warehouse_id, 0, 0)
  on conflict (tenant_id, product_id, warehouse_id) do nothing;

  select quantity, avg_cost into v_prev_qty, v_prev_cost
    from public.stock_levels
   where tenant_id = new.tenant_id
     and product_id = new.product_id
     and warehouse_id = new.warehouse_id
   for update;

  v_new_qty := v_prev_qty + new.quantity;

  if v_new_qty < 0 and new.kind in ('sale', 'out', 'wastage', 'transfer') then
    select allow_negative_stock into v_allow_neg
      from public.tenants where id = new.tenant_id;

    if not coalesce(v_allow_neg, false) then
      select name into v_name from public.products where id = new.product_id;
      -- The message names the product and both numbers, because the cashier sees
      -- this mid-sale and needs to know what to do without opening a report.
      raise exception
        'Not enough stock for "%": % in stock, % requested. Receive stock first, or enable negative stock in settings.',
        coalesce(v_name, 'product'), v_prev_qty, abs(new.quantity)
        using errcode = '23514';
    end if;
  end if;

  -- Weighted average only moves on inbound movements that carry a cost.
  if new.quantity > 0 and new.unit_cost > 0 and v_new_qty > 0 then
    v_new_cost := ((greatest(v_prev_qty, 0) * v_prev_cost) + (new.quantity * new.unit_cost)) / v_new_qty;
  else
    v_new_cost := v_prev_cost;
  end if;

  update public.stock_levels
     set quantity = v_new_qty,
         avg_cost = round(v_new_cost, 4),
         updated_at = now()
   where tenant_id = new.tenant_id
     and product_id = new.product_id
     and warehouse_id = new.warehouse_id;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
--  3. Repair the balances that are already negative
--
--  Corrected to exactly zero, and no further. Zero is the only honest number
--  available: the quantity that was really on the shelf is not recorded anywhere,
--  and inventing one would put a fabricated figure into a stock valuation that
--  feeds the P&L. Zero says "unknown, nothing counted yet" and leaves the shop
--  to enter a real count.
--
--  Posted as an `adjustment` movement rather than an UPDATE so the correction is
--  in the ledger and the audit trigger records it, like any other stock change.
-- -----------------------------------------------------------------------------
insert into public.stock_movements (
  tenant_id, product_id, warehouse_id, kind, quantity, unit_cost,
  reference_type, notes
)
select s.tenant_id, s.product_id, s.warehouse_id, 'adjustment', -s.quantity, 0,
       'manual',
       'System correction: balance was negative because sales were recorded '
       'against stock that had never been received. Reset to zero — please enter '
       'a physical count.'
  from public.stock_levels s
 where s.quantity < 0;

-- -----------------------------------------------------------------------------
--  4. Atomic product + opening stock
--
--  One transaction, so a tracked product can never come into existence without
--  the opening balance the form was filled in with. Returns the product id.
-- -----------------------------------------------------------------------------
create or replace function public.create_product_with_stock(
  p_tenant_id    uuid,
  p_product      jsonb,
  p_quantity     numeric default 0,
  p_warehouse_id uuid default null,
  p_unit_cost    numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_id uuid;
  v_warehouse  uuid;
  v_track      boolean;
begin
  if not public.has_permission(p_tenant_id, 'products.manage') then
    raise exception 'You do not have permission to manage products' using errcode = '42501';
  end if;

  insert into public.products (
    tenant_id, name, name_my, sku, barcode, unit, category_id,
    selling_price, cost_price, track_inventory, reorder_level, custom_fields, created_by
  )
  values (
    p_tenant_id,
    p_product->>'name',
    nullif(p_product->>'name_my', ''),
    nullif(p_product->>'sku', ''),
    nullif(p_product->>'barcode', ''),
    coalesce(nullif(p_product->>'unit', ''), 'pcs'),
    nullif(p_product->>'category_id', '')::uuid,
    coalesce((p_product->>'selling_price')::numeric, 0),
    coalesce((p_product->>'cost_price')::numeric, 0),
    coalesce((p_product->>'track_inventory')::boolean, true),
    coalesce((p_product->>'reorder_level')::numeric, 0),
    coalesce(p_product->'custom_fields', '{}'::jsonb),
    auth.uid()
  )
  returning id, track_inventory into v_product_id, v_track;

  if v_track and coalesce(p_quantity, 0) <> 0 then
    v_warehouse := coalesce(
      p_warehouse_id,
      (select id from public.warehouses
        where tenant_id = p_tenant_id and is_default order by created_at limit 1),
      (select id from public.warehouses
        where tenant_id = p_tenant_id order by created_at limit 1)
    );

    if v_warehouse is null then
      raise exception 'No warehouse configured for this business' using errcode = '22023';
    end if;

    insert into public.stock_movements (
      tenant_id, product_id, warehouse_id, kind, quantity, unit_cost,
      reference_type, notes, created_by
    )
    values (
      p_tenant_id, v_product_id, v_warehouse, 'in', p_quantity,
      greatest(coalesce(p_unit_cost, 0), 0), 'manual', 'Opening stock', auth.uid()
    );
  end if;

  return v_product_id;
end;
$$;

grant execute on function public.create_product_with_stock(uuid, jsonb, numeric, uuid, numeric)
  to authenticated;
