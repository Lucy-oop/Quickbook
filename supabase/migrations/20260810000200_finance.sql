-- =============================================================================
--  Myanmar Universal ERP — 0002 FINANCE
--  Chart of accounts, transactions (double-entry capable), invoices, payments.
--
--  Money convention: every monetary column is numeric(20,4) in the *document*
--  currency, paired with `exchange_rate` and a STORED generated `*_base` column
--  in the tenant's base currency (usually MMK). Reports only ever read the
--  *_base columns, so a tenant mixing MMK/THB/USD still gets one clean P&L.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ACCOUNTS (chart of accounts)
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  parent_id      uuid references public.accounts(id) on delete set null,
  code           text not null,
  name_en        text not null,
  name_my        text,
  type           public.account_type not null,
  subtype        text,                        -- 'cash','bank','mobile_wallet','ar','ap','cogs','opex', ...
  currency_code  char(3) references public.currencies(code),
  -- Cash/bank accounts feed the Cash Flow report; everything else is excluded.
  is_cash_like   boolean not null default false,
  is_system      boolean not null default false,   -- system accounts cannot be deleted
  is_active      boolean not null default true,
  opening_balance numeric(20,4) not null default 0,
  description    text,
  custom_fields  jsonb not null default '{}'::jsonb,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint accounts_no_self_parent check (parent_id is null or parent_id <> id)
);

create unique index if not exists accounts_tenant_code_unique on public.accounts (tenant_id, code);
create index if not exists accounts_tenant_type_idx on public.accounts (tenant_id, type) where is_active;

create trigger set_updated_at before update on public.accounts
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- TRANSACTIONS (header)
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  reference      text,
  type           public.transaction_type not null,
  status         public.transaction_status not null default 'posted',
  occurred_on    date not null default current_date,
  contact_id     uuid references public.contacts(id) on delete set null,
  -- Convenience denormalisation for simple income/expense entries so the mobile
  -- Quick-Action dialog can write one row without building journal lines.
  account_id     uuid references public.accounts(id) on delete restrict,   -- category (income/expense account)
  payment_account_id uuid references public.accounts(id) on delete restrict, -- cash/bank account money moved through
  payment_method public.payment_method not null default 'cash',
  currency_code  char(3) not null default 'MMK' references public.currencies(code),
  exchange_rate  numeric(20,8) not null default 1 check (exchange_rate > 0),
  amount         numeric(20,4) not null check (amount >= 0),
  tax_amount     numeric(20,4) not null default 0 check (tax_amount >= 0),
  amount_base    numeric(20,4) generated always as (amount * exchange_rate) stored,
  description    text,
  attachment_url text,
  invoice_id     uuid,                     -- FK added after invoices exists
  custom_fields  jsonb not null default '{}'::jsonb,
  voided_at      timestamptz,
  voided_by      uuid references public.users(id) on delete set null,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists transactions_tenant_date_idx on public.transactions (tenant_id, occurred_on desc);
create index if not exists transactions_tenant_type_idx on public.transactions (tenant_id, type, status);
create index if not exists transactions_creator_idx on public.transactions (tenant_id, created_by);
create index if not exists transactions_contact_idx on public.transactions (tenant_id, contact_id);
create index if not exists transactions_custom_fields_idx on public.transactions using gin (custom_fields jsonb_path_ops);

create trigger set_updated_at before update on public.transactions
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- TRANSACTION LINES (full double-entry for accountants; optional for simple entries)
-- -----------------------------------------------------------------------------
create table if not exists public.transaction_lines (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  account_id     uuid not null references public.accounts(id) on delete restrict,
  debit          numeric(20,4) not null default 0 check (debit  >= 0),
  credit         numeric(20,4) not null default 0 check (credit >= 0),
  exchange_rate  numeric(20,8) not null default 1 check (exchange_rate > 0),
  debit_base     numeric(20,4) generated always as (debit  * exchange_rate) stored,
  credit_base    numeric(20,4) generated always as (credit * exchange_rate) stored,
  memo           text,
  line_no        smallint not null default 1,
  constraint transaction_lines_one_sided check ((debit = 0) <> (credit = 0) or (debit = 0 and credit = 0))
);

create index if not exists transaction_lines_txn_idx on public.transaction_lines (transaction_id);
create index if not exists transaction_lines_account_idx on public.transaction_lines (tenant_id, account_id);

