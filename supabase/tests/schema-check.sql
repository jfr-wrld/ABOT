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
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
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
\i supabase/migrations/20261111_midtrans_payments.sql
\i supabase/migrations/20261112_payment_test_tools.sql
\i supabase/migrations/20261113_security_hardening.sql
\i supabase/migrations/20261114_founder_seat_lock.sql
-- Applying it twice must work: the file is meant to be rerun safely.
\i supabase/migrations/0001_abot_records.sql
\i supabase/migrations/0002_bodyweight_and_media.sql
\i supabase/migrations/20261109_admin_and_redeem.sql
\i supabase/migrations/20261110_lock_down_grants.sql
\i supabase/migrations/20261111_midtrans_payments.sql
\i supabase/migrations/20261112_payment_test_tools.sql
\i supabase/migrations/20261113_security_hardening.sql
\i supabase/migrations/20261114_founder_seat_lock.sql

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
  -- Signed out, a code cannot be redeemed at all (audit 2026-11-11).
  begin
    select * into g from public.redeem_code('NOPE-NOPE');
    raise exception 'anon called redeem_code';
  exception when insufficient_privilege then null;
  end;
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
  begin
    select * into g from public.redeem_code('ABOT-PRO-TEST');
    raise exception 'anon redeemed a code';
  exception when insufficient_privilege then null;
  end;
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

/* ---------------------------------------------------------------- payments */
-- C has no licence yet. Orders are inserted the way midtrans-checkout does (service role).
update public.app_remote_config set founder_seats = 2 where id = 'global';
grant usage on schema public to service_role;
-- A Supabase project gives service_role every table; the test reads this one directly.
grant select on public.user_entitlements to service_role;
set role service_role;
insert into public.payment_orders (order_id, user_id, plan, amount_idr) values
  ('ABOT-LIFETIME-AAA-111', '00000000-0000-0000-0000-00000000000c', 'founders', 399000),
  ('ABOT-ANNUAL-BBB-222', '00000000-0000-0000-0000-00000000000c', 'annual', 199000),
  ('ABOT-ANNUAL-CCC-333', '00000000-0000-0000-0000-00000000000a', 'annual', 199000);
do $$
declare u uuid := '00000000-0000-0000-0000-00000000000c';
begin
  if public.founder_seats_left() <> 1 then raise exception 'pending founder order should hold a seat'; end if;
  -- Annual first: a year of pro.
  if not public.abot_order_paid('ABOT-ANNUAL-BBB-222', 'qris', 't1') then raise exception 'annual not granted'; end if;
  if public.abot_order_paid('ABOT-ANNUAL-BBB-222', 'qris', 't1') then raise exception 'annual granted twice'; end if;
  if (select tier from public.user_entitlements where user_id = u) <> 'pro'
     or (select pro_expires_at from public.user_entitlements where user_id = u) < now() + interval '364 days'
  then raise exception 'annual should give a year of pro'; end if;
  -- Refund of the year: back to free.
  if not public.abot_order_reversed('ABOT-ANNUAL-BBB-222') then raise exception 'refund not applied'; end if;
  if public.abot_order_reversed('ABOT-ANNUAL-BBB-222') then raise exception 'refund applied twice'; end if;
  if (select tier from public.user_entitlements where user_id = u) <> 'free' then raise exception 'refund left pro on'; end if;
  if public.abot_order_paid('ABOT-ANNUAL-BBB-222', 'qris', 't1') then raise exception 'refunded order granted again'; end if;
  -- Founders lifetime, then a chargeback.
  if not public.abot_order_paid('ABOT-LIFETIME-AAA-111', 'gopay', 't2') then raise exception 'lifetime not granted'; end if;
  if (select tier from public.user_entitlements where user_id = u) <> 'lifetime' then raise exception 'lifetime missing'; end if;
  if public.founder_seats_left() <> 1 then raise exception 'paid founder order should hold a seat'; end if;
  if not public.abot_order_reversed('ABOT-LIFETIME-AAA-111') then raise exception 'chargeback not applied'; end if;
  if (select tier from public.user_entitlements where user_id = u) <> 'free' then raise exception 'chargeback left lifetime on'; end if;
  if public.founder_seats_left() <> 2 then raise exception 'refunded founder order should free its seat'; end if;
  -- A pending order that expires.
  if not public.abot_order_closed('ABOT-ANNUAL-CCC-333', 'expired') then raise exception 'expire not applied'; end if;
  if public.abot_order_closed('ABOT-ANNUAL-CCC-333', 'expired') then raise exception 'closed twice'; end if;
  -- Money that settles after all still buys the plan: Midtrans' settlement is what counts.
  if not public.abot_order_paid('ABOT-ANNUAL-CCC-333', 'qris', 't3') then raise exception 'late settlement not granted'; end if;
