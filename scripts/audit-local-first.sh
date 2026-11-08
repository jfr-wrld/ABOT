#!/usr/bin/env bash
# End-to-end local-first audit. Proves the app builds and runs with no environment variables,
# ships no Supabase project URL or key to the browser, and passes the full browser suite against a
# production server (including the no-external-request and offline-logging checks).
# Usage: npm run audit   (add --skip-schema when no local Postgres is installed)
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=3100
STASH="$(mktemp -d)"
SERVER_PID=""
restore() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  # Put back any env file moved aside for the zero-env build.
  for f in "$STASH"/.env*; do [ -e "$f" ] && mv "$f" .; done
  rm -rf "$STASH"
}
trap restore EXIT

step() { printf '\n== %s\n' "$1"; }

step "Type check, lint, unit tests"
npx tsc --noEmit
npm run lint --silent
npm test --silent

step "Zero-env production build"
for f in .env .env.local .env.production .env.production.local; do [ -e "$f" ] && mv "$f" "$STASH/"; done
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY bash -c 'rm -rf .next && npm run build --silent'

step "Client bundle carries no Supabase project URL or key"
# The supabase-js library is in the bundle (loaded only when someone signs in). What must not be
# there in a zero-env build is a project address or a key.
if grep -rlE "[a-z0-9]{20}\.supabase\.co|eyJhbGciOi" .next/static; then
  echo "FAIL: the files above contain a Supabase project URL or a JWT" >&2; exit 1
fi
echo "ok"

step "Production server: every route answers"
lsof -ti tcp:$PORT >/dev/null 2>&1 && { echo "port $PORT is busy; stop that server first" >&2; exit 1; }
npx next start -p $PORT > "$STASH/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://localhost:$PORT/" && break; sleep 1; done
fail=0
for p in / /workout /routines /exercises /progress /settings /exercises/bench-press-barbell \
         /history/any-id /routines/any-id/edit /icon.svg; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$p")
  printf '%-34s %s\n' "$p" "$code"
  [ "$code" = 200 ] || fail=1
done
[ "$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/no-such-page")" = 404 ] || fail=1
[ $fail = 0 ] || { echo "FAIL: a route did not answer as expected" >&2; exit 1; }

step "Browser suite against the production server"
E2E_REUSE_SERVER=1 npx playwright test --trace off

if [ "${1:-}" != "--skip-schema" ]; then
  step "Supabase schema on a throwaway local Postgres"
  scripts/check-supabase-schema.sh | tail -1
fi

printf '\nLocal-first audit passed.\n'
