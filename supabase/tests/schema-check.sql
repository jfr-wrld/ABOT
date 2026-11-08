-- Checks supabase/migrations/*.sql on a plain local Postgres (no Supabase needed).
-- Run: scripts/check-supabase-schema.sh. Any failed check raises and stops psql.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Minimal stand-in for what Supabase provides: the auth schema, auth.uid() and the API role.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
grant usage on schema auth, public to authenticated;

\i supabase/migrations/0001_abot_records.sql
\i supabase/migrations/0002_bodyweight_and_media.sql
-- Applying it twice must work: the file is meant to be rerun safely.
\i supabase/migrations/0001_abot_records.sql
\i supabase/migrations/0002_bodyweight_and_media.sql

grant select, insert, update, delete on public.abot_records to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

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

reset role;
\echo 'schema-check: all checks passed'
