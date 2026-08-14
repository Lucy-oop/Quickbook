-- =============================================================================
--  invitation_by_token also returns the business's locale
--
--  `/accept-invite` renders for someone with no session, so there is no
--  `session.locale` to hand `<I18nProvider>` — the provider was missing
--  entirely, and the page threw "useI18n must be used inside <I18nProvider>".
--
--  The locale has to come from somewhere, and the honest source is the business
--  being joined: a shop configured in English should not hand its new cashier a
--  Burmese-only page, and vice versa. Guessing from a build-time default would be
--  wrong for whichever tenant does not match it.
--
--  RETURNS TABLE cannot be widened by CREATE OR REPLACE, so the function is
--  dropped and recreated. The body is otherwise unchanged from
--  20260812000300_invitations.sql.
-- =============================================================================
drop function if exists public.invitation_by_token(uuid);

create function public.invitation_by_token(p_token uuid)
returns table (
  valid          boolean,
  reason         text,
  email          text,
  tenant_name    text,
  tenant_locale  text,
  role_name_en   text,
  role_name_my   text,
  expires_at     timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row record;
begin
  select m.status, m.invited_email, m.invite_expires_at,
         t.name as tenant_name, t.default_locale, r.name_en, r.name_my
    into v_row
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    join public.roles   r on r.id = m.role_id
   where m.invite_token = p_token
   limit 1;

  if not found then
    return query select false, 'not_found'::text, null::text, null::text,
                        null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_row.status <> 'invited' then
    -- Already redeemed, suspended or revoked.
    return query select false, 'already_used'::text, null::text, null::text,
                        null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_row.invite_expires_at is not null and v_row.invite_expires_at < now() then
    -- The locale is returned even here: the expiry page is still prose someone
    -- has to read.
    return query select false, 'expired'::text, v_row.invited_email::text, v_row.tenant_name::text,
                        v_row.default_locale::text, v_row.name_en::text, v_row.name_my::text,
                        v_row.invite_expires_at;
    return;
  end if;

  return query select true, null::text, v_row.invited_email::text, v_row.tenant_name::text,
                      v_row.default_locale::text, v_row.name_en::text, v_row.name_my::text,
                      v_row.invite_expires_at;
end;
$$;

grant execute on function public.invitation_by_token(uuid) to anon, authenticated;
