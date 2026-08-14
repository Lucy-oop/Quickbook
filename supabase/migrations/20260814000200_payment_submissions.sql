-- =============================================================================
--  MANUAL PAYMENT SUBMISSIONS
--
--  Myanmar SMEs pay by mobile wallet or bank transfer and send a screenshot of
--  the receipt. There is no card gateway in the loop, so the flow is: the shop
--  transfers money, uploads the slip, and a human at Quick Cash confirms it.
--
--  The submission and the tenant's status change have to happen together — a
--  slip recorded without flipping the tenant to `pending_approval` leaves them
--  staring at the paywall having already paid — so both go through one RPC.
-- =============================================================================

create table if not exists public.payment_submissions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  plan           text not null,
  amount         numeric(20,4) not null check (amount > 0),
  currency_code  char(3) not null default 'MMK' references public.currencies(code),
  payment_method text not null,
  sender_name    text,
  /** Transaction reference, or the last digits of one. Free text on purpose:
      every wallet and bank formats theirs differently. */
  tx_ref         text,
  /** Object path inside the `payment-slips` bucket, not a URL. The bucket is
      private, so a URL would be stale the moment its signature expired. */
  slip_path      text,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  /** Why a submission was rejected, shown back to the shop. */
  review_note    text,
  reviewed_by    uuid references public.users(id) on delete set null,
  reviewed_at    timestamptz,
  submitted_by   uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists payment_submissions_tenant_idx
  on public.payment_submissions (tenant_id, created_at desc);
-- The review queue reads this constantly; pending rows are the only ones it wants.
create index if not exists payment_submissions_pending_idx
  on public.payment_submissions (created_at) where status = 'pending';

alter table public.payment_submissions enable row level security;
revoke all on public.payment_submissions from anon;
grant select, insert, update, delete on public.payment_submissions to authenticated;
grant select, insert, update, delete on public.payment_submissions to service_role;

-- A shop sees its own submissions. Writes go through the RPC below, never
-- directly, so there is no INSERT policy — the function is SECURITY DEFINER.
drop policy if exists payment_submissions_select on public.payment_submissions;
create policy payment_submissions_select on public.payment_submissions
  for select to authenticated
  using (public.has_permission(tenant_id, 'settings.manage'));

-- =============================================================================
--  STORAGE — the `payment-slips` bucket
--
--  Private. A payment slip carries a name, an amount and often a phone number;
--  a public bucket would make every one of them readable by URL to anyone who
--  guessed the path.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-slips',
  'payment-slips',
  false,
  5 * 1024 * 1024,                        -- 5 MB; a phone screenshot is ~1 MB
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored as `<tenant_id>/<uuid>.<ext>`, so the first path segment is
-- the tenant. Every policy below pivots on that.
drop policy if exists payment_slips_insert on storage.objects;
create policy payment_slips_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-slips'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'settings.manage')
  );

drop policy if exists payment_slips_select on storage.objects;
create policy payment_slips_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-slips'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'settings.manage')
  );

-- Deliberately no UPDATE or DELETE policy: a submitted slip is evidence in a
-- payment dispute and must not be swappable after the fact. Removal is an
-- admin action through the service role.

-- =============================================================================
--  submit_payment_slip
--
--  One transaction: record the submission and move the tenant to
--  `pending_approval`, which `tenant_access_state()` treats as usable — the shop
--  keeps working while a human checks the slip.
-- =============================================================================
create or replace function public.submit_payment_slip(
  p_tenant_id      uuid,
  p_plan           text,
  p_amount         numeric,
  p_payment_method text,
  p_sender_name    text default null,
  p_tx_ref         text default null,
  p_slip_path      text default null
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.payment_submissions;
begin
  -- Paying is an owner-level act, and it is the same right that governs the
  -- tenant row this function is about to update.
  if not public.has_permission(p_tenant_id, 'settings.manage') then
    raise exception 'You do not have permission to submit a payment for this business'
      using errcode = '42501';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '23514';
  end if;

  -- A slip already under review should not be duplicated by an impatient second
  -- submission; the shop is already unblocked.
  if exists (
    select 1 from public.payment_submissions
     where tenant_id = p_tenant_id and status = 'pending'
  ) then
    raise exception 'A payment is already awaiting review for this business'
      using errcode = '23505';
  end if;

  insert into public.payment_submissions (
    tenant_id, plan, amount, payment_method, sender_name, tx_ref, slip_path, submitted_by
  ) values (
    p_tenant_id, p_plan, p_amount, p_payment_method,
    nullif(btrim(coalesce(p_sender_name, '')), ''),
    nullif(btrim(coalesce(p_tx_ref, '')), ''),
    nullif(btrim(coalesce(p_slip_path, '')), ''),
    auth.uid()
  )
  returning * into v_row;

  update public.tenants
     set subscription_status = 'pending_approval',
         updated_at = now()
   where id = p_tenant_id;

  return v_row;
end;
$$;

grant execute on function public.submit_payment_slip(uuid, text, numeric, text, text, text, text)
  to authenticated;

-- =============================================================================
--  review_payment_submission — the other half
--
--  Without this, `pending_approval` is a state nothing can leave. Restricted to
--  platform admins (`users.is_platform_admin`): approving your own payment would
--  otherwise be a free subscription.
-- =============================================================================
create or replace function public.review_payment_submission(
  p_submission_id uuid,
  p_approve       boolean,
  p_months        int default null,
  p_note          text default null
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    public.payment_submissions;
  v_admin  boolean;
  v_months int;
begin
  select is_platform_admin into v_admin from public.users where id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'Only a platform administrator can review payments' using errcode = '42501';
  end if;

  select * into v_row from public.payment_submissions
   where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This submission has already been reviewed' using errcode = '22023';
  end if;

  update public.payment_submissions
     set status      = case when p_approve then 'approved' else 'rejected' end,
         review_note = p_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_submission_id
  returning * into v_row;

  if p_approve then
    -- Derive the term from the plan when the caller does not state one.
    v_months := coalesce(p_months, case v_row.plan
                                     when 'starter'  then 1
                                     when 'pro'      then 6
                                     when 'business' then 12
                                     else 1 end);

    update public.tenants
       set subscription_status = 'active',
           subscription_plan   = v_row.plan,
           -- Extends an unexpired plan rather than truncating it, so paying
           -- early never costs the shop the days it already holds.
           plan_expires_at = greatest(coalesce(plan_expires_at, now()), now())
                             + make_interval(months => v_months),
           updated_at = now()
     where id = v_row.tenant_id;
  else
    -- Back to expired so the paywall returns and they can try again.
    update public.tenants
       set subscription_status = 'expired', updated_at = now()
     where id = v_row.tenant_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.review_payment_submission(uuid, boolean, int, text) to authenticated;
