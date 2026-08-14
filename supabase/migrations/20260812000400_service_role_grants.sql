-- =============================================================================
--  service_role table privileges
--
--  Migrations run as `postgres`, and this database's default ACL for that owner
--  grants anon / authenticated / service_role only Dxtm — TRUNCATE, REFERENCES,
--  TRIGGER, MAINTAIN. No SELECT, INSERT, UPDATE or DELETE. The earlier
--  migrations then hand DML to `authenticated` explicitly but never to
--  `service_role`, so every table created here ended up unreadable by it:
--
--    select on public.memberships  ->  42501 permission denied
--
--  `service_role` has BYPASSRLS, which is what makes this easy to miss:
--  bypassing row level security does not bypass a table GRANT, so the policies
--  were never the thing standing in the way.
--
--  This broke the invitation flow specifically. `/api/team/accept-invite` and
--  `redeemInvitation()` look an invitation up by token with the service key —
--  they have to, because the invitee has no session yet and RLS cannot serve
--  them — and that read was failing before it could reach `accept_invitation`.
--
--  Granting DML here matches how hosted Supabase provisions the role. It is not
--  a widening of the app's attack surface: the key is server-only, never sent to
--  the browser, and already bypasses RLS by design.
-- =============================================================================
do $$
declare
  t text;
begin
  for t in
    select table_name
      from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE'
  loop
    execute format('grant select, insert, update, delete on public.%I to service_role;', t);
  end loop;
end $$;

-- Sequences too, or an insert that relies on one fails on nextval().
do $$
declare
  s text;
begin
  for s in
    select sequence_name
      from information_schema.sequences
     where sequence_schema = 'public'
  loop
    execute format('grant usage, select on sequence public.%I to service_role;', s);
  end loop;
end $$;

-- Views the server reads through the service key (v_low_stock is read by the
-- dashboard; the rest are here so a future admin job does not hit the same wall).
do $$
declare
  v text;
begin
  for v in
    select table_name
      from information_schema.views
     where table_schema = 'public'
  loop
    execute format('grant select on public.%I to service_role;', v);
  end loop;
end $$;

-- Anything added after this migration inherits the same privileges, so the next
-- table does not reintroduce the bug.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- `anon` is re-revoked last: the loops above are deliberately broad, and the
-- invariant that anonymous callers hold no table privileges must survive them.
-- (public.currencies and the other reference tables stay reachable through their
-- RLS policies for `authenticated`, not through anon grants.)
do $$
declare
  t text;
begin
  for t in
    select table_name
      from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE'
  loop
    execute format('revoke all on public.%I from anon;', t);
  end loop;
end $$;
