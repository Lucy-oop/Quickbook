-- -----------------------------------------------------------------------------
-- Deleting a business was impossible.
--
-- `write_audit_log` is an AFTER DELETE trigger on public.tenants, and
-- audit_logs.tenant_id references tenants(id). Deleting a tenant therefore
-- tried to insert an audit row pointing at the row that had just been removed:
--
--   ERROR: insert or update on table "audit_logs" violates foreign key
--          constraint "audit_logs_tenant_id_fkey"
--
-- The same abort hit every child row on the way down, because ON DELETE CASCADE
-- fires the audit trigger for each cascaded delete while the parent tenant is
-- already gone.
--
-- Skipping those rows loses nothing: audit_logs.tenant_id is ON DELETE CASCADE,
-- so any row written for a departing tenant would be deleted in the same
-- statement. The FK only turned that no-op into an error.
-- -----------------------------------------------------------------------------

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

  -- The tenant is on its way out (either this row IS the tenant, or we are
  -- inside its ON DELETE CASCADE). There is no parent left to hang an audit row
  -- on, and the FK would cascade it away regardless — so record nothing.
  if TG_OP = 'DELETE'
     and not exists (select 1 from public.tenants where id = v_tenant) then
    return old;
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
