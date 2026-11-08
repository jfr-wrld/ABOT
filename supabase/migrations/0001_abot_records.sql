-- ABOT cloud sync schema (Supabase Postgres).
-- Spec: docs/plans/abot-master-plan.md section 3.1. Optional: the app works fully without it.
-- Apply in the Supabase SQL editor or with `supabase db push`. Not executed in CI.

-- One generic table keeps the client adapter small and lets the local schema evolve freely.
create table if not exists public.abot_records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('session', 'routine', 'exercise', 'location', 'settings')),
  id text not null,
  payload jsonb not null,
  updated_at bigint not null,                 -- device clock, ms since epoch
  deleted boolean not null default false,     -- tombstone so deletes sync across devices
  server_updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists abot_records_pull_idx
  on public.abot_records (user_id, server_updated_at);

alter table public.abot_records enable row level security;

drop policy if exists "abot_records_own_rows" on public.abot_records;
create policy "abot_records_own_rows" on public.abot_records
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- server_updated_at is the pull cursor: it must change on every write, whatever the client sent.
create or replace function public.abot_touch_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists abot_records_touch on public.abot_records;
create trigger abot_records_touch
  before insert or update on public.abot_records
  for each row execute function public.abot_touch_server_updated_at();

-- Upsert a batch, but never let an older device copy overwrite a newer row.
-- rows: jsonb array of { kind, id, payload, updated_at, deleted }.
-- Returns the "kind:id" keys that were written and those rejected as older than the server copy.
-- security invoker: runs as the signed-in user, so RLS still applies to every row.
create or replace function public.upsert_if_newer(rows jsonb)
returns table (accepted text[], rejected text[])
language plpgsql
security invoker
as $$
declare
  r jsonb;
  acc text[] := '{}';
  rej text[] := '{}';
  n int;
begin
  for r in select * from jsonb_array_elements(rows)
  loop
    insert into public.abot_records as t (user_id, kind, id, payload, updated_at, deleted)
    values (
      auth.uid(),
      r->>'kind',
      r->>'id',
      r->'payload',
      (r->>'updated_at')::bigint,
      coalesce((r->>'deleted')::boolean, false)
    )
    on conflict (user_id, kind, id) do update
      set payload = excluded.payload,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted
      where t.updated_at < excluded.updated_at;
    get diagnostics n = row_count;
    if n > 0 then
      acc := acc || ((r->>'kind') || ':' || (r->>'id'));
    else
      rej := rej || ((r->>'kind') || ':' || (r->>'id'));
    end if;
  end loop;
  return query select acc, rej;
end;
$$;

grant execute on function public.upsert_if_newer(jsonb) to authenticated;
