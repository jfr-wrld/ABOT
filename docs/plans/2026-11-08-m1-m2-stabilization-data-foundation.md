# M1 Stabilization + M2 Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing screen verified and lint-clean under the ABOT brand, then move all persistence from `localStorage` to IndexedDB behind a repository layer with export/import, gym locations, and load modes.

**Architecture:** Zustand stays the synchronous in-memory source of truth for the UI (a set tick is a plain `set()` call, 0 ms). A persistence module subscribes to the stores and writes changes to a `Repository` interface asynchronously through a serial queue. `DexieRepository` is the production implementation; `MemoryRepository` backs tests and the fallback when IndexedDB is unavailable. A future Supabase adapter implements the same interface.

**Tech Stack:** Next.js 16.4 (App Router, client components), React 19.3, TypeScript strict, Tailwind v4, Zustand 5, Dexie 4.4.7, fake-indexeddb 6.2.7 (tests), Vitest 5, @playwright/test 1.63.0 (pinned to the preinstalled Chromium build).

**Spec:** `docs/plans/abot-master-plan.md` (sections 1.4, 3, 5.2, 5.3, 8 M1/M2, 9).

## Global Constraints

- Zero External Paid API: no network calls at runtime, no tokens, no server routes.
- Persist asynchronously; never `await` storage inside a UI event handler.
- Weights are stored in kg; convert only at the UI edge (`src/lib/units.ts`).
- UI copy in English; brand name "ABOT"; no em dash character anywhere in UI text, docs, or comments written by this plan.
- antislop DURING: 44 px tap targets, visible focus, text contrast at least 4.5:1 (check new colors with `.claude/skills/antislop-human/contrast-check.py`), no dead controls, honest empty/loading/error states.
- React Compiler lint rules apply: no impure calls (`Date.now()`, `Math.random()`) during render; no synchronous `setState` in effects.
- Next.js 16: read `node_modules/next/dist/docs/` before using an API not already used in the repo.
- Every task ends with `npm run lint && npm test` green; tasks that touch UI also end with `npm run e2e` green.

## Review Focus

1. IndexedDB unavailable (private browsing, blocked storage): the app must still log in memory and show the storage error banner, not a blank screen. Test in Task 10.
2. Rapid consecutive set ticks: writes must land in order so the stored active workout equals the last in-memory state. Test in Task 10.
3. Importing a backup while a workout is active: the active workout must survive a merge import and be replaced only on an explicit replace import. Test in Task 12.
4. Legacy migration interrupted or run twice: data must not duplicate and `localStorage` must stay untouched. Test in Task 11.
5. Unit round trip: typing 62.5 in lbs and switching back to kg must not drift the stored kg value by more than 0.001. Test in Task 8.

---

## M1: Stabilization

### Task 1: Remove render-time clock reads

**Files:**
- Modify: `src/app/progress/page.tsx`, `src/components/analytics/WorkoutCalendar.tsx`

**Interfaces:**
- Consumes: `useNow(intervalMs, enabled)` from `src/lib/useNow.ts`
- Produces: nothing new

- [ ] **Step 1: Reproduce** Run: `npm run lint` Expected: 5 errors "Cannot call impure function during render" in the two files.
- [ ] **Step 2: Fix** Read the clock with `const now = useNow(60_000)` and pass `now` into `weeklyBuckets`, `weekStreak`, `startOfWeek`, `monthGrid`, `startOfDay`; initial `useState` values use lazy initializers.
- [ ] **Step 3: Verify** Run: `npm run lint && npm test` Expected: 0 errors, 15 tests pass.
- [ ] **Step 4: Commit** `fix: read the clock through useNow in progress views`

