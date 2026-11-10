-- ABOT // security hardening from the audit of 2026-11-11. Safe to run more than once.
-- Apply after 20261112_payment_test_tools.sql (supabase db push), then redeploy both Edge
-- Functions (midtrans-checkout, midtrans-notify).

/* ----------------------------------------------------------------- redeem */

-- Codes are redeemed by signed-in accounts only, at most 10 tries an hour. Signed out, a call
-- spent a use and recorded nothing, so one person could drain a shared code and stack the grant
-- on a device; with no limit the function also answered "does this code exist" as fast as asked.
create table if not exists public.redeem_attempts (
  user_id uuid not null references auth.users on delete cascade,
  at timestamptz not null default now()
);
create index if not exists redeem_attempts_user_at on public.redeem_attempts (user_id, at desc);
alter table public.redeem_attempts enable row level security;
revoke all on public.redeem_attempts from anon, authenticated;

create or replace function public.redeem_code(p_code text)
returns table (grant_tier text, duration_days integer, grants_founder_badge boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.redeem_codes%rowtype;
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if (select count(*) from public.redeem_attempts where user_id = me and at > now() - interval '1 hour') >= 10 then
    raise exception 'too many attempts, try again later' using errcode = '54000';
  end if;
  insert into public.redeem_attempts (user_id) values (me);
  delete from public.redeem_attempts where user_id = me and at < now() - interval '1 day';

  select * into c from public.redeem_codes where code = upper(trim(p_code)) for update;
  if not found or not c.is_active then return; end if;
  if not exists (select 1 from public.redeem_claims rc where rc.code = c.code and rc.user_id = me) then
    if c.current_uses >= c.max_uses then return; end if;
    update public.redeem_codes set current_uses = current_uses + 1 where code = c.code;
    insert into public.redeem_claims (code, user_id) values (c.code, me);
    perform public.abot_apply_grant(me, c.grant_tier, c.duration_days, c.grants_founder_badge, 'code:' || c.code);
  end if;
  return query select c.grant_tier, c.duration_days, c.grants_founder_badge;
end;
$$;
revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

/* ----------------------------------------------------------------- orders */

-- One pending order per account and plan. Checkout reuses it (its payment page) for 30 minutes,
-- then closes it and makes a new one; a script can no longer pile up orders or hold every
-- founder seat.
alter table public.payment_orders add column if not exists redirect_url text;
create unique index if not exists payment_orders_one_pending
  on public.payment_orders (user_id, plan) where status = 'pending';

-- A pending founder order holds its seat for 30 minutes, not 24 hours.
create or replace function public.founder_seats_left()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    (select founder_seats from public.app_remote_config where id = 'global')
    - (select count(*)::integer from public.payment_orders
       where plan = 'founders' and (status = 'paid' or (status = 'pending' and created_at > now() - interval '30 minutes')))
  )
$$;
revoke all on function public.founder_seats_left() from public;
grant execute on function public.founder_seats_left() to anon, authenticated;

