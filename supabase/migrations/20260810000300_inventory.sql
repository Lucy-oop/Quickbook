-- =============================================================================
--  Myanmar Universal ERP — 0003 INVENTORY
--  Categories, products (with JSONB custom fields), warehouses, stock levels
--  and an append-only stock ledger that maintains levels via trigger.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- WAREHOUSES / LOCATIONS
-- -----------------------------------------------------------------------------
create table if not exists public.warehouses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  code         text not null,
  name         text not null,
  name_my      text,
  address      text,
  phone        text,
  is_default   boolean not null default false,
  is_active    boolean not null default true,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists warehouses_tenant_code_unique on public.warehouses (tenant_id, code);
create unique index if not exists warehouses_one_default on public.warehouses (tenant_id) where is_default;

create trigger set_updated_at before update on public.warehouses
  for each row execute function public.tg_set_updated_at();

do $$ begin
  alter table public.invoices
    add constraint invoices_warehouse_id_fkey
    foreign key (warehouse_id) references public.warehouses(id) on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- CATEGORIES
-- -----------------------------------------------------------------------------
create table if not exists public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  parent_id   uuid references public.product_categories(id) on delete set null,
  name        text not null,
  name_my     text,
  sort_order  smallint not null default 0,
  color       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists product_categories_tenant_idx on public.product_categories (tenant_id);

create trigger set_updated_at before update on public.product_categories
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- PRODUCTS
-- `custom_fields` holds whatever the tenant defined in custom_fields_schema:
--   phone shop  -> { "imei": "35...", "warranty_months": 12 }
--   mini-mart   -> { "expiry_date": "2027-01-31", "batch": "B12" }
--   restaurant  -> { "spice_level": "medium", "prep_minutes": 8 }
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  category_id      uuid references public.product_categories(id) on delete set null,
  sku              text,
  barcode          text,
  name             text not null,
  name_my          text,
  description      text,
  unit             text not null default 'pcs',
  -- Services / restaurant dishes are not stock-tracked.
  track_inventory  boolean not null default true,
  cost_price       numeric(20,4) not null default 0 check (cost_price >= 0),
  selling_price    numeric(20,4) not null default 0 check (selling_price >= 0),
  wholesale_price  numeric(20,4),
  currency_code    char(3) not null default 'MMK' references public.currencies(code),
  tax_rate         numeric(9,4) not null default 0,
  reorder_level    numeric(20,4) not null default 0,
  reorder_quantity numeric(20,4) not null default 0,
  image_url        text,
  custom_fields    jsonb not null default '{}'::jsonb,
  is_active        boolean not null default true,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists products_tenant_sku_unique on public.products (tenant_id, sku) where sku is not null;
create unique index if not exists products_tenant_barcode_unique on public.products (tenant_id, barcode) where barcode is not null;
create index if not exists products_tenant_active_idx on public.products (tenant_id) where is_active;
create index if not exists products_name_trgm on public.products using gin (name gin_trgm_ops);
-- Makes `custom_fields @> '{"imei":"..."}'` an index scan instead of a seq scan.
create index if not exists products_custom_fields_idx on public.products using gin (custom_fields jsonb_path_ops);

create trigger set_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();

do $$ begin
  alter table public.invoice_items
    add constraint invoice_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- STOCK LEVELS (materialised current quantity per product per warehouse)
-- -----------------------------------------------------------------------------
create table if not exists public.stock_levels (
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  warehouse_id  uuid not null references public.warehouses(id) on delete cascade,
  quantity      numeric(20,4) not null default 0,
  reserved      numeric(20,4) not null default 0,
  available     numeric(20,4) generated always as (quantity - reserved) stored,
  avg_cost      numeric(20,4) not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (tenant_id, product_id, warehouse_id)
);

create index if not exists stock_levels_warehouse_idx on public.stock_levels (tenant_id, warehouse_id);

-- -----------------------------------------------------------------------------
-- STOCK MOVEMENTS (append-only ledger — the source of truth)
-- -----------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  warehouse_id   uuid not null references public.warehouses(id) on delete restrict,
  kind           public.stock_move_kind not null,
  -- Signed: positive adds stock, negative removes it. Enforced against `kind`.
  quantity       numeric(20,4) not null check (quantity <> 0),
  unit_cost      numeric(20,4) not null default 0,
  reference_type text,                    -- 'invoice' | 'purchase' | 'manual' | 'transfer'
  reference_id   uuid,
  invoice_id     uuid references public.invoices(id) on delete set null,
  transfer_group uuid,                    -- pairs the out/in rows of a transfer
  notes          text,
  custom_fields  jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now(),
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint stock_movements_sign_matches_kind check (
    case
      when kind in ('in','purchase','return') then quantity > 0
      when kind in ('out','sale','wastage')   then quantity < 0
      else true                                   -- adjustment / transfer may be either
    end
  )
);

create index if not exists stock_movements_product_idx on public.stock_movements (tenant_id, product_id, occurred_at desc);
create index if not exists stock_movements_warehouse_idx on public.stock_movements (tenant_id, warehouse_id, occurred_at desc);
create index if not exists stock_movements_invoice_idx on public.stock_movements (invoice_id);

-- Apply each movement to stock_levels, maintaining a weighted-average cost.
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

create trigger apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.tg_apply_stock_movement();
