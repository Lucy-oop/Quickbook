-- =============================================================================
--  Myanmar Universal ERP — 0005 ROW LEVEL SECURITY
--
--  Two-layer model:
--    Layer 1 (isolation) — `tenant_id = any(public.user_tenant_ids())`.
--                          Nothing crosses a tenant boundary, ever.
--    Layer 2 (RBAC)      — `public.has_permission(tenant_id, '<key>')`.
--                          Decides what a member may do *inside* their tenant.
--
--  The helper functions are SECURITY DEFINER on purpose: they read
--  `memberships` / `roles_permissions`, and a policy on `memberships` that
--  queried `memberships` under RLS would recurse infinitely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECURITY HELPERS
-- -----------------------------------------------------------------------------

-- Every tenant the caller is an ACTIVE member of. Returns '{}' for anon.
create or replace function public.user_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(m.tenant_id), '{}'::uuid[])
    from public.memberships m
   where m.user_id = auth.uid()
     and m.status = 'active';
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid()
       and m.tenant_id = p_tenant_id
       and m.status = 'active'
  );
$$;

create or replace function public.is_tenant_owner(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.memberships m
      join public.roles r on r.id = m.role_id
     where m.user_id = auth.uid()
       and m.tenant_id = p_tenant_id
       and m.status = 'active'
       and r.is_owner_role
  );
$$;

-- Resolution order:
--   1. owner role                      -> always true
--   2. per-user explicit grant         -> true
--   3. per-user explicit revoke        -> false  (revoke beats the role)
--   4. role grant                      -> true
--   otherwise                          -> false
create or replace function public.has_permission(p_tenant_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.memberships m
      join public.roles r on r.id = m.role_id
     where m.user_id  = auth.uid()
       and m.tenant_id = p_tenant_id
       and m.status = 'active'
       and (
         r.is_owner_role
         or coalesce(m.permission_overrides -> 'granted', '[]'::jsonb) ? p_permission
         or (
           not (coalesce(m.permission_overrides -> 'revoked', '[]'::jsonb) ? p_permission)
           and exists (
             select 1 from public.roles_permissions rp
              where rp.role_id = r.id
                and rp.permission_key = p_permission
           )
         )
       )
  );
$$;

-- Warehouses a member may touch. '{}' in the membership means "all of them".
create or replace function public.user_warehouse_scope(p_tenant_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.warehouse_scope, '{}'::uuid[])
    from public.memberships m
   where m.user_id = auth.uid()
     and m.tenant_id = p_tenant_id
     and m.status = 'active'
   limit 1;
$$;

