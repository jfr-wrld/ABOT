-- ABOT // founder seats hold through payment (audit 2026-11-13). Safe to run more than once.
-- Apply after 20261113_security_hardening.sql (supabase db push), then redeploy midtrans-checkout.
--
-- Before: checkout checked founder_seats_left() and inserted the order in two steps, so two buyers
-- could both take the last seat; and a payment page that outlived the 30-minute hold still granted
-- after the seat had gone to someone else. Now the check and the insert run under one lock, the
-- payment page closes after 30 minutes (midtrans-checkout), and a founders payment that still lands
-- past the cap is granted (the money is taken) but flagged for the owner to review or refund.

alter table public.payment_orders add column if not exists over_cap boolean not null default false;

-- A founders order, created only while a seat is left. The advisory lock serialises every founders
-- checkout and settlement, so the count and the insert cannot interleave.
create or replace function public.abot_create_founders_order(p_order_id text, p_user_id uuid, p_amount_idr integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('abot.founder_seats'));
  if public.founder_seats_left() <= 0 then return false; end if;
  insert into public.payment_orders (order_id, user_id, plan, amount_idr) values (p_order_id, p_user_id, 'founders', p_amount_idr);
  return true;
end;
$$;
revoke all on function public.abot_create_founders_order(text, uuid, integer) from public, anon, authenticated;

-- A settled payment, as before, plus: a founders order paid when the paid founders orders already
-- fill the cap is marked over_cap. Idempotent.
create or replace function public.abot_order_paid(p_order_id text, p_payment_type text, p_transaction_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.payment_orders%rowtype;
  cap integer;
  paid integer := 0;
begin
  select * into o from public.payment_orders where order_id = p_order_id for update;
  if not found or o.status = 'paid' or o.status = 'refunded' then return false; end if;
  if o.plan = 'founders' then
    perform pg_advisory_xact_lock(hashtext('abot.founder_seats'));
    select founder_seats into cap from public.app_remote_config where id = 'global';
    select count(*)::integer into paid from public.payment_orders where plan = 'founders' and status = 'paid';
  end if;
  update public.payment_orders
    set status = 'paid', paid_at = now(), payment_type = p_payment_type, midtrans_transaction_id = p_transaction_id,
        over_cap = (o.plan = 'founders' and paid >= coalesce(cap, 0))
    where order_id = p_order_id;
  if o.plan = 'annual' then
    perform public.abot_apply_grant(o.user_id, 'pro', 365, false, 'midtrans:' || o.order_id);
  else
    perform public.abot_apply_grant(o.user_id, 'lifetime', null, false, 'midtrans:' || o.order_id);
  end if;
  return true;
end;
$$;
revoke execute on function public.abot_order_paid(text, text, text) from public, anon, authenticated;

-- Only the Edge Functions (service role) call these.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.abot_create_founders_order(text, uuid, integer) to service_role;
    grant execute on function public.abot_order_paid(text, text, text) to service_role;
  end if;
end $$;
