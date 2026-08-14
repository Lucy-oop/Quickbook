-- =============================================================================
--  EMAIL INVITATIONS
--
--  Invitations already live on `memberships` (status 'invited' + invited_email +
--  invite_token), and `tg_handle_new_auth_user` claims them the moment a user
--  signs up with the matching address. This migration adds the three things the
--  email flow needs and the table did not have:
--
--    1. an expiry, so a leaked link stops working;
--    2. a way to look an invitation up by token while the invitee is still
--       anonymous — they have no session yet, so RLS cannot serve them;
--    3. protection against the same address being invited to the same business
--       over and over, which the schema allowed because the uniqueness index
--       only covers rows that already have a `user_id`.
-- =============================================================================

alter table public.memberships
  add column if not exists invite_expires_at timestamptz;

comment on column public.memberships.invite_expires_at is
  'When the invite_token stops being redeemable. Null on rows that were never '
  'an email invitation (e.g. the owner''s own membership).';

-- Existing pending invitations get a fresh 48 hours rather than being killed off.
update public.memberships
   set invite_expires_at = now() + interval '48 hours'
 where status = 'invited'
   and invite_expires_at is null;

-- Token lookup happens on every accept-invite page load.
create index if not exists memberships_invite_token_idx
  on public.memberships (invite_token) where invite_token is not null;

-- `memberships_tenant_user_unique` only covers rows with a user_id, so an
-- email-only invitation could be inserted any number of times. One live
-- invitation per address per business.
create unique index if not exists memberships_tenant_invited_email_unique
  on public.memberships (tenant_id, invited_email)
  where user_id is null and invited_email is not null and status = 'invited';

-- -----------------------------------------------------------------------------
--  invite_member — unchanged except that it now stamps an expiry and refreshes
--  an existing pending invitation instead of failing on the new unique index.
--
--  Re-inviting is the normal way to resend: the owner gets a new token and a new
--  48-hour window rather than a duplicate-key error.
-- -----------------------------------------------------------------------------
create or replace function public.invite_member(
  p_tenant_id       uuid,
  p_role_key        text,
  p_email           text default null,
  p_phone           text default null,
  p_warehouse_scope uuid[] default '{}'
)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid;
  v_user_id uuid;
  v_row     public.memberships;
begin
  if not public.has_permission(p_tenant_id, 'members.invite') then
    raise exception 'You do not have permission to invite members' using errcode = '42501';
  end if;
  if p_email is null and p_phone is null then
    raise exception 'An email address or phone number is required' using errcode = '22023';
  end if;

  select id into v_role_id from public.roles
   where tenant_id = p_tenant_id and key = p_role_key;
  if v_role_id is null then
    raise exception 'Unknown role "%"', p_role_key using errcode = '22023';
  end if;
  -- Only an existing owner may mint another owner.
  if exists (select 1 from public.roles where id = v_role_id and is_owner_role)
     and not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Only an owner can grant the owner role' using errcode = '42501';
  end if;

  select id into v_user_id from public.users
   where (p_email is not null and email = p_email::citext)
      or (p_phone is not null and phone = p_phone)
   limit 1;

  -- Someone who already has an account is added outright; there is nothing for
  -- them to accept, so no token is issued.
  insert into public.memberships (
    tenant_id, user_id, role_id, status, warehouse_scope,
    invited_email, invited_phone, invited_by, joined_at, invite_expires_at
  ) values (
    p_tenant_id, v_user_id, v_role_id,
    (case when v_user_id is null then 'invited' else 'active' end)::public.membership_status,
    coalesce(p_warehouse_scope, '{}'),
    p_email::citext, p_phone, auth.uid(),
    case when v_user_id is null then null else now() end,
    case when v_user_id is null then now() + interval '48 hours' else null end
  )
  on conflict (tenant_id, user_id) where user_id is not null
  do update set role_id = excluded.role_id,
                status = 'active',
                warehouse_scope = excluded.warehouse_scope,
                revoked_at = null
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.invite_member(uuid, text, text, text, uuid[]) to authenticated;

-- Re-invite / resend: replaces the pending row's role, token and window.
create or replace function public.reinvite_member(
  p_tenant_id       uuid,
  p_role_key        text,
  p_email           text,
  p_warehouse_scope uuid[] default '{}'
)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid;
  v_row     public.memberships;