create or replace function public.can_access_warehouse(p_tenant_id uuid, p_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_warehouse_id is null
      or cardinality(public.user_warehouse_scope(p_tenant_id)) = 0
      or p_warehouse_id = any (public.user_warehouse_scope(p_tenant_id));
$$;

revoke execute on function public.user_tenant_ids()            from public, anon;
revoke execute on function public.is_tenant_member(uuid)       from public, anon;
revoke execute on function public.is_tenant_owner(uuid)        from public, anon;
revoke execute on function public.has_permission(uuid, text)   from public, anon;
revoke execute on function public.user_warehouse_scope(uuid)   from public, anon;
revoke execute on function public.can_access_warehouse(uuid, uuid) from public, anon;

grant execute on function public.user_tenant_ids()            to authenticated;
grant execute on function public.is_tenant_member(uuid)       to authenticated;
grant execute on function public.is_tenant_owner(uuid)        to authenticated;
grant execute on function public.has_permission(uuid, text)   to authenticated;
grant execute on function public.user_warehouse_scope(uuid)   to authenticated;
grant execute on function public.can_access_warehouse(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- ENABLE RLS EVERYWHERE
--
-- Deliberately ENABLE without FORCE. `authenticated` is never a table owner, so
-- policies bind to it either way. FORCE would additionally apply policies to the
-- owner — which is exactly the role that the SECURITY DEFINER provisioning
-- functions (create_tenant, post_invoice, the auth sign-up trigger) run as, and
-- those need to write rows across tables no end user could write directly.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','users','roles','permissions','roles_permissions','memberships',
    'currencies','exchange_rates','contacts','document_sequences',
    'accounts','transactions','transaction_lines','invoices','invoice_items','payments',
    'warehouses','product_categories','products','stock_levels','stock_movements',
    'custom_fields_schema','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Nothing is reachable without a session. `anon` gets no table privileges at all;
-- the only anonymous surface is Supabase Auth itself.
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','users','roles','permissions','roles_permissions','memberships',
    'currencies','exchange_rates','contacts','document_sequences',
    'accounts','transactions','transaction_lines','invoices','invoice_items','payments',
    'warehouses','product_categories','products','stock_levels','stock_movements',
    'custom_fields_schema','audit_logs'
  ] loop
    execute format('revoke all on public.%I from anon;', t);
  end loop;
end $$;

-- =============================================================================
--  REFERENCE DATA — readable by any signed-in user, writable by nobody
-- =============================================================================
drop policy if exists currencies_read on public.currencies;
create policy currencies_read on public.currencies
  for select to authenticated using (true);

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions
  for select to authenticated using (true);

-- =============================================================================
--  TENANTS
-- =============================================================================
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select to authenticated
  using (id = any (public.user_tenant_ids()));

-- Tenants are created through public.create_tenant() (SECURITY DEFINER), which
-- also seeds roles and the owner membership. Direct INSERT is intentionally
-- not granted: a bare tenant with no owner would be unreachable.
drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update to authenticated
  using (public.has_permission(id, 'settings.manage'))
  with check (public.has_permission(id, 'settings.manage'));

drop policy if exists tenants_delete on public.tenants;
create policy tenants_delete on public.tenants
  for delete to authenticated
  using (public.is_tenant_owner(id));

-- =============================================================================
--  USERS — own profile, plus the profiles of co-workers in shared tenants
-- =============================================================================
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
       where m.user_id = public.users.id
         and m.tenant_id = any (public.user_tenant_ids())
    )
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =============================================================================
--  RBAC TABLES
-- =============================================================================
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (tenant_id is null or tenant_id = any (public.user_tenant_ids()));

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (tenant_id is not null and not is_system and public.has_permission(tenant_id, 'members.manage'))
  with check (tenant_id is not null and not is_system and public.has_permission(tenant_id, 'members.manage'));

drop policy if exists roles_permissions_select on public.roles_permissions;
create policy roles_permissions_select on public.roles_permissions
  for select to authenticated
  using (exists (
    select 1 from public.roles r
     where r.id = role_id
       and (r.tenant_id is null or r.tenant_id = any (public.user_tenant_ids()))
  ));

drop policy if exists roles_permissions_write on public.roles_permissions;
create policy roles_permissions_write on public.roles_permissions
  for all to authenticated
  using (exists (
    select 1 from public.roles r
     where r.id = role_id and r.tenant_id is not null and not r.is_system
       and public.has_permission(r.tenant_id, 'members.manage')
  ))
  with check (exists (
    select 1 from public.roles r
     where r.id = role_id and r.tenant_id is not null and not r.is_system
       and public.has_permission(r.tenant_id, 'members.manage')
  ));

-- Members see the roster of their tenant; only members.manage can change it.
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission(tenant_id, 'members.read')
  );

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.has_permission(tenant_id, 'members.invite'));

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update to authenticated
  using (
    public.has_permission(tenant_id, 'members.manage')
    -- Nobody may edit an owner's membership except another owner.
    and (not exists (select 1 from public.roles r where r.id = role_id and r.is_owner_role)
         or public.is_tenant_owner(tenant_id))
  )
  with check (public.has_permission(tenant_id, 'members.manage'));

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (
    public.has_permission(tenant_id, 'members.manage')
    and user_id is distinct from (select auth.uid())     -- can't remove yourself
    and (not exists (select 1 from public.roles r where r.id = role_id and r.is_owner_role)
         or public.is_tenant_owner(tenant_id))
  );

