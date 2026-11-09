-- ABOT // MISSION CONTROL: remote config, redeem codes and entitlements (Priority 12).
-- Optional, like the rest of the cloud schema: the app falls back to its built-in defaults.
-- Safe to run more than once. Apply in the Supabase SQL editor or with `supabase db push`.
--
-- Who can do what:
--   anyone (anon key)  read app_remote_config; call redeem_code()
--   signed-in user     read their own user_entitlements row; claim_founder()
--   admin              everything above, plus write config and codes, admin_grant(), admin_stats()
-- An admin is a signed-in user whose Google email is in app_admins. Add yours once, in the SQL
-- editor (it runs as the owner, so RLS does not apply there):
--   insert into public.app_admins (email) values ('you@example.com');
-- The PIN on the /admin page only hides the page; these policies are what protect the data.

/* ------------------------------------------------------------------ admins */

create table if not exists public.app_admins (
  email text primary key check (email = lower(email))
);
alter table public.app_admins enable row level security;
-- No policies: nobody reads or writes it through the API.

create or replace function public.is_abot_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

/* ------------------------------------------------------------- remote config */

create table if not exists public.app_remote_config (
  id text primary key default 'global' check (id = 'global'),
  monetization_mode text not null default 'FOUNDERS_BETA' check (monetization_mode in ('FOUNDERS_BETA', 'COMMERCIAL_LIVE')),
  monthly_price_idr integer not null default 29000 check (monthly_price_idr > 0),
  annual_price_idr integer not null default 199000 check (annual_price_idr > 0),
  -- The full lifetime price; founders pay half (399000 at the default).
  lifetime_price_idr integer not null default 798000 check (lifetime_price_idr > 0),
  monthly_price_usd numeric(8, 2) not null default 2.99 check (monthly_price_usd > 0),
  annual_price_usd numeric(8, 2) not null default 19.99 check (annual_price_usd > 0),
  lifetime_price_usd numeric(8, 2) not null default 79.98 check (lifetime_price_usd > 0),
  announcement_banner text check (announcement_banner is null or length(announcement_banner) <= 280),
  -- Built-in offline codes (ABOT-FOUNDER-2026 and friends) are in every copy of the app; this
  -- turns them off for everyone once they are no longer wanted.
  offline_codes_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.app_remote_config (id) values ('global') on conflict (id) do nothing;

alter table public.app_remote_config enable row level security;

drop policy if exists "remote_config_read" on public.app_remote_config;
create policy "remote_config_read" on public.app_remote_config
  for select to anon, authenticated using (true);

drop policy if exists "remote_config_admin_write" on public.app_remote_config;
create policy "remote_config_admin_write" on public.app_remote_config
  for update to authenticated using (public.is_abot_admin()) with check (public.is_abot_admin());

create or replace function public.abot_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_remote_config_touch on public.app_remote_config;
create trigger app_remote_config_touch before update on public.app_remote_config
  for each row execute function public.abot_touch_updated_at();

grant select on public.app_remote_config to anon, authenticated;
grant update on public.app_remote_config to authenticated;

/* -------------------------------------------------------------- redeem codes */

create table if not exists public.redeem_codes (
  code text primary key check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and length(code) between 6 and 40),
  grant_tier text not null check (grant_tier in ('pro', 'lifetime')),
  duration_days integer check (duration_days is null or duration_days > 0),
  grants_founder_badge boolean not null default false,
  max_uses integer not null default 1 check (max_uses > 0),
  current_uses integer not null default 0 check (current_uses >= 0),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  -- Lifetime never expires; pro needs a duration.
  check ((grant_tier = 'lifetime' and duration_days is null) or (grant_tier = 'pro' and duration_days is not null))
);

alter table public.redeem_codes enable row level security;

-- Codes are secrets: only admins list or edit them. Everyone else redeems through redeem_code().
drop policy if exists "redeem_codes_admin" on public.redeem_codes;
create policy "redeem_codes_admin" on public.redeem_codes
  for all to authenticated using (public.is_abot_admin()) with check (public.is_abot_admin());

grant select, insert, update, delete on public.redeem_codes to authenticated;

/* ------------------------------------------------------------- entitlements */

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro', 'lifetime')),
  pro_expires_at timestamptz,
  is_founder boolean not null default false,
  founder_unit_code text check (founder_unit_code is null or founder_unit_code ~ '^FOUNDER // #[0-9]{4}$'),
  source text,
  updated_at timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

-- A user reads their own row. Nobody writes it directly: tiers change only through
-- redeem_code(), claim_founder() and admin_grant(), so a client cannot grant itself PRO.
drop policy if exists "user_entitlements_own_read" on public.user_entitlements;
create policy "user_entitlements_own_read" on public.user_entitlements
  for select to authenticated using (user_id = auth.uid() or public.is_abot_admin());

