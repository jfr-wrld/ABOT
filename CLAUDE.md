# ABOT: Gym Progress Tracker

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Zustand (persist) + Recharts + Lucide.
Weights are stored in kg everywhere; convert at the UI edge. See `src/types/workout.ts`.

Commands: `npm run dev`, `npm test` (vitest), `npm run e2e` (Playwright), `npm run lint`, `npm run build`.
Zero External Paid API: no runtime network calls, no tokens. Plans live in `docs/plans/`.
Exceptions, both optional and owner-approved: Supabase cloud sync, and payments (Midtrans checkout and
webhook through Supabase Edge Functions, web and Android, 2026-11-11; see `docs/payments-setup.md`),
and the Android app's update check (GitHub Releases API, on every start, on return at most every 30 minutes,
and when tapped; the APK downloads only after the user taps Update now; `src/lib/app-update.ts`).
The web app's "Get the app" pitch only links to `releases/latest/download/abot.apk` on GitHub (CI uploads each
signed build under that fixed name too) and fetches nothing; the QR code is a static SVG (`scripts/make-get-app-qr.mjs`).
Remotion is design-time only: `tools/motion-studio/` (its own package) previews the story and streak
painters in Remotion Studio; it is never shipped in the app, which makes its MP4s itself (`src/lib/video-export.ts`).
Free Remotion licence (individual / at most 3 people), so renders pass no licence key.
Also approved: turning a TikTok share link (vt.tiktok.com) into its full video link, one request to TikTok
only when the user saves that link as an exercise video (`src/lib/tiktok-resolve.ts`).

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.claude/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.claude/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.claude/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.claude/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.claude/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.claude/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->