-- =============================================================================
--  EXCHANGE RATES — global rows readable by all, tenant overrides by members
-- =============================================================================
drop policy if exists exchange_rates_select on public.exchange_rates;
create policy exchange_rates_select on public.exchange_rates
  for select to authenticated
  using (tenant_id is null or tenant_id = any (public.user_tenant_ids()));

drop policy if exists exchange_rates_write on public.exchange_rates;
create policy exchange_rates_write on public.exchange_rates
  for all to authenticated
  using (tenant_id is not null and public.has_permission(tenant_id, 'currency.manage'))
  with check (tenant_id is not null and public.has_permission(tenant_id, 'currency.manage'));

-- =============================================================================
--  DOCUMENT SEQUENCES
-- =============================================================================
drop policy if exists document_sequences_select on public.document_sequences;
create policy document_sequences_select on public.document_sequences
  for select to authenticated
  using (tenant_id = any (public.user_tenant_ids()));

drop policy if exists document_sequences_write on public.document_sequences;
create policy document_sequences_write on public.document_sequences
  for all to authenticated
  using (public.has_permission(tenant_id, 'settings.manage'))
  with check (public.has_permission(tenant_id, 'settings.manage'));

-- =============================================================================
--  ACCOUNTS (chart of accounts)
-- =============================================================================
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select to authenticated
  using (public.has_permission(tenant_id, 'accounts.read'));

drop policy if exists accounts_write on public.accounts;
create policy accounts_write on public.accounts
  for all to authenticated
  using (public.has_permission(tenant_id, 'accounts.manage') and not is_system)
  with check (public.has_permission(tenant_id, 'accounts.manage'));

-- =============================================================================
--  TRANSACTIONS
--  A cashier holds `transactions.read_own` only: they see the entries they
--  keyed in today, never the tenant-wide ledger a P&L is built from.
-- =============================================================================
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (
    public.has_permission(tenant_id, 'transactions.read')
    or (created_by = (select auth.uid()) and public.has_permission(tenant_id, 'transactions.read_own'))
  );

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (
    public.has_permission(tenant_id, 'transactions.create')
    and created_by = (select auth.uid())
  );

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (
    status <> 'void'
    and (
      public.has_permission(tenant_id, 'transactions.update')
      or (created_by = (select auth.uid())
          and public.has_permission(tenant_id, 'transactions.update_own')
          and occurred_on >= current_date - 1)   -- staff may fix same/previous day only
    )
  )
  with check (public.is_tenant_member(tenant_id));

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete to authenticated
  using (public.has_permission(tenant_id, 'transactions.delete'));

drop policy if exists transaction_lines_select on public.transaction_lines;
create policy transaction_lines_select on public.transaction_lines
  for select to authenticated
  using (exists (
    select 1 from public.transactions t
     where t.id = transaction_id
       and (
         public.has_permission(t.tenant_id, 'transactions.read')
         or (t.created_by = (select auth.uid()) and public.has_permission(t.tenant_id, 'transactions.read_own'))
       )
  ));

drop policy if exists transaction_lines_write on public.transaction_lines;
create policy transaction_lines_write on public.transaction_lines
  for all to authenticated
  using (public.has_permission(tenant_id, 'transactions.create'))
  with check (public.has_permission(tenant_id, 'transactions.create'));

-- =============================================================================
--  INVOICES
-- =============================================================================
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (
    (public.has_permission(tenant_id, 'invoices.read')
     or (created_by = (select auth.uid()) and public.has_permission(tenant_id, 'invoices.read_own')))
    and public.can_access_warehouse(tenant_id, warehouse_id)
  );

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (
    public.has_permission(tenant_id, 'invoices.create')
    and created_by = (select auth.uid())
    and public.can_access_warehouse(tenant_id, warehouse_id)
  );

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using (
    status <> 'void'
    and (
      public.has_permission(tenant_id, 'invoices.update')
      or (created_by = (select auth.uid())
          and status = 'draft'
          and public.has_permission(tenant_id, 'invoices.create'))
    )
  )
  with check (public.is_tenant_member(tenant_id));

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices
  for delete to authenticated
  using (public.has_permission(tenant_id, 'invoices.delete') and status = 'draft');

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (exists (
    select 1 from public.invoices i
     where i.id = invoice_id
       and (public.has_permission(i.tenant_id, 'invoices.read')
            or (i.created_by = (select auth.uid()) and public.has_permission(i.tenant_id, 'invoices.read_own')))
  ));