grant select on public.user_entitlements to authenticated;

drop trigger if exists user_entitlements_touch on public.user_entitlements;
create trigger user_entitlements_touch before update on public.user_entitlements
  for each row execute function public.abot_touch_updated_at();

-- Merge a grant into a user's row: lifetime beats pro; pro time adds onto time not used yet.
create or replace function public.abot_apply_grant(p_user uuid, p_tier text, p_days integer, p_founder boolean, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_entitlements as e (user_id, tier, pro_expires_at, is_founder, source)
  values (
    p_user,
    p_tier,
    case when p_tier = 'pro' then now() + make_interval(days => p_days) end,
    p_founder,
    p_source
  )
  on conflict (user_id) do update set
    tier = case when e.tier = 'lifetime' or excluded.tier = 'lifetime' then 'lifetime' else 'pro' end,
    pro_expires_at = case
      when e.tier = 'lifetime' or excluded.tier = 'lifetime' then null
      else greatest(coalesce(e.pro_expires_at, now()), now()) + make_interval(days => p_days)
    end,
    is_founder = e.is_founder or excluded.is_founder,
    source = excluded.source;
end;
$$;
revoke all on function public.abot_apply_grant(uuid, text, integer, boolean, text) from public;

/* ------------------------------------------------------------------- redeem */

-- One redemption. Locks the code row so two people cannot take its last use at once. A signed-in
-- user redeeming a code they already used gets the same answer without spending another use.
-- Returns no row when the code does not exist, is inactive or is used up.
create table if not exists public.redeem_claims (
  code text not null references public.redeem_codes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.redeem_claims enable row level security;
drop policy if exists "redeem_claims_admin_read" on public.redeem_claims;
create policy "redeem_claims_admin_read" on public.redeem_claims
  for select to authenticated using (public.is_abot_admin());
grant select on public.redeem_claims to authenticated;

create or replace function public.redeem_code(p_code text)
returns table (grant_tier text, duration_days integer, grants_founder_badge boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.redeem_codes%rowtype;
  me uuid := auth.uid();
  again boolean := false;
begin
  select * into c from public.redeem_codes where code = upper(trim(p_code)) for update;
  if not found or not c.is_active then return; end if;
  if me is not null then
    again := exists (select 1 from public.redeem_claims rc where rc.code = c.code and rc.user_id = me);
  end if;
  if not again then
    if c.current_uses >= c.max_uses then return; end if;
    update public.redeem_codes set current_uses = current_uses + 1 where code = c.code;
    if me is not null then
      insert into public.redeem_claims (code, user_id) values (c.code, me);
      perform public.abot_apply_grant(me, c.grant_tier, c.duration_days, c.grants_founder_badge, 'code:' || c.code);
    end if;
  end if;
  return query select c.grant_tier, c.duration_days, c.grants_founder_badge;
end;
$$;
revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to anon, authenticated;

-- A signed-in user records the founder pass their device was stamped with during the beta.
-- Only while the app is in the founders beta, and it never changes a code once set.
create or replace function public.claim_founder(p_unit_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if (select monetization_mode from public.app_remote_config where id = 'global') <> 'FOUNDERS_BETA' then return; end if;
  if p_unit_code !~ '^FOUNDER // #[0-9]{4}$' then raise exception 'bad unit code' using errcode = '22023'; end if;
  insert into public.user_entitlements as e (user_id, is_founder, founder_unit_code, source)
  values (auth.uid(), true, p_unit_code, 'founders-beta')
  on conflict (user_id) do update set
    is_founder = true,
    founder_unit_code = coalesce(e.founder_unit_code, excluded.founder_unit_code);
end;
$$;
revoke all on function public.claim_founder(text) from public;
grant execute on function public.claim_founder(text) to authenticated;

/* -------------------------------------------------------------------- admin */

-- Manual upgrade, for a buyer who paid by bank transfer or QRIS. Returns false when no account
-- has that email (they need to sign in to ABOT once first).
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
  return true;
end;
$$;
revoke all on function public.admin_grant(text, text, integer) from public;
grant execute on function public.admin_grant(text, text, integer) to authenticated;

create or replace function public.admin_stats()
returns table (total_users bigint, founders bigint, active_pro bigint, active_codes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query select
    (select count(*) from auth.users),
    (select count(*) from public.user_entitlements where is_founder),
    (select count(*) from public.user_entitlements where tier = 'lifetime' or (tier = 'pro' and pro_expires_at > now())),
    (select count(*) from public.redeem_codes where is_active and current_uses < max_uses);
end;
$$;
revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

grant execute on function public.is_abot_admin() to anon, authenticated;
