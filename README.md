# ABOT: Gym Progress Tracker

Mobile-first strength-training logger built with Next.js (App Router), TypeScript,
Tailwind CSS, Zustand (persisted to localStorage), Lucide icons and Recharts.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest unit tests
npm run e2e      # Playwright end-to-end tests (phone viewport)
```

ABOT (Javanese for "heavy") runs fully in the browser: no account, no server, no paid API.
Roadmap: `docs/plans/abot-master-plan.md`.

See `src/types/workout.ts` for the data model and `src/lib/calc.ts` for the
calculation logic (Epley 1RM, volume, PR detection, muscle split).