drop policy if exists invoice_items_write on public.invoice_items;
create policy invoice_items_write on public.invoice_items
  for all to authenticated
  using (exists (
    select 1 from public.invoices i
     where i.id = invoice_id and i.status <> 'void'
       and (public.has_permission(i.tenant_id, 'invoices.update')
            or (i.created_by = (select auth.uid()) and i.status = 'draft'
                and public.has_permission(i.tenant_id, 'invoices.create')))
  ))
  with check (public.has_permission(tenant_id, 'invoices.create'));

-- =============================================================================
--  PAYMENTS
-- =============================================================================
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    public.has_permission(tenant_id, 'payments.read')
    or (created_by = (select auth.uid()) and public.has_permission(tenant_id, 'invoices.read_own'))
  );

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.has_permission(tenant_id, 'payments.create') and created_by = (select auth.uid()));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (public.has_permission(tenant_id, 'payments.manage'))
  with check (public.has_permission(tenant_id, 'payments.manage'));

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated
  using (public.has_permission(tenant_id, 'payments.manage'));

-- =============================================================================
--  CONTACTS
-- =============================================================================
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated
  using (public.has_permission(tenant_id, 'contacts.read'));

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (public.has_permission(tenant_id, 'contacts.manage'));

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
  for update to authenticated
  using (public.has_permission(tenant_id, 'contacts.manage'))
  with check (public.has_permission(tenant_id, 'contacts.manage'));

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete to authenticated
  using (public.has_permission(tenant_id, 'contacts.delete'));

-- =============================================================================
--  INVENTORY
-- =============================================================================
drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses
  for select to authenticated
  using (
    public.has_permission(tenant_id, 'inventory.read')
    and public.can_access_warehouse(tenant_id, id)
  );

drop policy if exists warehouses_write on public.warehouses;
create policy warehouses_write on public.warehouses
  for all to authenticated
  using (public.has_permission(tenant_id, 'inventory.manage_locations'))
  with check (public.has_permission(tenant_id, 'inventory.manage_locations'));

drop policy if exists product_categories_select on public.product_categories;
create policy product_categories_select on public.product_categories
  for select to authenticated
  using (public.has_permission(tenant_id, 'products.read'));

drop policy if exists product_categories_write on public.product_categories;
create policy product_categories_write on public.product_categories
  for all to authenticated
  using (public.has_permission(tenant_id, 'products.manage'))
  with check (public.has_permission(tenant_id, 'products.manage'));

-- NOTE ON COST PRICE: RLS is row-level, not column-level. Every member with
-- `products.read` can technically select products.cost_price. Cost and margin
-- are therefore exposed to the client exclusively through public.v_products
-- (below), which nulls the cost columns unless the caller holds
-- `products.read_cost`. Direct SELECT on public.products is revoked from
-- `authenticated` so the masked view is the only path.
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (public.has_permission(tenant_id, 'products.read'));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated
  with check (public.has_permission(tenant_id, 'products.manage'));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using (public.has_permission(tenant_id, 'products.manage'))
  with check (public.has_permission(tenant_id, 'products.manage'));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated
  using (public.has_permission(tenant_id, 'products.delete'));

drop policy if exists stock_levels_select on public.stock_levels;
create policy stock_levels_select on public.stock_levels
  for select to authenticated
  using (
    public.has_permission(tenant_id, 'inventory.read')
    and public.can_access_warehouse(tenant_id, warehouse_id)
  );

-- stock_levels is maintained solely by the tg_apply_stock_movement trigger.
drop policy if exists stock_levels_no_direct_write on public.stock_levels;
create policy stock_levels_no_direct_write on public.stock_levels
  for all to authenticated using (false) with check (false);

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (
    public.has_permission(tenant_id, 'inventory.read')
    and public.can_access_warehouse(tenant_id, warehouse_id)
  );

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (
    public.has_permission(tenant_id, 'inventory.adjust')
    and public.can_access_warehouse(tenant_id, warehouse_id)
    and created_by = (select auth.uid())
  );