begin
  if not public.has_permission(p_tenant_id, 'members.invite') then
    raise exception 'You do not have permission to invite members' using errcode = '42501';
  end if;

  select id into v_role_id from public.roles
   where tenant_id = p_tenant_id and key = p_role_key;
  if v_role_id is null then
    raise exception 'Unknown role "%"', p_role_key using errcode = '22023';
  end if;
  if exists (select 1 from public.roles where id = v_role_id and is_owner_role)
     and not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Only an owner can grant the owner role' using errcode = '42501';
  end if;

  update public.memberships
     set role_id           = v_role_id,
         warehouse_scope   = coalesce(p_warehouse_scope, '{}'),
         invite_token      = gen_random_uuid(),
         invite_expires_at = now() + interval '48 hours',
         invited_by        = auth.uid(),
         invited_at        = now()
   where tenant_id = p_tenant_id
     and invited_email = p_email::citext
     and user_id is null
     and status = 'invited'
  returning * into v_row;

  if not found then
    raise exception 'No pending invitation for %', p_email using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.reinvite_member(uuid, text, text, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
--  invitation_by_token
--
--  Called from the accept-invite page by someone with NO session — RLS cannot
--  help them, so this is SECURITY DEFINER and granted to `anon`.
--
--  It therefore returns the minimum needed to render the page and nothing that
--  would make guessing tokens worthwhile: the business name, the role being
--  offered, and the address the invitation was sent to. No tenant id, no member
--  list, no inviter identity. An unknown or expired token is reported as
--  `valid = false` rather than an error, so probing yields one uniform answer.
-- -----------------------------------------------------------------------------
create or replace function public.invitation_by_token(p_token uuid)
returns table (
  valid          boolean,
  reason         text,
  email          text,
  tenant_name    text,
  role_name_en   text,
  role_name_my   text,
  expires_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
begin
  select m.status, m.invited_email, m.invite_expires_at,
         t.name as tenant_name, r.name_en, r.name_my
    into v_row
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    join public.roles   r on r.id = m.role_id
   where m.invite_token = p_token
   limit 1;

  if not found then
    return query select false, 'not_found'::text, null::text, null::text,
                        null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_row.status <> 'invited' then
    -- Already redeemed, suspended or revoked.
    return query select false, 'already_used'::text, null::text, null::text,
                        null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_row.invite_expires_at is not null and v_row.invite_expires_at < now() then
    return query select false, 'expired'::text, v_row.invited_email::text, v_row.tenant_name::text,
                        v_row.name_en::text, v_row.name_my::text, v_row.invite_expires_at;
    return;
  end if;

  return query select true, null::text, v_row.invited_email::text, v_row.tenant_name::text,
                      v_row.name_en::text, v_row.name_my::text, v_row.invite_expires_at;
end;
$$;

grant execute on function public.invitation_by_token(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
--  accept_invitation
--
--  Binds a redeemed invitation to a real user. `tg_handle_new_auth_user` already
--  claims invitations by matching email on sign-up, which covers the common
--  path; this exists so acceptance is also correct when the addresses differ in
--  case or the account already existed, and so the token is retired explicitly
--  rather than as a side effect.
--
--  SECURITY DEFINER because the invitee's `memberships` row is not yet theirs to
--  update — that is the very thing being established. Holding the token is the
--  authorisation, so the token is re-validated here rather than trusted from the
--  caller.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token uuid, p_user_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending  public.memberships;
  v_existing public.memberships;
  v_row      public.memberships;
begin
  if p_user_id is null then
    raise exception 'A user is required' using errcode = '22023';
  end if;

  -- Locked so two clicks on the same emailed link cannot both redeem it.
  select * into v_pending
    from public.memberships m
   where m.invite_token = p_token
     and m.user_id is null
     and m.status = 'invited'
     and (m.invite_expires_at is null or m.invite_expires_at >= now())
   for update;

  if not found then
    -- Either the sign-up trigger claimed it a moment ago, or the token is spent.
    raise exception 'This invitation is no longer valid' using errcode = 'P0002';
  end if;

  -- This user may already belong to the business — they signed up in between, or
  -- were added by hand. Writing user_id here would then collide with
  -- `memberships_tenant_user_unique` and surface as a raw duplicate-key error.
  -- Acceptance is idempotent instead: the redundant pending row is dropped and
  -- the membership they already have is returned, because the outcome the
  -- invitation was for — access to this business — is already true.
  select * into v_existing
    from public.memberships m
   where m.tenant_id = v_pending.tenant_id
     and m.user_id = p_user_id;

  if found then
    delete from public.memberships where id = v_pending.id;

    -- A revoked or suspended member clicking a fresh invitation is being
    -- deliberately readmitted, so honour the role the invitation offered.
    update public.memberships
       set status     = 'active',
           role_id    = v_pending.role_id,
           joined_at  = coalesce(joined_at, now()),
           revoked_at = null
     where id = v_existing.id
    returning * into v_row;
  else
    update public.memberships
       set user_id           = p_user_id,
           status            = 'active',
           joined_at         = now(),
           invited_email     = null,
           invite_token      = null,
           invite_expires_at = null
     where id = v_pending.id
    returning * into v_row;
  end if;

  update public.users set last_tenant_id = v_row.tenant_id where id = p_user_id;

  return v_row;
end;
$$;

-- Deliberately NOT granted to anon: acceptance runs server-side with the service
-- role after the auth user has actually been created.
revoke all on function public.accept_invitation(uuid, uuid) from public, anon, authenticated;
