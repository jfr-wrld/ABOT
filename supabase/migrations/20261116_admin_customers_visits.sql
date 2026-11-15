-- ABOT // Mission Control: customers and ABOT's own web visit counter (2026-11-16). Safe to run
-- more than once. Apply after 20261115_admin_growth.sql (SQL editor or supabase db push).
--
-- web_visits holds totals only: per Jakarta day and page, how many browsers landed there first that
-- day (visitors) and how many page views. Nothing identifies a visitor. Only the functions below
-- touch the table: track_visit() for the web app, admin_visits() and admin_visit_paths() for admins.
-- admin_customers() and admin_order_totals() list who paid and what PRO they hold, admins only.
-- Orders settled by the admin's own test buttons are left out everywhere: a simulated payment sets
-- payment_type 'simulated', and every simulated outcome (paid, failed, expired, refunded) logs a
-- payment_events row whose status starts with 'simulated_'.

create table if not exists public.web_visits (
  day date not null,
  path text not null,
  visitors integer not null default 0,
  views integer not null default 0,
  primary key (day, path)
);
alter table public.web_visits enable row level security;
revoke all on public.web_visits from public, anon, authenticated;

-- Called by the web app on each page view. Only the app's own top-level pages are stored by name;
-- anything else becomes 'other', so made-up paths cannot grow the table. /admin is never counted.
create or replace function public.track_visit(p_path text, p_first_today boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  seg text := lower(split_part(split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1), '/', 2));
  page text;
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
    set views = w.views + 1,
        visitors = w.visitors + case when p_first_today then 1 else 0 end;
end;
$$;
revoke all on function public.track_visit(text, boolean) from public;
grant execute on function public.track_visit(text, boolean) to anon, authenticated;

-- One row per day, oldest first, zero-filled, for the last p_days days including today.
create or replace function public.admin_visits(p_days integer default 30)
returns table (day date, visitors bigint, views bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := least(greatest(coalesce(p_days, 30), 1), 180);
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select d::date, coalesce(sum(w.visitors), 0)::bigint, coalesce(sum(w.views), 0)::bigint
  from generate_series(today - (n - 1), today, interval '1 day') as d
  left join public.web_visits w on w.day = d::date
  group by d
  order by d;
end;
$$;
revoke all on function public.admin_visits(integer) from public, anon;
grant execute on function public.admin_visits(integer) to authenticated;

-- The ten most viewed pages over the same range.
create or replace function public.admin_visit_paths(p_days integer default 30)
returns table (path text, visitors bigint, views bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := least(greatest(coalesce(p_days, 30), 1), 180);
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select w.path, sum(w.visitors)::bigint, sum(w.views)::bigint
  from public.web_visits w
  where w.day >= today - (n - 1)
  group by w.path
  order by sum(w.views) desc, w.path
  limit 10;
end;
$$;
revoke all on function public.admin_visit_paths(integer) from public, anon;
grant execute on function public.admin_visit_paths(integer) to authenticated;

-- Everyone who holds or held paid access: a non-free tier, a founder flag, or any real order.
-- last_* is their latest paid order, or their latest order of any status when they never paid.
-- founder_seat: a paid founders order's rank among all paid founders orders, by payment time
-- (the payment flow grants founders buyers lifetime without a founder_unit_code).
create or replace function public.admin_customers()
returns table (
  user_id uuid, email text, tier text, pro_expires_at timestamptz, is_founder boolean,
  founder_unit_code text, source text, paid_orders bigint, paid_total_idr bigint,
  last_plan text, last_status text, last_amount_idr integer, last_payment_type text,
  last_at timestamptz, founder_seat integer, over_cap boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  with real_orders as (
    select o.* from public.payment_orders o
    where coalesce(o.payment_type, '') <> 'simulated'
      and not exists (select 1 from public.payment_events ev where ev.order_id = o.order_id and ev.transaction_status like 'simulated\_%')
  ),
  seats as (
    select o.order_id, row_number() over (order by o.paid_at, o.order_id)::integer as seat
    from real_orders o where o.plan = 'founders' and o.status = 'paid'
  ),
  paid as (
    select o.user_id, count(*) as n, sum(o.amount_idr)::bigint as total
    from real_orders o where o.status = 'paid' group by o.user_id
  ),
  latest as (
    select distinct on (o.user_id) o.*
    from real_orders o
    order by o.user_id, (o.status = 'paid') desc, coalesce(o.paid_at, o.created_at) desc
  ),
  people as (
    select e.user_id from public.user_entitlements e where e.tier <> 'free' or e.is_founder
    union
    select o.user_id from real_orders o
  )
  select p.user_id, u.email::text, coalesce(e.tier, 'free'), e.pro_expires_at, coalesce(e.is_founder, false),
         e.founder_unit_code, e.source, coalesce(pd.n, 0)::bigint, coalesce(pd.total, 0)::bigint,
         l.plan, l.status, l.amount_idr, l.payment_type, coalesce(l.paid_at, l.created_at),
         s.seat, coalesce(l.over_cap, false)
  from people p
  join auth.users u on u.id = p.user_id
  left join public.user_entitlements e on e.user_id = p.user_id
  left join paid pd on pd.user_id = p.user_id
  left join latest l on l.user_id = p.user_id
  left join seats s on s.order_id = l.order_id
  order by coalesce(l.paid_at, l.created_at, e.updated_at) desc nulls last;
end;
$$;
revoke all on function public.admin_customers() from public, anon;
grant execute on function public.admin_customers() to authenticated;

-- Revenue and order counts, real orders only. failed counts failed and expired checkouts.
create or replace function public.admin_order_totals()
returns table (revenue_idr bigint, paid bigint, pending bigint, failed bigint, refunded bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select coalesce(sum(o.amount_idr) filter (where o.status = 'paid'), 0)::bigint,
         count(*) filter (where o.status = 'paid'),
         count(*) filter (where o.status = 'pending'),
         count(*) filter (where o.status in ('failed', 'expired')),
         count(*) filter (where o.status = 'refunded')
  from public.payment_orders o
  where coalesce(o.payment_type, '') <> 'simulated'
    and not exists (select 1 from public.payment_events ev where ev.order_id = o.order_id and ev.transaction_status like 'simulated\_%');
end;
$$;
revoke all on function public.admin_order_totals() from public, anon;
grant execute on function public.admin_order_totals() to authenticated;
