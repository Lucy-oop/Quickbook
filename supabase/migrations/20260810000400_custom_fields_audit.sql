-- =============================================================================
--  Myanmar Universal ERP — 0004 CUSTOM FIELDS ENGINE + AUDIT LOG
--
--  Design: one row per user-defined field in `custom_fields_schema`; the values
--  live in the owning table's `custom_fields jsonb` column (GIN indexed).
--  A generic trigger validates every write against the tenant's own schema, so
--  a bad payload is rejected in the database, not just in the browser.
-- =============================================================================

create table if not exists public.custom_fields_schema (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  entity         public.custom_field_entity not null,
  -- Stable machine key used inside the jsonb payload, e.g. "imei".
  field_key      text not null check (field_key ~ '^[a-z][a-z0-9_]{0,48}$'),
  label_en       text not null,
  label_my       text,
  field_type     public.custom_field_type not null default 'text',
  is_required    boolean not null default false,
  is_unique      boolean not null default false,
  is_searchable  boolean not null default false,
  show_in_list   boolean not null default false,
  show_on_print  boolean not null default false,
  default_value  jsonb,
  -- select/multiselect choices: [{"value":"a","label_en":"A","label_my":"အေ"}]
  options        jsonb not null default '[]'::jsonb,
  -- { "min":0, "max":100, "minLength":3, "maxLength":20, "regex":"^\\d{15}$" }
  validation     jsonb not null default '{}'::jsonb,
  help_text      text,
  sort_order     smallint not null default 0,
  is_active      boolean not null default true,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists custom_fields_schema_unique
  on public.custom_fields_schema (tenant_id, entity, field_key);
create index if not exists custom_fields_schema_lookup
  on public.custom_fields_schema (tenant_id, entity) where is_active;

create trigger set_updated_at before update on public.custom_fields_schema
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Server-side validation of a custom_fields payload against the tenant schema.
-- Attached via a trigger to every table that owns a `custom_fields` column.
-- TG_ARGV[0] = entity name matching public.custom_field_entity.
-- -----------------------------------------------------------------------------
create or replace function public.tg_validate_custom_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity public.custom_field_entity := TG_ARGV[0]::public.custom_field_entity;
  v_field  record;
  v_value  jsonb;
  v_text   text;
  v_num    numeric;
begin
  if new.custom_fields is null then
    new.custom_fields := '{}'::jsonb;
  end if;

  if jsonb_typeof(new.custom_fields) <> 'object' then
    raise exception 'custom_fields must be a JSON object' using errcode = '22023';
  end if;

  for v_field in
    select * from public.custom_fields_schema
     where tenant_id = new.tenant_id and entity = v_entity and is_active
  loop
    v_value := new.custom_fields -> v_field.field_key;

    -- Apply defaults for absent keys.
    if v_value is null and v_field.default_value is not null then
      new.custom_fields := jsonb_set(new.custom_fields, array[v_field.field_key], v_field.default_value, true);
      v_value := v_field.default_value;
    end if;

    if v_field.is_required and (v_value is null or v_value = 'null'::jsonb or v_value = '""'::jsonb) then
      raise exception 'Custom field "%" is required', coalesce(v_field.label_en, v_field.field_key)
        using errcode = '23514';
    end if;

    if v_value is null or v_value = 'null'::jsonb then
      continue;
    end if;

    -- Type checks
    if v_field.field_type in ('number','decimal','currency') then
      if jsonb_typeof(v_value) <> 'number' then
        raise exception 'Custom field "%" must be a number', v_field.field_key using errcode = '22023';
      end if;
      v_num := (v_value #>> '{}')::numeric;
      if v_field.validation ? 'min' and v_num < (v_field.validation->>'min')::numeric then
        raise exception 'Custom field "%" is below the allowed minimum', v_field.field_key using errcode = '23514';
      end if;
      if v_field.validation ? 'max' and v_num > (v_field.validation->>'max')::numeric then
        raise exception 'Custom field "%" exceeds the allowed maximum', v_field.field_key using errcode = '23514';
      end if;

    elsif v_field.field_type = 'boolean' then
      if jsonb_typeof(v_value) <> 'boolean' then
        raise exception 'Custom field "%" must be true or false', v_field.field_key using errcode = '22023';
      end if;

    elsif v_field.field_type = 'multiselect' then
      if jsonb_typeof(v_value) <> 'array' then
        raise exception 'Custom field "%" must be an array', v_field.field_key using errcode = '22023';
      end if;
      if jsonb_array_length(v_field.options) > 0
         and exists (
           select 1 from jsonb_array_elements_text(v_value) sel
           where sel not in (select opt->>'value' from jsonb_array_elements(v_field.options) opt)
         ) then
        raise exception 'Custom field "%" contains an option that is not defined', v_field.field_key
          using errcode = '23514';
      end if;

    else
      v_text := v_value #>> '{}';

      if v_field.field_type = 'select' and jsonb_array_length(v_field.options) > 0
         and not exists (select 1 from jsonb_array_elements(v_field.options) opt where opt->>'value' = v_text) then
        raise exception 'Custom field "%" has an invalid option "%"', v_field.field_key, v_text
          using errcode = '23514';
      end if;

      if v_field.field_type in ('date','datetime') then
        begin
          perform v_text::timestamptz;
        exception when others then
          raise exception 'Custom field "%" is not a valid date', v_field.field_key using errcode = '22007';
        end;
      end if;

      if v_field.validation ? 'minLength' and length(v_text) < (v_field.validation->>'minLength')::int then
        raise exception 'Custom field "%" is too short', v_field.field_key using errcode = '23514';
      end if;
      if v_field.validation ? 'maxLength' and length(v_text) > (v_field.validation->>'maxLength')::int then
        raise exception 'Custom field "%" is too long', v_field.field_key using errcode = '23514';
      end if;
      if v_field.validation ? 'regex' and v_text !~ (v_field.validation->>'regex') then
        raise exception 'Custom field "%" has an invalid format', v_field.field_key using errcode = '23514';
      end if;
    end if;

    -- Tenant-scoped uniqueness (e.g. an IMEI may never repeat inside one shop).
    if v_field.is_unique and TG_TABLE_NAME = 'products' then
      if exists (
        select 1 from public.products p
         where p.tenant_id = new.tenant_id
           and p.id <> new.id
           and p.custom_fields -> v_field.field_key = v_value
      ) then
        raise exception 'Custom field "%" must be unique; "%" already exists',
          v_field.field_key, (v_value #>> '{}') using errcode = '23505';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create trigger validate_custom_fields before insert or update of custom_fields on public.products
  for each row execute function public.tg_validate_custom_fields('product');
create trigger validate_custom_fields before insert or update of custom_fields on public.contacts
  for each row execute function public.tg_validate_custom_fields('contact');
create trigger validate_custom_fields before insert or update of custom_fields on public.transactions
  for each row execute function public.tg_validate_custom_fields('transaction');
create trigger validate_custom_fields before insert or update of custom_fields on public.invoices
  for each row execute function public.tg_validate_custom_fields('invoice');

-- -----------------------------------------------------------------------------
-- AUDIT LOG — who changed what, when, from where.
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           bigserial primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  user_email   text,          -- denormalised so the log survives user deletion
  action       public.audit_action not null,
  table_name   text not null,
  record_id    uuid,
  -- Only the columns that actually changed, to keep the log small and readable.
  changed_keys text[],
  old_data     jsonb,
  new_data     jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_tenant_time_idx on public.audit_logs (tenant_id, created_at desc);
create index if not exists audit_logs_record_idx on public.audit_logs (tenant_id, table_name, record_id);
create index if not exists audit_logs_user_idx on public.audit_logs (tenant_id, user_id, created_at desc);

create or replace function public.tg_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid;
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_action  public.audit_action;
  v_email   text;
begin
  if TG_OP = 'DELETE' then
    v_old    := to_jsonb(old);
    v_action := 'delete';
  elsif TG_OP = 'UPDATE' then
    v_old    := to_jsonb(old);
    v_new    := to_jsonb(new);
    v_action := 'update';
    select coalesce(array_agg(key), '{}') into v_changed
      from jsonb_each(v_new) e(key, value)
     where v_old -> e.key is distinct from e.value
       and e.key not in ('updated_at');
    if v_changed = '{}' then
      return new;   -- nothing meaningful changed; don't spam the log
    end if;
  else
    v_new    := to_jsonb(new);
    v_action := 'insert';
  end if;

  -- `tenants` itself has no tenant_id column — its own id is the tenant.
  if TG_TABLE_NAME = 'tenants' then
    v_tenant := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  else
    v_tenant := coalesce((v_new->>'tenant_id')::uuid, (v_old->>'tenant_id')::uuid);
  end if;

  -- Global (tenant-less) reference rows such as system exchange rates are not audited here.
  if v_tenant is null then
    return coalesce(new, old);
  end if;

  select email into v_email from public.users where id = auth.uid();

  insert into public.audit_logs (
    tenant_id, user_id, user_email, action, table_name, record_id,
    changed_keys, old_data, new_data
  ) values (
    v_tenant,
    auth.uid(),
    v_email,
    v_action,
    TG_TABLE_NAME,
    coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid),
    v_changed,
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants','memberships','roles','accounts','transactions','transaction_lines',
    'invoices','invoice_items','payments','products','stock_movements','contacts',
    'custom_fields_schema','warehouses','exchange_rates'
  ] loop
    execute format(
      'drop trigger if exists write_audit_log on public.%I;
       create trigger write_audit_log after insert or update or delete on public.%I
         for each row execute function public.tg_write_audit_log();', t, t);
  end loop;
end $$;
