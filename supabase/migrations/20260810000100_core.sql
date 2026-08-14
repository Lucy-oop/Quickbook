-- =============================================================================
--  Myanmar Universal ERP — 0001 CORE
--  Extensions, enums, utility functions, tenants, users, RBAC, currencies.
--  Every tenant-scoped table carries `tenant_id uuid not null` — this is the
--  single anchor that every RLS policy in 0005 keys off.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.business_type as enum ('retail','service','restaurant','wholesale','manufacturing','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('invited','active','suspended','revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_type as enum ('asset','liability','equity','income','expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('income','expense','transfer','journal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_status as enum ('draft','posted','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_kind as enum ('sales','purchase','quote','pos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('draft','issued','partial','paid','overdue','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash','bank_transfer','kbz_pay','wave_pay','aya_pay','cb_pay','card','credit','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_kind as enum ('customer','supplier','both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_move_kind as enum ('in','out','adjustment','transfer','sale','purchase','return','wastage');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.custom_field_type as enum (
    'text','textarea','number','decimal','date','datetime','boolean',
    'select','multiselect','email','phone','url','barcode','file','currency'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.custom_field_entity as enum (
    'product','contact','transaction','invoice','invoice_item','warehouse','member'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_action as enum ('insert','update','delete','login','export','void','restore');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- UTILITY: updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- CURRENCIES (global reference data — readable by every authenticated user)
-- -----------------------------------------------------------------------------
create table if not exists public.currencies (
  code            char(3) primary key,
  name            text        not null,
  name_my         text,
  symbol          text        not null,
  decimal_digits  smallint    not null default 2,
  is_active       boolean     not null default true
);

comment on table public.currencies is 'Global ISO-4217 currency reference. Not tenant scoped.';

-- Exchange rates: a null tenant_id row is a system/auto-fetched rate, a non-null
-- tenant_id row is the tenant''s own manual override for that date.
create table if not exists public.exchange_rates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid, -- FK added after public.tenants is created (see below)
  base_code     char(3) not null references public.currencies(code),
  quote_code    char(3) not null references public.currencies(code),
  rate          numeric(20,8) not null check (rate > 0),
  rate_date     date not null default current_date,
  source        text not null default 'manual',
  created_by    uuid,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- TENANTS (the business)
-- -----------------------------------------------------------------------------
create table if not exists public.tenants (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    citext not null unique,
  business_type           public.business_type not null default 'retail',
  legal_name              text,
  tax_number              text,
  phone                   text,
  email                   citext,
  address                 text,
  city                    text,
  country_code            char(2) not null default 'MM',
  timezone                text not null default 'Asia/Yangon',
  default_locale          text not null default 'my' check (default_locale in ('my','en')),
  base_currency           char(3) not null default 'MMK' references public.currencies(code),
  fiscal_year_start_month smallint not null default 4 check (fiscal_year_start_month between 1 and 12),
  logo_url                text,
  -- Free-form tenant preferences: receipt footer, POS layout, tax defaults, etc.
  settings                jsonb not null default '{}'::jsonb,
  subscription_plan       text not null default 'free',
  subscription_status     text not null default 'trialing',
  trial_ends_at           timestamptz,
  is_active               boolean not null default true,
  created_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Deferred FK: exchange_rates was declared before tenants existed in some
-- migration orders; make sure the constraint exists exactly once.
do $$ begin
  alter table public.exchange_rates
    add constraint exchange_rates_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- Two plain indexes rather than one on `coalesce(tenant_id, …)`: an expression
-- index cannot be named as an ON CONFLICT target, and the client upserts a
-- tenant's daily rate by column list. The first covers tenant overrides; the
-- second stops duplicate global rows (where NULLs would otherwise be distinct).
-- Non-partial on purpose: ON CONFLICT infers an arbiter only from a unique
-- index with no predicate, and PostgREST's `onConflict` takes columns only —
-- it cannot supply the `WHERE` a partial index would demand.
create unique index if not exists exchange_rates_daily_unique
  on public.exchange_rates (tenant_id, base_code, quote_code, rate_date);

create unique index if not exists exchange_rates_global_daily_unique
  on public.exchange_rates (base_code, quote_code, rate_date)
  where tenant_id is null;

create trigger set_updated_at before update on public.tenants
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- USERS (public mirror of auth.users — profile data)
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext,
  phone             text,
  full_name         text,
  avatar_url        text,
  locale            text not null default 'my' check (locale in ('my','en')),
  -- Last tenant the user was working in; used to restore context on login.
  last_tenant_id    uuid references public.tenants(id) on delete set null,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger set_updated_at before update on public.users
  for each row execute function public.tg_set_updated_at();

-- Auto-provision a profile row whenever Supabase Auth creates a user.
create or replace function public.tg_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone, full_name, avatar_url)
  values (
    new.id,
    nullif(new.email, '')::citext,
    nullif(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- Claim any pending invitations that were addressed to this email/phone.
  update public.memberships m
     set user_id      = new.id,
         status       = 'active',
         joined_at    = now(),
         invited_email = null
   where m.user_id is null
     and m.status = 'invited'
     and (
       (m.invited_email is not null and m.invited_email = nullif(new.email,'')::citext)
       or (m.invited_phone is not null and m.invited_phone = nullif(new.phone,''))
     );

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- RBAC: permissions catalog -> roles -> roles_permissions -> memberships
-- -----------------------------------------------------------------------------
create table if not exists public.permissions (
  key          text primary key,
  module       text not null,
  label_en     text not null,
  label_my     text,
  description  text,
  -- Sensitive permissions (cost price, margins, P&L) are flagged so the UI can
  -- warn an owner before granting them to a low-trust role.
  is_sensitive boolean not null default false
);

create table if not exists public.roles (
  id            uuid primary key default gen_random_uuid(),
  -- null tenant_id => a system preset role available to every tenant as a template
  tenant_id     uuid references public.tenants(id) on delete cascade,
  key           text not null,
  name_en       text not null,
  name_my       text,
  description   text,
  is_system     boolean not null default false,
  -- Owner role bypasses individual permission checks entirely.
  is_owner_role boolean not null default false,
  rank          smallint not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists roles_tenant_key_unique
  on public.roles (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

create trigger set_updated_at before update on public.roles
  for each row execute function public.tg_set_updated_at();

create table if not exists public.roles_permissions (
  role_id        uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  granted_at     timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table if not exists public.memberships (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  user_id              uuid references public.users(id) on delete cascade,
  role_id              uuid not null references public.roles(id) on delete restrict,
  status               public.membership_status not null default 'invited',
  -- Per-user deltas on top of the role:
  --   { "granted": ["reports.pnl"], "revoked": ["products.read_cost"] }
  permission_overrides jsonb not null default '{"granted":[],"revoked":[]}'::jsonb,
  -- Restrict a cashier to one shop/warehouse. Empty array = all locations.
  warehouse_scope      uuid[] not null default '{}',
  invited_email        citext,
  invited_phone        text,
  invite_token         uuid default gen_random_uuid(),
  invited_by           uuid references public.users(id) on delete set null,
  invited_at           timestamptz not null default now(),
  joined_at            timestamptz,
  revoked_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint memberships_identity_check
    check (user_id is not null or invited_email is not null or invited_phone is not null)
);

create unique index if not exists memberships_tenant_user_unique
  on public.memberships (tenant_id, user_id) where user_id is not null;
create index if not exists memberships_user_idx on public.memberships (user_id) where user_id is not null;
create index if not exists memberships_tenant_idx on public.memberships (tenant_id);

create trigger set_updated_at before update on public.memberships
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- CONTACTS (customers & suppliers — drives AR / AP)
-- -----------------------------------------------------------------------------
create table if not exists public.contacts (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  kind           public.contact_kind not null default 'customer',
  code           text,
  name           text not null,
  phone          text,
  email          citext,
  address        text,
  tax_number     text,
  credit_limit   numeric(20,4) not null default 0,
  payment_terms_days smallint not null default 0,
  currency_code  char(3) references public.currencies(code),
  notes          text,
  custom_fields  jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists contacts_tenant_code_unique
  on public.contacts (tenant_id, code) where code is not null;
create index if not exists contacts_tenant_idx on public.contacts (tenant_id);
create index if not exists contacts_name_trgm on public.contacts using gin (name gin_trgm_ops);
create index if not exists contacts_custom_fields_idx on public.contacts using gin (custom_fields jsonb_path_ops);

create trigger set_updated_at before update on public.contacts
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- DOCUMENT SEQUENCES (per-tenant invoice / receipt numbering)
-- -----------------------------------------------------------------------------
create table if not exists public.document_sequences (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  doc_type    text not null,               -- 'sales_invoice' | 'purchase_invoice' | 'pos' | 'payment' | 'journal'
  prefix      text not null default '',
  padding     smallint not null default 5,
  next_number bigint not null default 1,
  period_key  text not null default '',    -- optional yyyy or yyyyMM reset bucket
  primary key (tenant_id, doc_type)
);
