-- ABOT cloud sync: two more record kinds.
-- "bodyweight": one weigh-in per day (id = YYYY-MM-DD). "media": a custom tutorial video link
-- per exercise (id = exercise id). Both became user data after 0001 was written.
-- Safe to run more than once, and on a database where 0001 is already applied.

alter table public.abot_records drop constraint if exists abot_records_kind_check;
alter table public.abot_records
  add constraint abot_records_kind_check
  check (kind in ('session', 'routine', 'exercise', 'location', 'settings', 'bodyweight', 'media'));
