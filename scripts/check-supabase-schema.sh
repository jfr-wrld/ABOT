#!/usr/bin/env bash
# Runs supabase/tests/schema-check.sql in a throwaway local Postgres cluster.
# Needs the Postgres server binaries (initdb, pg_ctl) and psql. Touches no remote database.
set -euo pipefail
cd "$(dirname "$0")/.."

BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || { echo "initdb not found; set PG_BIN" >&2; exit 2; }

DIR="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = 0 ]; then
  # Postgres refuses to run as root.
  id postgres >/dev/null 2>&1 || useradd -r postgres
  chown -R postgres "$DIR"
  RUN_AS=(runuser -u postgres --)
fi
cleanup() { "${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-k $DIR -c listen_addresses=''" -l "$DIR/log" start -w >/dev/null
"${RUN_AS[@]}" psql -h "$DIR" -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f supabase/tests/schema-check.sql
