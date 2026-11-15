-- ABOT // Mission Control growth numbers (2026-11-15). Safe to run more than once.
-- Apply after 20261114_founder_seat_lock.sql (supabase db push).
--
-- One row per day (Asia/Jakarta), oldest first, for the last p_days days including today:
--   signups  accounts created that day (auth.users.created_at)
--   active   accounts whose phone synced anything that day (abot_records.server_updated_at)
-- Counts only, no emails or ids. Admins only, like admin_stats().

create or replace function public.admin_growth(p_days integer default 30)
returns table (day date, signups bigint, active bigint)
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
  with days as (
    select generate_series(today - (n - 1), today, interval '1 day')::date as d
  ),
  s as (
    select (u.created_at at time zone 'Asia/Jakarta')::date as d, count(*) as c
    from auth.users u
    where u.created_at >= ((today - (n - 1))::timestamp at time zone 'Asia/Jakarta')
    group by 1
  ),
  a as (
    select (r.server_updated_at at time zone 'Asia/Jakarta')::date as d, count(distinct r.user_id) as c
    from public.abot_records r
    where r.server_updated_at >= ((today - (n - 1))::timestamp at time zone 'Asia/Jakarta')
    group by 1
  )
  select days.d, coalesce(s.c, 0)::bigint, coalesce(a.c, 0)::bigint
  from days
  left join s on s.d = days.d
  left join a on a.d = days.d
  order by days.d;
end;
$$;
revoke all on function public.admin_growth(integer) from public, anon;
grant execute on function public.admin_growth(integer) to authenticated;