### Task 2: Playwright e2e harness in the repo

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/logger.spec.ts`
- Modify: `package.json` (devDependency `@playwright/test@1.63.0` exact, script `"e2e": "playwright test --trace off"`), `.gitignore` (`/test-results`, `/playwright-report`)

**Interfaces:**
- Produces: `e2e/helpers.ts` exports `expectNoHorizontalOverflow(page: Page): Promise<void>`, `startEmptyWorkout(page: Page): Promise<void>`, `addExercise(page: Page, name: string): Promise<void>`, `logSet(page: Page, n: number, kg: string, reps: string): Promise<void>`

- [ ] **Step 1: Config** `playwright.config.ts`: `testDir: "e2e"`, one project using `devices["Pixel 7"]`, `use.baseURL: "http://localhost:3100"`, `webServer: { command: "npm run dev -- -p 3100", url: "http://localhost:3100", reuseExistingServer: true, timeout: 120_000 }`, `workers: 1`, `fullyParallel: false`.
- [ ] **Step 2: Port the scratchpad click-through** into `e2e/logger.spec.ts` as tests: `starts an empty workout and adds an exercise`, `refuses to complete a set without reps`, `completing a set starts the rest timer and updates header`, `active workout survives reload`, `set type menu changes type and closes on Escape`, `finish saves and previous column autofills next time`, `discard removes the active workout`. Each test starts from a cleared origin (`context.clearCookies()` plus `page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase("abot") })` in `beforeEach`).
- [ ] **Step 3: Verify** Run: `npm run e2e` Expected: 7 passed.
- [ ] **Step 4: Commit** `test: add Playwright e2e harness and logger specs`

### Task 3: Verify the unverified screens

**Files:**
- Create: `e2e/routines.spec.ts`, `e2e/exercises.spec.ts`, `e2e/progress.spec.ts`, `e2e/history.spec.ts`, `e2e/settings.spec.ts`
- Modify: whichever source files the failing specs implicate

- [ ] **Step 1: Write specs**
  - routines: `creates a routine, adds an exercise with targets, starts it` (workout opens with 3 sets prefilled from targets), `duplicates and deletes a routine`, `blocks starting a routine while a workout is active`, `empty name shows inline error`.
  - exercises: `filters by muscle and equipment`, `creates a custom exercise and opens its detail`, `detail shows records after a finished workout`.
  - progress: `empty state on first run`, `bars and muscle split render after a workout` (figure captions visible, table view lists 8 rows), `calendar moves months and links a day to its workout`.
  - history: `opens a finished workout from home and deletes it with confirmation`.
  - settings: `switching to lbs changes the logger column label and header volume unit`, `RPE toggle hides the RPE column`.
  - every spec calls `expectNoHorizontalOverflow` on each screen it visits at 360 px width (`page.setViewportSize({ width: 360, height: 780 })`).
- [ ] **Step 2: Run** Run: `npm run e2e` Expected: failures only where the screens are actually broken; record each.
- [ ] **Step 3: Fix each failure at its cause** (systematic-debugging), re-run until green.
- [ ] **Step 4: Verify** Run: `npm run lint && npm test && npm run e2e` Expected: all green.
- [ ] **Step 5: Commit** `test: cover routines, exercises, progress, history, settings; fix defects found`

### Task 4: Shared set numbering and memoized exercise lookup

**Files:**
- Create: `src/lib/sets.ts`, `src/lib/sets.test.ts`
- Modify: `src/store/useExerciseStore.ts`, `src/components/workout/ExerciseCard.tsx`, `src/app/routines/[id]/edit/page.tsx`, `src/app/history/[id]/page.tsx`, `src/app/exercises/[id]/page.tsx`

**Interfaces:**
- Produces: `setNumbers(sets: { type: SetType }[]): (number | null)[]` (warm-ups get `null`; normal, dropset, failure count 1, 2, 3 in order); `buildExerciseIndex(custom: Exercise[]): { list: Exercise[]; byId: Record<string, Exercise> }`; `useAllExercises()` returns a value that is referentially stable while `custom` is unchanged.

- [ ] **Step 1: Failing tests** `setNumbers([W, N, N, D, F])` equals `[null, 1, 2, 3, 4]`; `setNumbers([])` equals `[]`; `buildExerciseIndex([])` has 44 entries sorted by name; a custom exercise appears in both `list` and `byId`.
- [ ] **Step 2: Run** `npx vitest run src/lib/sets.test.ts` Expected: FAIL, module not found.
- [ ] **Step 3: Implement** both functions in `src/lib/sets.ts`; `useAllExercises` wraps `buildExerciseIndex` in `useMemo` keyed on `custom`; replace the four inline counters with `setNumbers`.
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e` Expected: green.
- [ ] **Step 5: Commit** `refactor: share set numbering and memoize the exercise index`

### Task 5: Finish-time safety (mark remaining, adjust start)

