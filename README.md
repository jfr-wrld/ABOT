# Heavy — Gym Progress Tracker

Mobile-first strength-training logger built with Next.js (App Router), TypeScript,
Tailwind CSS, Zustand (persisted to localStorage), Lucide icons and Recharts.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest unit tests (1RM / volume / PR logic)
```

See `src/types/workout.ts` for the data model and `src/lib/calc.ts` for the
calculation logic (Epley 1RM, volume, PR detection, muscle split).