end $$;

-- A signed-in user sees their own orders only and cannot mark anything paid.
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.email = 'a@example.com';
do $$ begin
  if (select count(*) from public.payment_orders) <> 1 then raise exception 'user sees other users orders'; end if;
  if (select tier from public.user_entitlements) <> 'lifetime' then raise exception 'a paid year must not downgrade a lifetime licence'; end if;
  if public.founder_seats_left() <> 2 then raise exception 'seats not readable'; end if;
  begin
    perform public.abot_order_paid('ABOT-ANNUAL-CCC-333', 'qris', 'x');
    raise exception 'client called abot_order_paid';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.payment_orders set status = 'paid';
    raise exception 'client updated an order';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Test tools: only an admin, only in sandbox.
reset role;
set role service_role;
insert into public.payment_orders (order_id, user_id, plan, amount_idr) values
  ('ABOT-ANNUAL-SIM-444', '00000000-0000-0000-0000-00000000000c', 'annual', 199000);
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.email = 'a@example.com';
do $$ begin
  begin
    perform public.admin_simulate_payment('ABOT-ANNUAL-SIM-444', 'paid');
    raise exception 'non-admin simulated a payment';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claim.email = 'boss@example.com';
do $$ begin
  if not public.admin_simulate_payment('ABOT-ANNUAL-SIM-444', 'paid') then raise exception 'simulated payment not granted'; end if;
  if (select tier from public.user_entitlements where user_id = '00000000-0000-0000-0000-00000000000c') <> 'pro' then raise exception 'simulated payment gave no pro'; end if;
  if (select count(*) from public.payment_events where order_id = 'ABOT-ANNUAL-SIM-444') <> 1 then raise exception 'simulated payment not logged'; end if;
  if not public.admin_simulate_payment('ABOT-ANNUAL-SIM-444', 'refunded') then raise exception 'simulated refund not applied'; end if;
  if (select tier from public.user_entitlements where user_id = '00000000-0000-0000-0000-00000000000c') <> 'free' then raise exception 'simulated refund left pro'; end if;
end $$;
reset role;
update public.app_remote_config set payments_sandbox = false;
set role authenticated;
do $$ begin
  begin
    perform public.admin_simulate_payment('ABOT-ANNUAL-SIM-444', 'paid');
    raise exception 'simulated a payment outside the sandbox';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Audit 2026-11-11 hardening.
reset role;
set role authenticated;
-- B never claimed ABOT-PRO-TEST, and A took its one use.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claim.email = 'boss@example.com';
do $$
declare g record;
begin
  select * into g from public.redeem_code('ABOT-PRO-TEST');
  if found then raise exception 'used-up code redeemed again'; end if;