**Files:**
- Create: `src/store/useWorkoutStore.test.ts`
- Modify: `src/store/useWorkoutStore.ts`, `src/components/workout/FinishDialog.tsx`, `src/components/workout/ActiveWorkoutHeader.tsx`, `e2e/logger.spec.ts`

**Interfaces:**
- Produces: store actions `completeAllRemaining(): number` (marks every uncompleted set whose `reps > 0` as completed with `completedAt = Date.now()`, returns how many; does not start the rest timer) and `setStartedAt(ts: number): { ok: true } | { ok: false; reason: string }` (rejects a time in the future and a time after the earliest `completedAt`).

- [ ] **Step 1: Failing tests** in `useWorkoutStore.test.ts` (reset the store with `useWorkoutStore.setState(initial)` in `beforeEach`): `completeAllRemaining marks only sets with reps`, `completeAllRemaining returns 0 with no active workout`, `setStartedAt rejects the future`, `setStartedAt rejects a time after the first completed set`, `setStartedAt accepts an earlier time`, `completeSet changes state synchronously` (assert immediately after the call, no await).
- [ ] **Step 2: Run** `npx vitest run src/store` Expected: FAIL, actions undefined.
- [ ] **Step 3: Implement** the two actions. FinishDialog shows "Mark N remaining sets done" (only when N > 0) above the footer. Tapping the Duration stat opens a sheet with a labelled `<input type="time">` for the start time and an inline error from `reason`.
- [ ] **Step 4: e2e** add `mark remaining sets done from the finish dialog` and `adjust start time` to `logger.spec.ts`.
- [ ] **Step 5: Verify** `npm run lint && npm test && npm run e2e` Expected: green.
- [ ] **Step 6: Commit** `feat: mark remaining sets done and adjust workout start time`

### Task 6: ABOT brand

**Files:**
- Create: `src/components/brand/AbotMark.tsx`, `src/app/icon.svg`
- Modify: `src/app/layout.tsx` (title "ABOT", description), `src/app/page.tsx` (h1 is the wordmark), `README.md`, `CLAUDE.md` (title line), `DESIGN.md` (title, logo section), `package.json` (`"name": "abot"`), e2e specs that look for the "Heavy" heading

**Interfaces:**
- Produces: `AbotMark({ size?: number; title?: string })` renders an SVG hexagon plate (flat-top hexagon, centre hole radius 22% of size, 2 px inner ring) in `currentColor`; `AbotWordmark()` renders the mark plus the text "ABOT" in `font-black tracking-tight` inside an `<h1>`-compatible inline element.

- [ ] **Step 1: e2e first** change the home assertion to `getByRole("heading", { name: "ABOT" })`; Run `npm run e2e` Expected: FAIL.
- [ ] **Step 2: Implement** the components and icon (same geometry, `#09090b` background, `#3b82f6` plate). Mark has `aria-hidden` inside the wordmark; standalone use requires `title`.
- [ ] **Step 3: Verify** `npm run lint && npm test && npm run e2e` and `grep -rn "Heavy" src README.md CLAUDE.md DESIGN.md` Expected: green, and no product-name hits.
- [ ] **Step 4: Commit** `feat: rebrand to ABOT with hexagon plate mark`

---

## M2: Data Foundation

### Task 7: Domain model extensions with normalizers

**Files:**
- Modify: `src/types/workout.ts`, `src/data/exercises.ts`
- Create: `src/data/normalize.ts`, `src/data/normalize.test.ts`

**Interfaces:**
- Produces types: `LoadMode = "total" | "per_hand" | "unilateral"`; `LogType = "weight_reps" | "reps_only" | "duration" | "distance_duration"`; `Exercise` gains `loadMode: LoadMode`, `logType: LogType`, `isMachineDependent: boolean`; `WorkoutSet` gains `durationSec?: number | null`, `distanceM?: number | null`; `SessionExercise` and `RoutineExercise` gain `supersetId?: string`; `WorkoutSession` gains `locationId?: string`; `GymLocation { id: string; name: string; barWeightKg: number; plateInventoryKg: number[]; isDefault: boolean }`; `UserSettings` gains `activeLocationId: string | null`.
- Produces functions: `normalizeExercise(raw: Partial<Exercise> & Pick<Exercise, "id" | "name" | "primaryMuscle" | "equipment">): Exercise`; `normalizeSession(raw: unknown): WorkoutSession | null`; `normalizeRoutine(raw: unknown): Routine | null`; `defaultLoadMode(equipment: Equipment, name: string): LoadMode`; `DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]`.