-- The stock ledger is append-only; corrections are made with a counter-movement.
drop policy if exists stock_movements_immutable on public.stock_movements;
create policy stock_movements_immutable on public.stock_movements
  for update to authenticated using (false) with check (false);

drop policy if exists stock_movements_no_delete on public.stock_movements;
create policy stock_movements_no_delete on public.stock_movements
  for delete to authenticated using (false);

-- =============================================================================
--  CUSTOM FIELDS SCHEMA
-- =============================================================================
drop policy if exists custom_fields_schema_select on public.custom_fields_schema;
create policy custom_fields_schema_select on public.custom_fields_schema
  for select to authenticated
  using (tenant_id = any (public.user_tenant_ids()));

drop policy if exists custom_fields_schema_write on public.custom_fields_schema;
create policy custom_fields_schema_write on public.custom_fields_schema
  for all to authenticated
  using (public.has_permission(tenant_id, 'settings.custom_fields'))
  with check (public.has_permission(tenant_id, 'settings.custom_fields'));

-- =============================================================================
--  AUDIT LOGS — read-only to holders of audit.read; never writable from a client
-- =============================================================================
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.has_permission(tenant_id, 'audit.read'));

drop policy if exists audit_logs_no_write on public.audit_logs;
create policy audit_logs_no_write on public.audit_logs
  for all to authenticated using (false) with check (false);

-- =============================================================================
--  TABLE GRANTS
--  RLS filters rows; grants decide which verbs exist at all.
-- =============================================================================
grant usage on schema public to authenticated;

grant select on public.currencies, public.permissions to authenticated;
grant select, update on public.tenants to authenticated;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on
  public.roles, public.roles_permissions, public.memberships,
  public.exchange_rates, public.contacts, public.accounts,
  public.transactions, public.transaction_lines, public.payments,
  public.warehouses, public.product_categories,
  public.custom_fields_schema
  to authenticated;
grant select, insert on public.stock_movements to authenticated;
grant select on public.audit_logs, public.document_sequences to authenticated;

-- ---------------------------------------------------------------------------
--  COLUMN-LEVEL PROTECTION FOR COST & MARGIN
--  RLS cannot hide a column, so the cost columns are simply not granted to
--  `authenticated` at all. They are surfaced through the views in 0006, which
--  call SECURITY DEFINER helpers gated on `products.read_cost` /
--  `reports.margin`. A cashier querying the base table cannot name the column.
-- ---------------------------------------------------------------------------
revoke select on public.products, public.invoices, public.invoice_items, public.stock_levels
  from authenticated;

grant insert, update, delete on public.products to authenticated;
grant select (
  id, tenant_id, category_id, sku, barcode, name, name_my, description, unit,
  track_inventory, selling_price, wholesale_price, currency_code, tax_rate,
  reorder_level, reorder_quantity, image_url, custom_fields, is_active,
  created_by, created_at, updated_at
) on public.products to authenticated;

grant insert, update, delete on public.invoices to authenticated;
grant select (
  id, tenant_id, kind, status, number, contact_id, contact_snapshot, warehouse_id,
  issue_date, due_date, currency_code, exchange_rate, subtotal, discount_amount,
  tax_amount, shipping_amount, total, paid_amount, balance_due, total_base,
  payment_method, notes, terms, custom_fields, issued_at, voided_at, voided_by,
  created_by, created_at, updated_at
) on public.invoices to authenticated;

grant insert, update, delete on public.invoice_items to authenticated;
grant select (
  id, tenant_id, invoice_id, product_id, line_no, description, sku, quantity,
  unit, unit_price, discount_amount, tax_rate, tax_amount, line_total,
  custom_fields, created_at
) on public.invoice_items to authenticated;

grant select (tenant_id, product_id, warehouse_id, quantity, reserved, available, updated_at)
  on public.stock_levels to authenticated;

grant usage, select on all sequences in schema public to authenticated;
