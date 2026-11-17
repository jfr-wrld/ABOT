-- ABOT // paid orders outlive the account, and cloud records get a size ceiling (audit 2026-11-17).
-- Safe to run more than once. Apply after 20261118_payments_admin_hardening.sql, then redeploy
-- delete-account (it now asks for a recent sign-in).
--
-- 1. Deleting an account deleted its payment orders (on delete cascade). The paid founders rows
--    are what founder_seats_left() counts, so a deleted founder freed a seat that had been sold,
--    a refund arriving afterwards found no order, and the revenue fell out of the admin totals.
--    The order now stays with user_id set to null: no name, no email, only what was paid and when.
-- 2. A payment that settles after its buyer deleted the account is recorded as paid, with no one
--    to grant to.
-- 3. upsert_if_newer: at most 200 MB of payloads per account (20,000 records of up to 256 KB each
--    allowed about 5 GB), and updated_at must be a plain number no more than a day ahead, so a
--    bad value is refused with a clear code instead of a raw cast error.
-- 4. admin_grant is not callable by anon at all (it refused them, but Supabase's default
--    privileges had granted it).

/* ------------------------------------------------------------- 1. orders stay */

alter table public.payment_orders alter column user_id drop not null;
alter table public.payment_orders drop constraint if exists payment_orders_user_id_fkey;
alter table public.payment_orders
  add constraint payment_orders_user_id_fkey foreign key (user_id) references auth.users on delete set null;

/* ------------------------------------------------------------- 2. settle without a buyer */

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
  -- The buyer deleted the account while paying: the money is recorded, there is no one to grant to.
  if o.user_id is null then return true; end if;
  if o.plan = 'annual' then
    perform public.abot_apply_grant(o.user_id, 'pro', 365, false, 'midtrans:' || o.order_id);
  else
    perform public.abot_apply_grant(o.user_id, 'lifetime', null, false, 'midtrans:' || o.order_id);
  end if;
  return true;
end;
$$;
revoke execute on function public.abot_order_paid(text, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.abot_order_paid(text, text, text) to service_role;
  end if;
end $$;

/* ------------------------------------------------------------- 3. record ceiling */

create or replace function public.upsert_if_newer(rows jsonb)
returns table (accepted text[], rejected text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  acc text[] := '{}';
  rej text[] := '{}';
  n int;
  have int;
  bytes bigint;
  size int;
  ts bigint;
  ahead constant bigint := (extract(epoch from now()) * 1000)::bigint + 86400000;
  ceiling constant bigint := 209715200; -- 200 MB of payloads per account
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 500 then
    raise exception 'at most 500 records per batch' using errcode = '54000';
  end if;
  select count(*), coalesce(sum(pg_column_size(payload)), 0) into have, bytes
    from public.abot_records where user_id = auth.uid();
  for r in select * from jsonb_array_elements(rows)
  loop
    if coalesce(r->>'updated_at', '') !~ '^[0-9]{1,15}$' then
      raise exception 'updated_at must be a time in milliseconds' using errcode = '22023';
    end if;
    ts := (r->>'updated_at')::bigint;
    size := coalesce(pg_column_size(r->'payload'), 0);
    if ts > ahead
      or (have >= 20000 and not exists (
        select 1 from public.abot_records where user_id = auth.uid() and kind = r->>'kind' and id = r->>'id'
      ))
      -- Deletes always go through: they are how an account gets back under the ceiling.
      or (not coalesce((r->>'deleted')::boolean, false) and bytes + size > ceiling)
    then
      rej := rej || ((r->>'kind') || ':' || (r->>'id'));
      continue;
    end if;
    insert into public.abot_records as t (user_id, kind, id, payload, updated_at, deleted)
    values (auth.uid(), r->>'kind', r->>'id', r->'payload', ts, coalesce((r->>'deleted')::boolean, false))
    on conflict (user_id, kind, id) do update
      set payload = excluded.payload,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted
      where t.updated_at < excluded.updated_at;
    get diagnostics n = row_count;
    if n > 0 then
      acc := acc || ((r->>'kind') || ':' || (r->>'id'));
      have := have + 1;
      bytes := bytes + size;
    else
      rej := rej || ((r->>'kind') || ':' || (r->>'id'));
    end if;
  end loop;
  return query select acc, rej;
end;
$$;
revoke all on function public.upsert_if_newer(jsonb) from public, anon;
grant execute on function public.upsert_if_newer(jsonb) to authenticated;

/* ------------------------------------------------------------- 4. grants */

revoke all on function public.admin_grant(text, text, integer) from anon;