- [ ] **Step 1: Failing tests** `defaultLoadMode("dumbbell", "Bench Press (Dumbbell)") === "per_hand"`; names containing "One Arm" or "Bulgarian" give `"unilateral"`; barbell gives `"total"`; `normalizeExercise` sets `isMachineDependent` true for machine and cable, false otherwise, and `logType` `"reps_only"` for `isBodyweight` (Plank: `"duration"`); `normalizeSession` returns `null` for missing `id` or `startedAt`, drops sets with non-numeric reps, and keeps legacy sessions without new fields; every seed exercise passes through `normalizeExercise` unchanged in id.
- [ ] **Step 2: Run** `npx vitest run src/data` Expected: FAIL.
- [ ] **Step 3: Implement**; `SEED_EXERCISES` is built by mapping raw seed rows through `normalizeExercise`.
- [ ] **Step 4: Verify** `npm run lint && npm test` Expected: green (existing calc tests unchanged).
- [ ] **Step 5: Commit** `feat: extend the domain model with load modes, log types and gym locations`

### Task 8: Calculations aware of load mode and gym variant

**Files:**
- Modify: `src/lib/calc.ts`, `src/lib/calc.test.ts`, `src/lib/units.ts`
- Create: `src/lib/units.test.ts`

**Interfaces:**
- Consumes: `Exercise.loadMode`, `Exercise.isMachineDependent`, `WorkoutSession.locationId` from Task 7.
- Produces: `volumeFactor(mode: LoadMode): 1 | 2`; `variantKey(exerciseId: string, exercise: Exercise | undefined, locationId: string | undefined): string` (`"<id>@<locationId>"` when machine dependent and a location exists, else `"<id>"`); `setVolume(set, mode?: LoadMode)`; `sessionVolume(session, byId?: Record<string, Exercise>)`; `buildPRTable(sessions, byId?)` keyed by `variantKey`; `detectSessionPRs(session, all, byId?)`; `previousSets(exerciseId, sessions, excludeSessionId?, opts?: { byId?: Record<string, Exercise>; locationId?: string })`; `exerciseHistory(exerciseId, sessions, opts?: { byId?; locationId? })`; `muscleSplit` unchanged. Omitted `byId` keeps today's behaviour.