end $$;
-- The throttle counts from here: earlier checks redeemed a few codes as A.
reset role;
delete from public.redeem_attempts;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.email = 'a@example.com';
do $$
declare g record; res record;
begin
  -- Ten tries an hour, then the function refuses.
  for i in 1..12 loop
    begin
      perform public.redeem_code('NOPE-' || i);
    exception when program_limit_exceeded then
      if i <= 10 then raise exception 'throttled too early, at try %', i; end if;
    end;
  end loop;
  begin
    perform public.redeem_code('NOPE-LAST');
    raise exception 'redeem not throttled';
  exception when program_limit_exceeded then null;
  end;
  -- Sync: a batch over 500 rows, a huge record and a long id are refused.
  begin
    perform public.upsert_if_newer((select jsonb_agg(jsonb_build_object('kind', 'session', 'id', 'b' || n, 'payload', '{}'::jsonb, 'updated_at', 1)) from generate_series(1, 501) as s(n)));
    raise exception 'oversized batch accepted';
  exception when program_limit_exceeded then null;
  end;
  begin
    perform public.upsert_if_newer(jsonb_build_array(jsonb_build_object('kind', 'session', 'id', 'big', 'payload', jsonb_build_object('x', repeat('y', 300000)), 'updated_at', 1)));
    raise exception 'huge record accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.upsert_if_newer(jsonb_build_array(jsonb_build_object('kind', 'session', 'id', repeat('i', 101), 'payload', '{}'::jsonb, 'updated_at', 1)));
    raise exception 'long id accepted';
  exception when check_violation then null;
  end;
  -- No one writes their own entitlement row, or reads the admin list.
  begin
    update public.user_entitlements set tier = 'lifetime';
    raise exception 'user updated an entitlement';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.app_admins;
    raise exception 'user read app_admins';
  exception when insufficient_privilege then null;
  end;
end $$;

-- One pending order per account and plan.
reset role;
do $$ begin
  insert into public.payment_orders (order_id, user_id, plan, amount_idr) values ('ABOT-ANNUAL-ONE-AAA', '00000000-0000-0000-0000-00000000000a', 'annual', 1000);
  begin
    insert into public.payment_orders (order_id, user_id, plan, amount_idr) values ('ABOT-ANNUAL-TWO-BBB', '00000000-0000-0000-0000-00000000000a', 'annual', 1000);
    raise exception 'second pending order accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Founder seats hold through payment (audit 2026-11-13). One seat left.
reset role;
update public.app_remote_config set founder_seats = (
  select count(*)::integer + 1 from public.payment_orders where plan = 'founders' and status = 'paid'
) where id = 'global';
-- An older founders order whose 30-minute hold has lapsed, but whose payment page was still open.
insert into public.payment_orders (order_id, user_id, plan, amount_idr, created_at) values
  ('ABOT-LIFETIME-OLD-555', '00000000-0000-0000-0000-00000000000b', 'founders', 399000, now() - interval '31 minutes');
set role service_role;
do $$ begin
  if public.founder_seats_left() <> 1 then raise exception 'a lapsed hold should free its seat'; end if;
  if not public.abot_create_founders_order('ABOT-LIFETIME-NEW-666', '00000000-0000-0000-0000-00000000000c', 399000) then raise exception 'last seat refused'; end if;
  if public.abot_create_founders_order('ABOT-LIFETIME-TWO-777', '00000000-0000-0000-0000-00000000000a', 399000) then raise exception 'a second buyer took the last seat'; end if;
  if exists (select 1 from public.payment_orders where order_id = 'ABOT-LIFETIME-TWO-777') then raise exception 'refused order was inserted'; end if;
  if not public.abot_order_paid('ABOT-LIFETIME-NEW-666', 'qris', 't6') then raise exception 'seat holder not granted'; end if;
  if (select over_cap from public.payment_orders where order_id = 'ABOT-LIFETIME-NEW-666') then raise exception 'in-cap payment flagged'; end if;
  -- The late payment is still granted (the money is taken), and flagged for the owner.
  if not public.abot_order_paid('ABOT-LIFETIME-OLD-555', 'qris', 't5') then raise exception 'late founders payment not granted'; end if;
  if not (select over_cap from public.payment_orders where order_id = 'ABOT-LIFETIME-OLD-555') then raise exception 'over-cap payment not flagged'; end if;
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.email = 'a@example.com';
do $$ begin
  begin
    perform public.abot_create_founders_order('ABOT-LIFETIME-X-888', '00000000-0000-0000-0000-00000000000a', 1);
    raise exception 'client created a founders order';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
\echo 'schema-check: all checks passed'
