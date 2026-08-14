-- =============================================================================
--  CROSS-TENANT WAREHOUSE REFERENCES — repair, then make impossible
--
--  45 rows referenced a warehouse belonging to a DIFFERENT tenant than the row
--  itself: 4 in stock_levels, 18 in stock_movements, 23 in invoices. Every row's
--  own `tenant_id` was correct — only `warehouse_id` pointed across the boundary —
--  so RLS was still isolating reads, and the target for each row is unambiguous:
--  that tenant's own default warehouse.
--
--  Cause: the client resolved a warehouse from a cached list
--  (`warehouses.data?.[0]?.id`) that could still belong to a previously selected
--  tenant. `stock_levels.warehouse_id` was a plain FK to `warehouses(id)`, which
--  says nothing about tenancy, so the database accepted it.
--
--  Nothing is deleted. Ledger rows and invoices are financial records; they are
--  repointed, never dropped.
-- =============================================================================

begin;

create temp table repair_target on commit drop as
select t.id as tenant_id,
       (select w.id from public.warehouses w
         where w.tenant_id = t.id
         order by w.is_default desc, w.created_at
         limit 1) as warehouse_id
  from public.tenants t;

-- Refuse to run rather than repoint into nothing.
do $$
begin
  if exists (select 1 from repair_target where warehouse_id is null) then
    raise exception 'A tenant has no warehouse to repoint to; aborting repair.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
--  1. stock_levels — MERGE, not update
--
--  `stock_levels` is unique on (tenant_id, product_id, warehouse_id) and all four
--  strays already have a correct sibling row for the same product in the right
--  warehouse. A plain UPDATE would violate that index, so the quantities are
--  folded into the sibling and the stray removed.
--
--  Deleting here is safe in a way it is not elsewhere: stock_levels is a derived
--  balance, not a record of events. The movements behind it are preserved below,
--  and the tenant's total is unchanged because the quantity is added, not dropped.
-- -----------------------------------------------------------------------------
create temp table sl_strays on commit drop as
select s.tenant_id, s.product_id, s.warehouse_id as bad_warehouse, s.quantity, s.avg_cost,
       r.warehouse_id as good_warehouse
  from public.stock_levels s
  join public.warehouses w on w.id = s.warehouse_id
  join repair_target r on r.tenant_id = s.tenant_id
 where s.tenant_id <> w.tenant_id;

-- Fold quantity into the correct row where one exists.
update public.stock_levels dst
   set quantity = dst.quantity + x.quantity,
       updated_at = now()
  from sl_strays x
 where dst.tenant_id = x.tenant_id
   and dst.product_id = x.product_id
   and dst.warehouse_id = x.good_warehouse;

-- Repoint the ones with no sibling to merge into.
update public.stock_levels s
   set warehouse_id = x.good_warehouse
  from sl_strays x
 where s.tenant_id = x.tenant_id
   and s.product_id = x.product_id
   and s.warehouse_id = x.bad_warehouse
   and not exists (
     select 1 from public.stock_levels d
      where d.tenant_id = x.tenant_id and d.product_id = x.product_id
        and d.warehouse_id = x.good_warehouse);

-- Drop the strays that were merged.
delete from public.stock_levels s
 using sl_strays x
 where s.tenant_id = x.tenant_id
   and s.product_id = x.product_id
   and s.warehouse_id = x.bad_warehouse
   and x.bad_warehouse <> x.good_warehouse;

-- -----------------------------------------------------------------------------
--  2. stock_movements — repoint
--
--  The audit trigger fires on UPDATE and will record each correction, which is
--  the desired outcome: the ledger shows it was touched and why.
--
--  `apply_stock_movement` is AFTER INSERT only, so repointing does not re-apply
--  quantities and cannot double-count balances.
-- -----------------------------------------------------------------------------
update public.stock_movements m
   set warehouse_id = r.warehouse_id
  from public.warehouses w, repair_target r
 where w.id = m.warehouse_id
   and r.tenant_id = m.tenant_id
   and m.tenant_id <> w.tenant_id;

-- -----------------------------------------------------------------------------
--  3. invoices — repoint
-- -----------------------------------------------------------------------------
update public.invoices i
   set warehouse_id = r.warehouse_id
  from public.warehouses w, repair_target r
 where w.id = i.warehouse_id
   and r.tenant_id = i.tenant_id
   and i.tenant_id <> w.tenant_id;

-- -----------------------------------------------------------------------------
--  Verify before committing. Any remaining violation aborts the transaction.
-- -----------------------------------------------------------------------------
do $$
declare
  v_sl int; v_mv int; v_inv int;
begin
  select count(*) into v_sl from public.stock_levels s
    join public.warehouses w on w.id=s.warehouse_id where s.tenant_id <> w.tenant_id;
  select count(*) into v_mv from public.stock_movements m
    join public.warehouses w on w.id=m.warehouse_id where m.tenant_id <> w.tenant_id;
  select count(*) into v_inv from public.invoices i
    join public.warehouses w on w.id=i.warehouse_id where i.tenant_id <> w.tenant_id;

  if v_sl + v_mv + v_inv > 0 then
    raise exception 'Repair incomplete: stock_levels=%, stock_movements=%, invoices=%', v_sl, v_mv, v_inv;
  end if;
end $$;

-- =============================================================================
--  CONSTRAINTS — make the whole class of bug unrepresentable
--
--  A composite FK is the point: `warehouse_id` alone can reference any tenant's
--  warehouse, so tenancy has to be part of the reference itself. That requires a
--  unique key on the referenced side covering both columns.
-- =============================================================================
alter table public.warehouses
  add constraint warehouses_id_tenant_key unique (id, tenant_id);
alter table public.products
  add constraint products_id_tenant_key unique (id, tenant_id);

-- stock_levels: the row, its product and its warehouse must share a tenant.
alter table public.stock_levels
  drop constraint if exists stock_levels_warehouse_id_fkey,
  add constraint stock_levels_warehouse_same_tenant
    foreign key (warehouse_id, tenant_id)
    references public.warehouses (id, tenant_id) on delete restrict;

alter table public.stock_levels
  drop constraint if exists stock_levels_product_id_fkey,
  add constraint stock_levels_product_same_tenant
    foreign key (product_id, tenant_id)
    references public.products (id, tenant_id) on delete cascade;

alter table public.stock_movements
  drop constraint if exists stock_movements_warehouse_id_fkey,
  add constraint stock_movements_warehouse_same_tenant
    foreign key (warehouse_id, tenant_id)
    references public.warehouses (id, tenant_id) on delete restrict;

alter table public.stock_movements
  drop constraint if exists stock_movements_product_id_fkey,
  add constraint stock_movements_product_same_tenant
    foreign key (product_id, tenant_id)
    references public.products (id, tenant_id) on delete cascade;

-- invoices.warehouse_id is nullable (a service invoice has no warehouse); a
-- composite FK with a NULL in it is not enforced, which is the correct behaviour.
alter table public.invoices
  drop constraint if exists invoices_warehouse_id_fkey,
  add constraint invoices_warehouse_same_tenant
    foreign key (warehouse_id, tenant_id)
    references public.warehouses (id, tenant_id) on delete restrict;

commit;