- [ ] **Step 1: Failing tests** per-hand dumbbell 30 kg x 10 has volume 600; unilateral 30 x 10 has 300; Lat Pulldown at location A 60 x 10 does not make 50 x 10 at location B lose its PR (each variant has its own heaviest); barbell PR is shared across locations; `previousSets` with `locationId: "B"` for a machine exercise ignores location A sessions and falls back to `null`; units: `fromDisplay(toDisplay(62.5, "lbs"), "lbs")` within 0.001 of 62.5, and `fromDisplay(137.5, "lbs")` within 0.001 of 62.369.
- [ ] **Step 2: Run** `npx vitest run src/lib` Expected: FAIL.
- [ ] **Step 3: Implement**; update all call sites to pass `byId` (and `locationId` from the active session) so the UI uses variant-aware numbers.
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e` Expected: green.
- [ ] **Step 5: Commit** `feat: load-mode volume and per-location records`

### Task 9: Repository interface, Dexie and memory implementations

**Files:**
- Create: `src/data/repo/types.ts`, `src/data/repo/memory.ts`, `src/data/repo/dexie.ts`, `src/data/repo/index.ts`, `src/data/repo/contract.test.ts`
- Modify: `package.json` (dependency `dexie@4.4.7`, devDependency `fake-indexeddb@6.2.7`)

**Interfaces:**
- Produces:
  ```ts
  interface Repository {
    sessions: { all(): Promise<WorkoutSession[]>; put(s: WorkoutSession): Promise<void>; remove(id: string): Promise<void> };
    routines: { all(): Promise<Routine[]>; put(r: Routine): Promise<void>; remove(id: string): Promise<void> };
    exercises: { all(): Promise<Exercise[]>; put(e: Exercise): Promise<void>; remove(id: string): Promise<void> }; // custom only
    locations: { all(): Promise<GymLocation[]>; put(l: GymLocation): Promise<void>; remove(id: string): Promise<void> };
    kv: { get<T>(key: KvKey): Promise<T | undefined>; set<T>(key: KvKey, value: T): Promise<void>; remove(key: KvKey): Promise<void> };
    replaceAll(data: RepoSnapshot): Promise<void>; // one transaction
    snapshot(): Promise<RepoSnapshot>;
  }
  type KvKey = "settings" | "activeWorkout" | "restTimer" | "migratedFromLocalStorage";
  interface RepoSnapshot { sessions; routines; exercises; locations; settings: UserSettingsState | null; activeWorkout: WorkoutSession | null }
  ```
  `createDexieRepository(name = "abot"): Repository`; `createMemoryRepository(): Repository`; `getRepository(): Promise<{ repo: Repository; durable: boolean; error: string | null }>` (opens Dexie, falls back to memory with `durable: false` and the error message when `indexedDB` is missing or `open()` rejects).
- Dexie schema v1: `sessions: "id, startedAt, status"`, `routines: "id"`, `exercises: "id"`, `locations: "id"`, `kv: "key"`.

- [ ] **Step 1: Failing contract tests** one `describe.each([["memory", createMemoryRepository], ["dexie", () => createDexieRepository("t-" + crypto.randomUUID())]])` suite with `import "fake-indexeddb/auto"`: put/all/remove round trip for each table; `kv` get of a missing key is `undefined`; `replaceAll` then `snapshot` returns equal data; `put` with an existing id overwrites.
- [ ] **Step 2: Run** `npx vitest run src/data/repo` Expected: FAIL.
- [ ] **Step 3: Implement** both repositories and `getRepository`.
- [ ] **Step 4: Verify** `npm run lint && npm test` Expected: green.
- [ ] **Step 5: Commit** `feat: repository layer with Dexie and in-memory implementations`

### Task 10: Stores persist through the repository

**Files:**
- Create: `src/store/persistence.ts`, `src/store/persistence.test.ts`, `src/store/useLocationStore.ts`
- Modify: all four stores (remove zustand `persist`), `src/components/layout/StoreHydrator.tsx`, `src/store/hydration.ts` (add `durable: boolean`), `src/components/ui/Loading.tsx` (banner when not durable)

**Interfaces:**
- Consumes: `Repository`, `getRepository` (Task 9).
- Produces: `hydrateStores(repo: Repository): Promise<void>`; `attachPersistence(repo: Repository): { flush(): Promise<void>; detach(): void }` which subscribes to every store and enqueues writes on a single promise chain (sessions, routines, custom exercises, locations diffed by id against the previous state; `activeWorkout`, `restTimer`, `settings` written as kv on change); `useLocationStore` with `locations`, `add(name)`, `update(id, patch)`, `remove(id)`, `setDefault(id)`.

- [ ] **Step 1: Failing tests** with a memory repo: after `hydrateStores` stores equal the repo; ticking a set changes the store synchronously and, after `flush()`, `kv.get("activeWorkout")` holds the completed set; 20 rapid `updateSet` calls then `flush()` leave the repo equal to the final store state (Review Focus 2); finishing a workout writes the session and clears `activeWorkout`; deleting a routine removes it from the repo; a repo whose writes reject sets `useHydration.getState().error` and the store keeps working (Review Focus 1).
- [ ] **Step 2: Run** `npx vitest run src/store` Expected: FAIL.
- [ ] **Step 3: Implement**; `StoreHydrator` calls `getRepository()`, then `hydrateStores`, then `attachPersistence`, then `setHydrated({ durable, error })`.
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e` Expected: green (e2e reload test now proves IndexedDB persistence).
- [ ] **Step 5: Commit** `feat: persist stores to IndexedDB through the repository`

### Task 11: One-time migration from localStorage

**Files:**
- Create: `src/data/migrateLegacy.ts`, `src/data/migrateLegacy.test.ts`
- Modify: `src/components/layout/StoreHydrator.tsx`

**Interfaces:**
- Consumes: `Repository`, `normalizeSession`, `normalizeRoutine`, `normalizeExercise`.
- Produces: `migrateFromLocalStorage(repo: Repository, storage: Pick<Storage, "getItem">): Promise<{ migrated: boolean; counts: { sessions: number; routines: number; exercises: number } }>` reading keys `heavy.workouts`, `heavy.routines`, `heavy.exercises`, `heavy.settings` (zustand persist shape `{ state, version }`).

