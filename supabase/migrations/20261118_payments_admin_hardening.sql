-- ABOT // payments and admin hardening (security review 2026-11-16). Safe to run more than once.
-- Apply after 20261117_records_writes_through_rpc.sql, then redeploy midtrans-checkout (it maps
-- the new "seats_held" refusal; an older deploy reports it as a gateway error instead).
--
-- 1. The payment simulator settles only test orders. Each order records whether sandbox was on
--    when it was made; admin_simulate_payment refuses any other, so a real order can never be
--    marked paid from Mission Control, even by a hijacked admin session.
-- 2. Unpaid founders orders hold at most a fifth of the seats still unsold at once (at least one),
--    so a handful of accounts cannot block the founder sale with 30-minute holds.
-- 3. An admin must also have signed in with Google. With the Email provider on and email
--    confirmation off, an account registered with the admin's address was auto-confirmed and
--    counted as the admin.
-- 4. A refunded lifetime order no longer takes away a lifetime an admin granted by hand.
-- 5. track_visit stops counting at 1,000,000 per day and page: no integer overflow, and a ceiling
--    on how far anyone holding the public key can inflate the numbers (they stay indicative).

/* ------------------------------------------------------------- 1. test orders only */

alter table public.payment_orders add column if not exists sandbox boolean not null default false;

create or replace function public.abot_mark_sandbox_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.sandbox := coalesce((select payments_sandbox from public.app_remote_config where id = 'global'), false);
  return new;
end;
$$;
revoke all on function public.abot_mark_sandbox_order() from public, anon, authenticated;
drop trigger if exists abot_mark_sandbox_order on public.payment_orders;
create trigger abot_mark_sandbox_order before insert on public.payment_orders
  for each row execute function public.abot_mark_sandbox_order();

create or replace function public.admin_simulate_payment(p_order_id text, p_outcome text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare done boolean;
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if not (select payments_sandbox from public.app_remote_config where id = 'global') then
    raise exception 'test payments are off (payments_sandbox = false)' using errcode = '42501';
  end if;
  if not coalesce((select sandbox from public.payment_orders where order_id = p_order_id), false) then
    raise exception 'only test orders (made while payments_sandbox was on) can be simulated' using errcode = '42501';
  end if;
  if p_outcome = 'paid' then
    done := public.abot_order_paid(p_order_id, 'simulated', 'sim-' || p_order_id);
  elsif p_outcome = 'refunded' then
    done := public.abot_order_reversed(p_order_id);
  elsif p_outcome in ('failed', 'expired') then
    done := public.abot_order_closed(p_order_id, p_outcome);
  else
    raise exception 'bad outcome' using errcode = '22023';
  end if;
  if done then
    insert into public.payment_events (order_id, transaction_status, transaction_id, payload)
    values (
      p_order_id,
      'simulated_' || p_outcome,
      'sim-' || extract(epoch from clock_timestamp())::text,
      jsonb_build_object('simulated', true, 'outcome', p_outcome, 'by', auth.jwt() ->> 'email')
    );
  end if;
  return done;
end;
$$;
revoke all on function public.admin_simulate_payment(text, text) from public, anon;
grant execute on function public.admin_simulate_payment(text, text) to authenticated;

/* ------------------------------------------------------------- 2. seat hold cap */

create or replace function public.abot_create_founders_order(p_order_id text, p_user_id uuid, p_amount_idr integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  held integer;
  free integer;
begin
  perform pg_advisory_xact_lock(hashtext('abot.founder_seats'));
  free := public.founder_seats_left();
  if free <= 0 then return false; end if;
  held := (select count(*)::integer from public.payment_orders
           where plan = 'founders' and status = 'pending' and created_at > now() - interval '30 minutes');
  -- Unpaid holds may take a fifth of the seats not yet sold (held + free), and always one.
  if held >= greatest(1, floor(0.2 * (held + free))::integer) then
    raise exception 'seats_held' using errcode = '55P03';
  end if;
  insert into public.payment_orders (order_id, user_id, plan, amount_idr) values (p_order_id, p_user_id, 'founders', p_amount_idr);
  return true;
end;
$$;
revoke all on function public.abot_create_founders_order(text, uuid, integer) from public, anon, authenticated;

/* ------------------------------------------------------------- 3. admin needs Google */

create or replace function public.is_abot_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.app_admins a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      -- ABOT signs in with Google only; an Email-provider account with the same address is not the admin.
      and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
  )
$$;

/* ------------------------------------------------------------- 4. refunds keep admin lifetime */

alter table public.user_entitlements add column if not exists admin_lifetime boolean not null default false;
update public.user_entitlements set admin_lifetime = true where source = 'admin' and tier = 'lifetime' and not admin_lifetime;

create or replace function public.admin_grant(p_email text, p_tier text, p_days integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_tier not in ('pro', 'lifetime') then raise exception 'bad tier' using errcode = '22023'; end if;
  if p_tier = 'pro' and (p_days is null or p_days <= 0) then raise exception 'pro needs days' using errcode = '22023'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return false; end if;
  perform public.abot_apply_grant(uid, p_tier, case when p_tier = 'pro' then p_days end, false, 'admin');
  -- Remembered apart from `source`, which a later purchase overwrites: a refund of that purchase
  -- must not take this lifetime away.
  if p_tier = 'lifetime' then
    update public.user_entitlements set admin_lifetime = true where user_id = uid;
  end if;
  return true;
end;
$$;
revoke all on function public.admin_grant(text, text, integer) from public;
grant execute on function public.admin_grant(text, text, integer) to authenticated;

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
      e.admin_lifetime
      or exists (select 1 from public.payment_orders p
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

/* ------------------------------------------------------------- 5. visit counter ceiling */

create or replace function public.track_visit(p_path text, p_first_today boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  seg text := lower(split_part(split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1), '/', 2));
  page text;
  top constant integer := 1000000;
begin
  if seg = 'admin' then return; end if;
  page := case
    when seg = '' then '/'
    when seg in ('workout', 'progress', 'history', 'exercises', 'routines', 'phase', 'plan', 'profile',
                 'settings', 'onboarding', 'login', 'privacy', 'terms', 'permissions') then '/' || seg
    else 'other'
  end;
  insert into public.web_visits as w (day, path, visitors, views)
  values ((now() at time zone 'Asia/Jakarta')::date, page, case when p_first_today then 1 else 0 end, 1)
  on conflict (day, path) do update
    set views = least(top, w.views + 1),
        visitors = least(least(top, w.views + 1), w.visitors + case when p_first_today then 1 else 0 end);
end;
$$;
revoke all on function public.track_visit(text, boolean) from public;
grant execute on function public.track_visit(text, boolean) to anon, authenticated;