-- A refunded lifetime order takes lifetime away only when nothing else gave it: another paid
-- lifetime order, or a lifetime code the account redeemed.
create or replace function public.abot_order_reversed(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.payment_orders%rowtype;
  e public.user_entitlements%rowtype;
  left_until timestamptz;
  other_lifetime boolean;
begin
  select * into o from public.payment_orders where order_id = p_order_id for update;
  if not found or o.status <> 'paid' then return false; end if;
  update public.payment_orders set status = 'refunded' where order_id = p_order_id;
  select * into e from public.user_entitlements where user_id = o.user_id for update;
  if not found then return true; end if;
  if o.plan = 'annual' then
    if e.tier = 'lifetime' then return true; end if;
    left_until := e.pro_expires_at - interval '365 days';
    update public.user_entitlements
      set tier = case when left_until > now() then 'pro' else 'free' end,
          pro_expires_at = case when left_until > now() then left_until end,
          source = 'midtrans-refund:' || o.order_id
      where user_id = o.user_id;
  else
    other_lifetime :=
      exists (select 1 from public.payment_orders p
              where p.user_id = o.user_id and p.order_id <> o.order_id and p.status = 'paid' and p.plan in ('lifetime', 'founders'))
      or exists (select 1 from public.redeem_claims rc join public.redeem_codes rcode on rcode.code = rc.code
                 where rc.user_id = o.user_id and rcode.grant_tier = 'lifetime');
    if other_lifetime then return true; end if;
    update public.user_entitlements
      set tier = case when pro_expires_at > now() then 'pro' else 'free' end,
          source = 'midtrans-refund:' || o.order_id
      where user_id = o.user_id;
  end if;
  return true;
end;
$$;
revoke execute on function public.abot_order_reversed(text) from public, anon, authenticated;

/* ----------------------------------------------------------------- founder */

-- The server numbers founder passes: a client could claim any "#NNNN" (a vanity #0001, or a
-- copy of someone else's). The argument is kept so older apps keep working; it is not used.
create sequence if not exists public.founder_unit_seq;
create or replace function public.claim_founder(p_unit_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if (select monetization_mode from public.app_remote_config where id = 'global') <> 'FOUNDERS_BETA' then return; end if;
  if exists (select 1 from public.user_entitlements where user_id = auth.uid() and founder_unit_code is not null) then return; end if;
  insert into public.user_entitlements as e (user_id, is_founder, founder_unit_code, source)
  values (auth.uid(), true, 'FOUNDER // #' || lpad(((nextval('public.founder_unit_seq') - 1) % 9999 + 1)::text, 4, '0'), 'founders-beta')
  on conflict (user_id) do update set
    is_founder = true,
    founder_unit_code = coalesce(e.founder_unit_code, excluded.founder_unit_code);
end;
$$;
revoke all on function public.claim_founder(text) from public, anon;
grant execute on function public.claim_founder(text) to authenticated;

/* ------------------------------------------------------------- cloud sync */

-- No account can fill the database: a record is at most 256 KB with an id of at most 100
-- characters (checked on new writes; rows already there are left alone), a batch at most 500
-- rows, and an account at most 20,000 records.
alter table public.abot_records drop constraint if exists abot_records_payload_size;
alter table public.abot_records add constraint abot_records_payload_size check (pg_column_size(payload) < 262144) not valid;
alter table public.abot_records drop constraint if exists abot_records_id_length;
alter table public.abot_records add constraint abot_records_id_length check (length(id) <= 100) not valid;

create or replace function public.upsert_if_newer(rows jsonb)
returns table (accepted text[], rejected text[])
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
  acc text[] := '{}';
  rej text[] := '{}';
  n int;
  have int;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 500 then
    raise exception 'at most 500 records per batch' using errcode = '54000';
  end if;
  select count(*) into have from public.abot_records where user_id = auth.uid();
  for r in select * from jsonb_array_elements(rows)
  loop
    if have >= 20000 and not exists (
      select 1 from public.abot_records where user_id = auth.uid() and kind = r->>'kind' and id = r->>'id'
    ) then
      rej := rej || ((r->>'kind') || ':' || (r->>'id'));
      continue;
    end if;
    insert into public.abot_records as t (user_id, kind, id, payload, updated_at, deleted)
    values (
      auth.uid(),
      r->>'kind',
      r->>'id',
      r->'payload',
      (r->>'updated_at')::bigint,
      coalesce((r->>'deleted')::boolean, false)
    )
    on conflict (user_id, kind, id) do update
      set payload = excluded.payload,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted
      where t.updated_at < excluded.updated_at;
    get diagnostics n = row_count;
    if n > 0 then
      acc := acc || ((r->>'kind') || ':' || (r->>'id'));
      have := have + 1;
    else
      rej := rej || ((r->>'kind') || ':' || (r->>'id'));
    end if;
  end loop;
  return query select acc, rej;
end;
$$;
revoke all on function public.upsert_if_newer(jsonb) from public, anon;
grant execute on function public.upsert_if_newer(jsonb) to authenticated;

/* ----------------------------------------------------------------- grants */

-- Writes these tables do not need from the app, revoked outright instead of left to "no RLS
-- policy allows it". Admin writes to redeem_codes and app_remote_config stay (their policies
-- check is_abot_admin()).
revoke insert, update, delete on public.user_entitlements from anon, authenticated;
revoke insert, update, delete on public.redeem_claims from anon, authenticated;
revoke all on public.app_admins from anon, authenticated;
revoke all on public.redeem_codes from anon;
revoke insert, update, delete on public.app_remote_config from anon;
revoke insert, delete on public.app_remote_config from authenticated;
revoke all on public.abot_records from anon;

-- The two trigger functions get a fixed search_path too (Supabase's linter flags them).
alter function public.abot_touch_server_updated_at() set search_path = pg_catalog, public;
alter function public.abot_touch_updated_at() set search_path = pg_catalog, public;

-- New projects start with simulated payments off. An existing project keeps its value: set it
-- to false when going live (update public.app_remote_config set payments_sandbox = false).
alter table public.app_remote_config alter column payments_sandbox set default false;