- [ ] **Step 1: Failing tests** legacy data with 2 sessions, 1 routine, 1 custom exercise, settings in lbs and an active workout migrates all of it; a second run returns `migrated: false` and counts stay the same in the repo (Review Focus 4); corrupt JSON in one key migrates the others and does not throw; storage is never written (the fake `Storage` has no `setItem`).
- [ ] **Step 2: Run** Expected: FAIL.
- [ ] **Step 3: Implement**; run before `hydrateStores` in `StoreHydrator`; sets `kv.migratedFromLocalStorage = true` only after all writes resolve.
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e` Expected: green.
- [ ] **Step 5: Commit** `feat: migrate legacy localStorage data into IndexedDB once`

### Task 12: Export and import backup

**Files:**
- Create: `src/data/backup.ts`, `src/data/backup.test.ts`, `src/components/settings/BackupSection.tsx`, `e2e/backup.spec.ts`
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `Repository.snapshot`, `Repository.replaceAll`, normalizers, `hydrateStores`.
- Produces: `interface AbotBackup { app: "ABOT"; schemaVersion: 1; exportedAt: string; data: RepoSnapshot }`; `exportBackup(repo): Promise<AbotBackup>`; `parseBackup(text: string): { ok: true; backup: AbotBackup; counts: { sessions: number; routines: number; exercises: number; locations: number } } | { ok: false; error: string }`; `importBackup(repo, backup, mode: "replace" | "merge"): Promise<void>` (merge: union by id, incoming wins on conflict, current `activeWorkout` kept; replace: everything from the file, `activeWorkout` from the file).

- [ ] **Step 1: Failing tests** export then parse round trip equals the snapshot; `parseBackup("not json")` error "This file is not valid JSON"; wrong `app` error "This is not an ABOT backup"; `schemaVersion: 2` error "This backup was made by a newer version of ABOT"; sessions with bad rows are dropped and counted, not fatal; merge keeps existing ids not in the file; merge keeps the active workout and replace swaps it (Review Focus 3).
- [ ] **Step 2: Run** Expected: FAIL.
- [ ] **Step 3: Implement** the module and `BackupSection`: "Export backup" downloads `abot-backup-YYYY-MM-DD.json` via a Blob URL; "Import backup" is a labelled file input that shows the counts and two buttons, "Merge into my data" and "Replace all my data" (replace asks for a second confirmation), then rehydrates stores and shows a status message.
- [ ] **Step 4: e2e** `backup.spec.ts`: finish a workout, export (capture the download), clear storage, reload, import with replace, the workout is back on Home.
- [ ] **Step 5: Verify** `npm run lint && npm test && npm run e2e` Expected: green.
- [ ] **Step 6: Commit** `feat: export and import ABOT backups`

### Task 13: Gym locations, load modes and weighted bodyweight in the UI

**Files:**
- Create: `src/components/settings/LocationsSection.tsx`, `e2e/locations.spec.ts`
- Modify: `src/app/settings/page.tsx`, `src/store/useWorkoutStore.ts` (`startEmpty`/`startFromRoutine` take `locationId`; action `setLocation(id | undefined)`), `src/components/workout/ActiveWorkoutHeader.tsx` (location select when at least one location exists), `src/components/workout/ExerciseCard.tsx` and `SetRow.tsx` (column label `kg/hand` for per-hand, `+kg` for bodyweight with the weight input enabled as added load), `src/components/exercises/ExerciseForm.tsx` (Load select: Total, Per hand, One side at a time; checkbox "Weight depends on the gym's machine")

**Interfaces:**
- Consumes: `useLocationStore` (Task 10), `variantKey` and variant-aware calc (Task 8).
- Produces: no new exports beyond the components.

- [ ] **Step 1: e2e first** `locations.spec.ts`: create locations "Gym A" and "Gym B"; log Lat Pulldown 60 x 10 at Gym A and finish; start at Gym B, add Lat Pulldown, the Previous cell reads "No previous set"; switch the workout to Gym A, Previous reads "60 × 10". Second test: Bench Press (Dumbbell) header label reads "kg/hand" and 30 x 10 shows volume 600 kg. Third: Pull Up shows a "+kg" input and accepts 10.
- [ ] **Step 2: Run** `npm run e2e` Expected: FAIL.
- [ ] **Step 3: Implement** the UI. A location's bar weight and plates are editable (bar select 20 / 15 / 10 / 7 kg; plates as a comma list validated to positive numbers).
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e && npm run build` Expected: green.
- [ ] **Step 5: Commit** `feat: gym locations, per-hand load and weighted bodyweight in the logger`

