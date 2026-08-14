-- =============================================================================
--  SUBSCRIPTION STATUS — constrained, and a helper that decides "expired"
--
--  `subscription_status` was plain text with no constraint, so a typo like
--  'expried' would be stored happily and then never match any guard — the tenant
--  would silently keep full access. The states are a closed set; the column
--  should say so.
--
--    trialing         in the free period, `trial_ends_at` governs access
--    active           paid, `plan_expires_at` governs access
--    pending_approval a payment slip has been submitted, not yet reviewed
--    expired          trial or plan lapsed, access is gated
--    cancelled        deliberately ended
-- =============================================================================

alter table public.tenants
  add column if not exists plan_expires_at timestamptz;

comment on column public.tenants.plan_expires_at is
  'When a PAID plan lapses. Null while trialing — `trial_ends_at` governs then.';

-- Nothing outside the set exists today (all rows are 'trialing'), so this
-- applies without a repair pass.
update public.tenants
   set subscription_status = 'trialing'
 where subscription_status is null
    or subscription_status not in ('trialing','active','pending_approval','expired','cancelled');

alter table public.tenants
  drop constraint if exists tenants_subscription_status_check;

alter table public.tenants
  add constraint tenants_subscription_status_check
  check (subscription_status in ('trialing','active','pending_approval','expired','cancelled'));

-- -----------------------------------------------------------------------------
--  tenant_access_state — one definition of "is this tenant paid up?"
--
--  The rule lives in SQL rather than only in TypeScript so that a future report,
--  cron job or admin tool cannot reach a different verdict than the app does.
--  `getSessionContext` reads the same columns and applies the same rule; this
--  function is what anything server-side should call.
--
--  Returns 'ok' | 'trialing' | 'expired' | 'pending_approval'.
--
--  Note `pending_approval` is NOT expired: a shop that has paid and is waiting
--  on a human to check the slip must keep working. Locking them out would punish
--  them for our review queue.
-- -----------------------------------------------------------------------------
create or replace function public.tenant_access_state(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when t.subscription_status = 'pending_approval' then 'pending_approval'
    when t.subscription_status = 'active'
      then case when t.plan_expires_at is null or t.plan_expires_at > now()
                then 'ok' else 'expired' end
    when t.subscription_status = 'trialing'
      -- A null trial end means the trial was never stamped. Treated as open
      -- rather than expired: failing closed on missing data would lock out
      -- every tenant created before trials existed.
      then case when t.trial_ends_at is null or t.trial_ends_at > now()
                then 'trialing' else 'expired' end
    else 'expired'
  end
  from public.tenants t
  where t.id = p_tenant_id;
$$;

grant execute on function public.tenant_access_state(uuid) to authenticated;