-- -----------------------------------------------------------------------------
-- INVOICES
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  kind             public.invoice_kind not null default 'sales',
  status           public.invoice_status not null default 'draft',
  -- Null while the invoice is a draft. public.post_invoice() assigns the real
  -- number from document_sequences at issue time, so drafts never burn one.
  number           text,
  contact_id       uuid references public.contacts(id) on delete set null,
  -- Snapshot of the contact at issue time; an invoice must not mutate when the
  -- customer record is later edited.
  contact_snapshot jsonb not null default '{}'::jsonb,
  warehouse_id     uuid,                    -- FK added in 0003 (inventory)
  issue_date       date not null default current_date,
  due_date         date,
  currency_code    char(3) not null default 'MMK' references public.currencies(code),
  exchange_rate    numeric(20,8) not null default 1 check (exchange_rate > 0),

  subtotal         numeric(20,4) not null default 0,
  discount_amount  numeric(20,4) not null default 0 check (discount_amount >= 0),
  tax_amount       numeric(20,4) not null default 0 check (tax_amount >= 0),
  shipping_amount  numeric(20,4) not null default 0 check (shipping_amount >= 0),
  total            numeric(20,4) not null default 0,
  paid_amount      numeric(20,4) not null default 0,
  balance_due      numeric(20,4) generated always as (total - paid_amount) stored,
  total_base       numeric(20,4) generated always as (total * exchange_rate) stored,
  -- Cost of goods for this invoice; the source of gross margin. Read of this
  -- column is gated behind `reports.margin` at the view layer.
  cost_total       numeric(20,4) not null default 0,

  payment_method   public.payment_method,
  notes            text,
  terms            text,
  custom_fields    jsonb not null default '{}'::jsonb,
  issued_at        timestamptz,
  voided_at        timestamptz,
  voided_by        uuid references public.users(id) on delete set null,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists invoices_tenant_number_unique on public.invoices (tenant_id, number);
create index if not exists invoices_tenant_status_idx on public.invoices (tenant_id, status, issue_date desc);
create index if not exists invoices_contact_idx on public.invoices (tenant_id, contact_id);
create index if not exists invoices_creator_idx on public.invoices (tenant_id, created_by);
create index if not exists invoices_open_ar_idx on public.invoices (tenant_id, due_date)
  where status in ('issued','partial','overdue');
create index if not exists invoices_custom_fields_idx on public.invoices using gin (custom_fields jsonb_path_ops);

create trigger set_updated_at before update on public.invoices
  for each row execute function public.tg_set_updated_at();

do $$ begin
  alter table public.transactions
    add constraint transactions_invoice_id_fkey
    foreign key (invoice_id) references public.invoices(id) on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- INVOICE ITEMS
-- -----------------------------------------------------------------------------
create table if not exists public.invoice_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  product_id      uuid,                    -- FK added in 0003; null = free-text line
  line_no         smallint not null default 1,
  description     text not null,
  sku             text,
  quantity        numeric(20,4) not null default 1 check (quantity <> 0),
  unit            text,
  unit_price      numeric(20,4) not null default 0,
  -- Snapshotted cost at sale time — inventory cost can change afterwards.
  unit_cost       numeric(20,4) not null default 0,
  discount_amount numeric(20,4) not null default 0 check (discount_amount >= 0),
  tax_rate        numeric(9,4) not null default 0 check (tax_rate >= 0),
  tax_amount      numeric(20,4) not null default 0,
  line_total      numeric(20,4) generated always as
                    (round((quantity * unit_price) - discount_amount + tax_amount, 4)) stored,
  line_cost       numeric(20,4) generated always as (round(quantity * unit_cost, 4)) stored,
  custom_fields   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index if not exists invoice_items_product_idx on public.invoice_items (tenant_id, product_id);

-- -----------------------------------------------------------------------------
-- PAYMENTS (settle AR / AP; many payments per invoice)
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  invoice_id      uuid references public.invoices(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  transaction_id  uuid references public.transactions(id) on delete set null,
  account_id      uuid references public.accounts(id) on delete restrict, -- cash/bank received into
  number          text,
  direction       text not null default 'in' check (direction in ('in','out')),
  method          public.payment_method not null default 'cash',
  currency_code   char(3) not null default 'MMK' references public.currencies(code),
  exchange_rate   numeric(20,8) not null default 1 check (exchange_rate > 0),
  amount          numeric(20,4) not null check (amount > 0),
  amount_base     numeric(20,4) generated always as (amount * exchange_rate) stored,
  paid_on         date not null default current_date,
  reference       text,
  notes           text,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists payments_tenant_date_idx on public.payments (tenant_id, paid_on desc);
create index if not exists payments_invoice_idx on public.payments (invoice_id);

create trigger set_updated_at before update on public.payments
  for each row execute function public.tg_set_updated_at();
