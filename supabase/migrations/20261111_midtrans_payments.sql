-- ABOT // payments through Midtrans (Snap: QRIS, e-wallets, virtual accounts, cards).
-- Safe to run more than once. Apply after 20261109_admin_and_redeem.sql and 20261110_lock_down_grants.sql.
--
-- Flow:
--   1. The app (signed in) calls the Edge Function midtrans-checkout with a plan. The function reads
--      the price here, inserts a pending order and asks Midtrans for a Snap payment page.
--   2. Midtrans calls the Edge Function midtrans-notify. It checks the signature, re-reads the
--      status from Midtrans, logs the event and calls abot_order_paid() or abot_order_reversed().
--   3. Those write user_entitlements, which the app already reads (entitlement-sync.ts), so a paid
--      order unlocks PRO and a refund or chargeback takes it away again.
--
-- Who can do what:
--   signed-in user   read their own orders; read founder_seats_left()
--   anyone           read founder_seats_left()
--   service role     everything else (the two Edge Functions); no client can mark an order paid.

/* ------------------------------------------------------------ remote config */

-- Payments on/off without a new build, and the founder price's seat cap.
alter table public.app_remote_config add column if not exists checkout_enabled boolean not null default false;
alter table public.app_remote_config add column if not exists checkout_on_android boolean not null default true;
alter table public.app_remote_config add column if not exists founder_seats integer not null default 500;
alter table public.app_remote_config drop constraint if exists app_remote_config_founder_seats_check;
alter table public.app_remote_config add constraint app_remote_config_founder_seats_check check (founder_seats >= 0);

/* ------------------------------------------------------------------ orders */

create table if not exists public.payment_orders (
  -- ABOT-<plan>-<base36 time>-<random>, at most 50 characters (Midtrans' limit).
  order_id text primary key check (order_id ~ '^ABOT-[A-Z]+-[A-Z0-9]+-[A-Z0-9]+$' and length(order_id) <= 50),
  user_id uuid not null references auth.users on delete cascade,
  plan text not null check (plan in ('annual', 'lifetime', 'founders')),
  amount_idr integer not null check (amount_idr > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  payment_type text,
  midtrans_transaction_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists payment_orders_user on public.payment_orders (user_id, created_at desc);

alter table public.payment_orders enable row level security;
drop policy if exists "payment_orders_own_read" on public.payment_orders;
create policy "payment_orders_own_read" on public.payment_orders
  for select to authenticated using (user_id = auth.uid() or public.is_abot_admin());
revoke all on public.payment_orders from anon, authenticated;
grant select on public.payment_orders to authenticated;

drop trigger if exists payment_orders_touch on public.payment_orders;
create trigger payment_orders_touch before update on public.payment_orders
  for each row execute function public.abot_touch_updated_at();

-- Every notification Midtrans sends, as received. Midtrans retries, so the same status for the
-- same transaction is stored once; a new status is a new row.
create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  order_id text not null,
  transaction_status text not null,
  transaction_id text not null default '',
  fraud_status text,
  gross_amount text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (order_id, transaction_id, transaction_status)
);
alter table public.payment_events enable row level security;
drop policy if exists "payment_events_admin_read" on public.payment_events;
create policy "payment_events_admin_read" on public.payment_events
  for select to authenticated using (public.is_abot_admin());
revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;

/* ----------------------------------------------------------- founder seats */

-- Founder-price lifetime licences left to sell: the cap minus paid or still-pending founder orders
-- (pending ones hold a seat for 24 hours so two buyers cannot take the last one).
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
       where plan = 'founders' and (status = 'paid' or (status = 'pending' and created_at > now() - interval '24 hours')))
  )
$$;
revoke all on function public.founder_seats_left() from public;
grant execute on function public.founder_seats_left() to anon, authenticated;

/* ------------------------------------------------------------ grant, revoke */

-- A settled payment. Idempotent: an order is granted once, however often Midtrans repeats itself.
-- Returns true when this call granted it.
create or replace function public.abot_order_paid(p_order_id text, p_payment_type text, p_transaction_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare o public.payment_orders%rowtype;
begin
  select * into o from public.payment_orders where order_id = p_order_id for update;
  if not found or o.status = 'paid' or o.status = 'refunded' then return false; end if;
  update public.payment_orders
    set status = 'paid', paid_at = now(), payment_type = p_payment_type, midtrans_transaction_id = p_transaction_id
    where order_id = p_order_id;
  if o.plan = 'annual' then
    perform public.abot_apply_grant(o.user_id, 'pro', 365, false, 'midtrans:' || o.order_id);
  else
    perform public.abot_apply_grant(o.user_id, 'lifetime', null, false, 'midtrans:' || o.order_id);
  end if;
  return true;
end;
$$;

-- A refund or chargeback of a paid order: the year comes off pro time, a lifetime licence goes
-- back to whatever pro time is left (none after a lifetime grant, so free). Idempotent.
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
    update public.user_entitlements
      set tier = case when pro_expires_at > now() then 'pro' else 'free' end,
          source = 'midtrans-refund:' || o.order_id
      where user_id = o.user_id;
  end if;
  return true;
end;
$$;

-- A pending order that will never be paid (denied, cancelled, expired, failed).
create or replace function public.abot_order_closed(p_order_id text, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('failed', 'expired') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.payment_orders set status = p_status where order_id = p_order_id and status = 'pending';
  return found;
end;
$$;

-- Only the Edge Functions (service role) call these. A Supabase project grants execute on new
-- public functions to anon and authenticated, so take it away explicitly.
revoke execute on function public.abot_order_paid(text, text, text) from public, anon, authenticated;
revoke execute on function public.abot_order_reversed(text) from public, anon, authenticated;
revoke execute on function public.abot_order_closed(text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.abot_order_paid(text, text, text) to service_role;
    grant execute on function public.abot_order_reversed(text) to service_role;
    grant execute on function public.abot_order_closed(text, text) to service_role;
    grant execute on function public.founder_seats_left() to service_role;
    grant select, insert, update on public.payment_orders to service_role;
    grant select, insert on public.payment_events to service_role;
  end if;
end $$;
