-- Checks supabase/migrations/*.sql on a plain local Postgres (no Supabase needed).
-- Run: scripts/check-supabase-schema.sh. Any failed check raises and stops psql.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Minimal stand-in for what Supabase provides: the auth schema, auth.uid() and the API role.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select jsonb_build_object('email', nullif(current_setting('request.jwt.claim.email', true), '')) $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid(), auth.jwt() to authenticated, anon;
-- A Supabase project grants execute on every new public function to these roles; revoking
-- from public does not undo it.
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated;

\i supabase/migrations/0001_abot_records.sql
\i supabase/migrations/0002_bodyweight_and_media.sql
\i supabase/migrations/20261109_admin_and_redeem.sql
\i supabase/migrations/20261110_lock_down_grants.sql
-- Applying it twice must work: the file is meant to be rerun safely.
\i supabase/migrations/0001_abot_records.sql
\i supabase/migrations/0002_bodyweight_and_media.sql
\i supabase/migrations/20261109_admin_and_redeem.sql
\i supabase/migrations/20261110_lock_down_grants.sql

grant select, insert, update, delete on public.abot_records to authenticated;
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'boss@example.com', now()),
  ('00000000-0000-0000-0000-00000000000c', 'boss2@example.com', null);
-- B is the admin; seeded as the owner, the way the migration says to. C is listed too but never
-- confirmed their email.
insert into public.app_admins (email) values ('boss@example.com'), ('boss2@example.com');

set role authenticated;

-- User A writes one session.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare res record;
begin
  select * into res from public.upsert_if_newer('[{"kind":"session","id":"s1","payload":{"v":1},"updated_at":100}]');
  if res.accepted <> array['session:s1'] then raise exception 'first write not accepted: %', res; end if;

  -- An older copy from another device is rejected and changes nothing.
  select * into res from public.upsert_if_newer('[{"kind":"session","id":"s1","payload":{"v":0},"updated_at":50}]');
  if res.rejected <> array['session:s1'] then raise exception 'older write not rejected: %', res; end if;
  if (select payload->>'v' from public.abot_records where id = 's1') <> '1' then raise exception 'older write changed the row'; end if;

  -- A newer copy wins, a tombstone is stored, and the pull cursor moves forward.
  perform pg_sleep(0.01);
  select * into res from public.upsert_if_newer('[{"kind":"session","id":"s1","payload":{"v":2},"updated_at":200,"deleted":true}]');
  if res.accepted <> array['session:s1'] then raise exception 'newer write not accepted: %', res; end if;
  if not (select deleted from public.abot_records where id = 's1') then raise exception 'tombstone not stored'; end if;
  if (select server_updated_at <= created from public.abot_records, (select now() - interval '1 hour' as created) c where id = 's1') then
    raise exception 'server_updated_at not set';
  end if;
end $$;

-- User B sees none of A's rows and cannot overwrite them.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare res record;
begin
  if (select count(*) from public.abot_records) <> 0 then raise exception 'RLS leak: B can read A''s rows'; end if;
  select * into res from public.upsert_if_newer('[{"kind":"session","id":"s1","payload":{"v":"b"},"updated_at":999}]');
  if (select count(*) from public.abot_records) <> 1 then raise exception 'B''s own row missing'; end if;
  begin
    insert into public.abot_records (user_id, kind, id, payload, updated_at)
      values ('00000000-0000-0000-0000-00000000000a', 'session', 'x', '{}', 1);
    raise exception 'RLS leak: B wrote a row owned by A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.upsert_if_newer('[{"kind":"nonsense","id":"z","payload":{},"updated_at":1}]');
    raise exception 'unknown kind accepted';
  exception when check_violation then null;
  end;
end $$;

-- A's row is untouched by B.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select payload->>'v' from public.abot_records where id = 's1') <> '2' then raise exception 'A''s row changed by B'; end if;
end $$;

-- 0002: weigh-ins and custom videos are accepted, and the pull query the app runs
-- (server_updated_at > cursor, oldest first) returns rows in write order.
do $$
declare res record; first_cursor timestamptz; ids text[];
begin
  select * into res from public.upsert_if_newer(
    '[{"kind":"bodyweight","id":"2026-11-01","payload":{"weightKg":80},"updated_at":10},
      {"kind":"media","id":"squat-barbell","payload":{"customVideoUrl":"https://youtu.be/aaaaaaaaaaa"},"updated_at":11}]');
  if res.accepted <> array['bodyweight:2026-11-01', 'media:squat-barbell'] then raise exception 'new kinds not accepted: %', res; end if;
  select server_updated_at into first_cursor from public.abot_records where kind = 'bodyweight';
  select array_agg(kind || ':' || id order by server_updated_at) into ids
    from public.abot_records where server_updated_at > first_cursor;
  if ids <> array['media:squat-barbell'] then raise exception 'pull after cursor returned %', ids; end if;
end $$;

-- 20261109: remote config, redeem codes, entitlements.
reset role;
set role anon;
set request.jwt.claim.sub = '';
set request.jwt.claim.email = '';
do $$
declare g record;
begin
  if (select monetization_mode from public.app_remote_config) <> 'FOUNDERS_BETA' then raise exception 'anon cannot read the config'; end if;
  begin
    update public.app_remote_config set monetization_mode = 'COMMERCIAL_LIVE';
    raise exception 'anon changed the config';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.redeem_codes;
    raise exception 'anon can list redeem codes';
  exception when insufficient_privilege then null;
  end;
  select * into g from public.redeem_code('NOPE-NOPE');
  if found then raise exception 'unknown code redeemed'; end if;
  begin
    perform public.abot_apply_grant('00000000-0000-0000-0000-00000000000a', 'lifetime', null, true, 'anon');
    raise exception 'anon called abot_apply_grant';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set role authenticated;
-- A, not an admin: cannot change the config or see codes, cannot grant.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.email = 'a@example.com';
do $$ begin
  update public.app_remote_config set monetization_mode = 'COMMERCIAL_LIVE';
  if (select monetization_mode from public.app_remote_config) <> 'FOUNDERS_BETA' then raise exception 'non-admin changed the config'; end if;
  if (select count(*) from public.redeem_codes) <> 0 then raise exception 'non-admin sees codes'; end if;
  begin
    insert into public.redeem_codes (code, grant_tier, duration_days) values ('ABOT-SELF-MADE', 'lifetime', null);
    raise exception 'non-admin created a code';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_grant('a@example.com', 'lifetime', null);
    raise exception 'non-admin granted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_entitlements (user_id, tier) values ('00000000-0000-0000-0000-00000000000a', 'lifetime');
    raise exception 'user wrote their own tier';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.abot_apply_grant('00000000-0000-0000-0000-00000000000a', 'lifetime', null, true, 'self');
    raise exception 'user called abot_apply_grant';
  exception when insufficient_privilege then null;
  end;
end $$;

-- C has an admin's email in the token and in app_admins, but it was never confirmed.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
set request.jwt.claim.email = 'boss2@example.com';
do $$ begin
  if public.is_abot_admin() then raise exception 'unconfirmed email counted as admin'; end if;
  if (select count(*) from public.redeem_codes) <> 0 then raise exception 'unconfirmed admin sees codes'; end if;
end $$;

-- A token that claims the admin's email for another account is not an admin either.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.email = 'boss@example.com';
do $$ begin
  if public.is_abot_admin() then raise exception 'email claim alone counted as admin'; end if;
end $$;

-- B, the admin: changes the config, makes codes, reads stats.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claim.email = 'boss@example.com';
do $$
declare s record;
begin
  update public.app_remote_config set monetization_mode = 'COMMERCIAL_LIVE', announcement_banner = 'v1.1 is out';
  if (select monetization_mode from public.app_remote_config) <> 'COMMERCIAL_LIVE' then raise exception 'admin could not change the config'; end if;
  insert into public.redeem_codes (code, grant_tier, duration_days, max_uses) values ('ABOT-PRO-TEST', 'pro', 30, 1);
  insert into public.redeem_codes (code, grant_tier, duration_days, grants_founder_badge, max_uses) values ('ABOT-LIFE-TEST', 'lifetime', null, true, 5);
  begin
    insert into public.redeem_codes (code, grant_tier, duration_days) values ('ABOT-BAD', 'lifetime', 30);
    raise exception 'lifetime with a duration accepted';
  exception when check_violation then null;
  end;
  select * into s from public.admin_stats();
  if s.total_users <> 3 or s.active_codes <> 2 then raise exception 'stats wrong: %', s; end if;
end $$;

-- A redeems: the grant lands in their row, a second try does not spend another use, a used-up
-- code stops working.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.email = 'a@example.com';
do $$
declare g record;
begin
  select * into g from public.redeem_code(' abot-pro-test ');
  if not found or g.grant_tier <> 'pro' or g.duration_days <> 30 then raise exception 'redeem failed: %', g; end if;
  select * into g from public.redeem_code('ABOT-PRO-TEST');
  if not found then raise exception 'same user redeeming again was refused'; end if;
  if (select tier from public.user_entitlements) <> 'pro' then raise exception 'pro not granted'; end if;
  select * into g from public.redeem_code('ABOT-LIFE-TEST');
  if (select tier from public.user_entitlements) <> 'lifetime' or not (select is_founder from public.user_entitlements) then raise exception 'lifetime + founder not granted'; end if;
end $$;

reset role;
set role anon;
set request.jwt.claim.sub = '';
set request.jwt.claim.email = '';
do $$
declare g record;
begin
  -- One use, taken by A: nobody else gets it.
  select * into g from public.redeem_code('ABOT-PRO-TEST');
  if found then raise exception 'used-up code redeemed again'; end if;
end $$;

reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claim.email = 'boss@example.com';
do $$ begin
  if (select current_uses from public.redeem_codes where code = 'ABOT-PRO-TEST') <> 1 then raise exception 'use count wrong'; end if;
  if not public.admin_grant('boss@example.com', 'pro', 365) then raise exception 'admin_grant did not find the user'; end if;
  if public.admin_grant('nobody@example.com', 'pro', 30) then raise exception 'admin_grant invented a user'; end if;
  if (select tier from public.user_entitlements where user_id = '00000000-0000-0000-0000-00000000000b') <> 'pro' then raise exception 'manual grant missing'; end if;
end $$;

reset role;
\echo 'schema-check: all checks passed'
