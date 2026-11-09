-- Fixes for 20261109_admin_and_redeem.sql. Safe to run more than once.
--
-- 1. abot_apply_grant() writes any user's tier and checks nobody. `revoke ... from public` does not
--    remove the execute grant a Supabase project gives anon and authenticated on every new
--    function in the public schema, so anyone with the anon key could call it through /rest/v1/rpc
--    and give any account lifetime access. Only redeem_code() and admin_grant() call it now.
-- 2. is_abot_admin() trusted the email claim in the token. With the Email provider on and email
--    confirmation off, someone could sign up with the admin's address first. It now requires the
--    signed-in user's own confirmed email (Google sign-ins are confirmed).

revoke execute on function public.abot_apply_grant(uuid, text, integer, boolean, text) from public, anon, authenticated;

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
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;
