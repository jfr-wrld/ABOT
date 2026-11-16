-- Cloud records are written only through upsert_if_newer (security review 2026-11-16).
--
-- The 500-row batch and 20,000-record caps live inside upsert_if_newer, but the function ran as
-- the caller (security invoker), so signed-in accounts kept INSERT and UPDATE on abot_records and
-- could POST to /rest/v1/abot_records directly, without any cap. The function now runs as its
-- owner; every row it writes is still the caller's own (user_id = auth.uid(), checked first),
-- and direct writes are revoked. Reads and deletes of one's own rows stay under RLS.

alter function public.upsert_if_newer(jsonb) security definer;
alter function public.upsert_if_newer(jsonb) set search_path = public;
revoke insert, update on public.abot_records from authenticated;