---

## M2 addendum: data protection and sync foundation (owner request 2026-11-08)

Spec: `docs/plans/abot-master-plan.md` section 3.1. Added after Task 11 was complete; Tasks 12 and 13
are unchanged.

Additional Global Constraints:
- Sync never blocks the UI and never runs inside a set-tick handler.
- The only external service is Supabase, used only after the user signs in; without
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` the app shows "Cloud sync is not set up for this build" and everything else works.
- No secret keys in the repo or the client bundle; the anon key is public and RLS enforces ownership.

Additional Review Focus:
6. A row edited offline on device A and edited later on device B: after both sync, the later edit wins on both devices and the losing version is kept in `conflicts`. Test in Task 16.
7. Deleting a routine on one device must not resurrect it when another device pulls older data. Test in Task 16.

### Task 14: Ask the browser to keep ABOT data

**Files:**
- Create: `src/lib/storagePersistence.ts`, `src/lib/storagePersistence.test.ts`, `src/components/settings/StorageSection.tsx`
- Modify: `src/components/layout/StoreHydrator.tsx`, `src/app/settings/page.tsx`

**Interfaces:**
- Produces: `requestPersistentStorage(nav?: Pick<Navigator, "storage">): Promise<"persisted" | "not_persisted" | "unsupported">` (calls `persisted()` first, then `persist()` only if not already persisted).

- [ ] **Step 1: Failing tests** unsupported when `storage` or `persist` is missing; returns `"persisted"` without calling `persist()` when `persisted()` is already true; returns what `persist()` grants otherwise; a rejecting `persist()` yields `"not_persisted"`.
- [ ] **Step 2: Run** Expected: FAIL.
- [ ] **Step 3: Implement**; StoreHydrator calls it once after hydration (non-blocking); `StorageSection` shows the status in plain words plus "Ask again" when not persisted.
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e` Expected: green.
- [ ] **Step 5: Commit** `feat: request persistent storage and show its status`

### Task 15: Sync metadata, tombstones and the sync queue

**Files:**
- Modify: `src/data/repo/types.ts`, `src/data/repo/memory.ts`, `src/data/repo/dexie.ts` (schema v2), `src/data/repo/contract.test.ts`

**Interfaces:**
- Produces: `type SyncKind = "session" | "routine" | "exercise" | "location" | "settings"`; `interface SyncStatusRow { kind; id; status: "pending_sync" | "synced"; localUpdatedAt: number; lastSyncedAt: number | null }`; `interface SyncState { userId: string | null; lastPulledCursor: string | null; lastSyncedAt: number | null; phase: "signed_out" | "idle" | "syncing" | "offline" | "error"; lastError: string | null }` stored as kv `syncState`; `interface SyncRecord { kind: SyncKind; id: string; payload: unknown; updatedAt: number; deleted: boolean }`.
- `Repository` gains `sync: { pending(): Promise<SyncRecord[]>; get(kind, id): Promise<{ record: SyncRecord | null; status: SyncStatusRow | null }>; applyRemote(rec: SyncRecord): Promise<void>; markSynced(kind, id, at: number): Promise<void>; purgeTombstones(olderThan: number): Promise<number> }`.
- Behaviour: every table `put` stamps `updatedAt = Date.now()` on the stored row and marks it `pending_sync` in the same transaction; `remove` writes a tombstone (`deletedAt`) and marks it pending; `all()` excludes tombstones; kv `settings` writes mark `("settings","settings")` pending; `applyRemote` writes without marking pending and sets status `synced`. Dexie v2 adds `syncStatus: "[kind+id], status"`; existing v1 rows are marked pending on upgrade (Guest data uploads on first sign-in).

