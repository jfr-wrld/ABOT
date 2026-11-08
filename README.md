# ABOT: Gym Progress Tracker

ABOT (Javanese for "heavy") is a mobile-first strength-training logger. It runs fully in the
browser: no account, no server, no paid API. Workouts are saved on the device in IndexedDB,
and Settings can export and import everything as a JSON file. Optional cloud sync with Google
sign-in (Supabase) keeps several phones in step; the app never needs it. Setup:
`docs/cloud-sync-setup.md`.

Built with Next.js (App Router), TypeScript, Tailwind CSS, Zustand, Dexie, Lucide icons and
Recharts.

```bash
npm install
npm run dev           # http://localhost:3000
npm test              # unit tests (Vitest)
npm run e2e           # browser tests on a phone viewport (Playwright, dev server)
npm run audit         # full local-first audit, see below
npm run check:schema  # Supabase schema checks on a throwaway local Postgres
```

## Local-first audit

`npm run audit` runs, in order:

1. Type check, lint and unit tests.
2. A production build with every env file moved aside, so the app is proven to need none.
3. A scan of the browser bundle for any Supabase project URL or key.
4. A production server, with every route checked for an answer.
5. The whole browser suite against that server. It includes a check that a full training day
   makes no request outside the app, and that logging and finishing a workout keep working with
   the network cut.
6. The Supabase schema checks (skip with `npm run audit -- --skip-schema` when Postgres is not
   installed).

Env files are restored when the audit ends, even when it fails. Port 3100 must be free.

## Where to look

- Data model: `src/types/workout.ts`. Weights are stored in kg; units convert at the UI edge.
- Calculations (Epley 1RM, volume, PR detection): `src/lib/calc.ts`.
- Storage: `src/data/repo/` (Dexie behind a repository interface) and `src/store/persistence.ts`.
- Cloud sync: `src/data/sync/` (merge engine, Supabase adapter); schema in `supabase/migrations/`.
- Roadmap and plans: `docs/plans/`.
- Exercise data and images come from free-exercise-db (public domain); anatomy paths from
  react-muscle-highlighter (MIT). See `THIRD_PARTY_NOTICES.md`.