- [ ] **Step 1: Failing contract tests** (both repositories): put marks pending with `localUpdatedAt`; remove hides the row from `all()` and leaves a pending tombstone in `pending()`; `applyRemote` stores the row as `synced` and it is not in `pending()`; `markSynced` clears pending; settings writes appear in `pending()` as kind `settings`; `purgeTombstones` removes only synced tombstones older than the cutoff; Dexie upgrade from a v1 database marks existing rows pending.
- [ ] **Step 2: Run** Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e` Expected: green.
- [ ] **Step 5: Commit** `feat: sync metadata, tombstones and pending queue in the repository`

### Task 16: Two-way merge sync engine

**Files:**
- Create: `src/data/sync/types.ts`, `src/data/sync/engine.ts`, `src/data/sync/fakeRemote.ts`, `src/data/sync/engine.test.ts`

**Interfaces:**
- Consumes: `Repository.sync` (Task 15).
- Produces: `interface RemoteAdapter { pull(cursor: string | null, limit: number): Promise<{ records: (SyncRecord & { serverUpdatedAt: string })[]; cursor: string | null }>; pushIfNewer(records: SyncRecord[]): Promise<{ accepted: string[]; rejected: string[] }> }` (ids as `"kind:id"`); `syncOnce(repo: Repository, remote: RemoteAdapter, now?: number): Promise<{ pulled: number; pushed: number; conflicts: number; changedLocal: boolean }>`; `createFakeRemote(): RemoteAdapter & { rows: Map<string, ...> }` for tests.
- Merge rules exactly as in spec section 3.1 step 2; losing local versions go to kv `conflicts` (array, newest first, max 50).

- [ ] **Step 1: Failing tests**: fresh device pulls everything into an empty repo; guest data uploads on first sync; remote newer than a synced local row wins; local pending newer than remote wins and is pushed; remote newer than local pending wins and the local version lands in `conflicts` (Review Focus 6); remote tombstone deletes a synced local row; a stale remote row does not resurrect a local pending tombstone (Review Focus 7); `pushIfNewer` rejection leaves the row pending; paging across 3 pulls of 500 advances the cursor; a second `syncOnce` with no changes pulls and pushes 0.
- [ ] **Step 2: Run** Expected: FAIL.
- [ ] **Step 3: Implement** `syncOnce` (pull until cursor stops, merge, push pending, mark synced, save `syncState`).
- [ ] **Step 4: Verify** `npm run lint && npm test` Expected: green.
- [ ] **Step 5: Commit** `feat: two-way merge sync engine`

### Task 17: Supabase adapter, Google sign-in and the Backup & Sync section

**Files:**
- Create: `supabase/migrations/0001_abot_records.sql`, `src/data/sync/supabase.ts`, `src/data/sync/supabase.test.ts`, `src/store/useSyncStore.ts`, `src/components/settings/SyncSection.tsx`, `e2e/sync.spec.ts`
- Modify: `package.json` (`@supabase/supabase-js@2.119.0`), `src/app/settings/page.tsx`, `src/components/layout/StoreHydrator.tsx`, `.env.example`

**Interfaces:**
- Consumes: `RemoteAdapter`, `syncOnce`, `hydrateStores`, `getActiveRepository`.
- Produces: `isCloudSyncConfigured(): boolean`; `createSupabaseRemote(client: SupabaseLike): RemoteAdapter` (`select ... where server_updated_at > cursor order by server_updated_at limit n`, and `rpc("upsert_if_newer", { rows })`); `useSyncStore` with `phase`, `userId`, `email`, `lastSyncedAt`, `pendingCount`, `signIn()`, `signOut()`, `syncNow()`; automatic sync on start (when signed in), on the `online` event, and after `finishActive`.
- SQL: table, RLS policy, `server_updated_at` trigger, `upsert_if_newer(rows jsonb)` returning accepted/rejected keys, as in spec section 3.1.

- [ ] **Step 1: Failing tests** with a fake `SupabaseLike`: `pull` maps rows to `SyncRecord` and returns the last `server_updated_at` as cursor; `pushIfNewer` sends one RPC call with all rows and maps the result; `isCloudSyncConfigured()` false without both env vars. e2e (no env vars): Settings shows "Cloud sync is not set up for this build" and the Export button.
- [ ] **Step 2: Run** Expected: FAIL.
- [ ] **Step 3: Implement**; the sign-in button calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/settings" } })`; sign out keeps local data.
- [ ] **Step 4: Verify** `npm run lint && npm test && npm run e2e && npm run build` Expected: green. A real round trip needs the owner's Supabase project; record that as not verified.
- [ ] **Step 5: Commit** `feat: Supabase cloud sync with Google sign-in`
