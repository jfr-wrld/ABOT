# ABOT feature inventory, user flows, friction and gaps (codebase research, 2026-11-10)

Sources are repository file paths (relative to `/home/user/ABOT`). e2e test titles quoted come from `e2e/*.spec.ts` and describe flows the suite exercises.

## 1. Per screen/route: what the user can do

### Takeaway
ABOT has 24 page routes: Home, Workout (+ summary), Routines (+ editor, Template Vault), Exercises (+ detail), History (single workout by id), Progress (+ trend, muscles, calendar), Profile (+ edit), Phase (+ setup, fuel), Settings, Admin (Mission Control), Onboarding, Permissions, Login, Privacy, Terms. There is no standalone full workout-history list page.

### Cited Findings
- Route list: `exercises`, `exercises/detail`, `permissions`, `admin`, `history`, `profile`, `profile/edit`, `progress`, `progress/trend`, `progress/muscles`, `progress/calendar`, `/` (home), `settings`, `routines`, `routines/edit`, `terms`, `login`, `phase`, `phase/fuel`, `phase/setup`, `onboarding`, `privacy`, `workout`, `workout/summary` — [src/app/**/page.tsx](src/app)
- Detail pages take ids from the query string (`?id=`) so the app can be statically exported for Android — [src/lib/routes.ts](src/lib/routes.ts)
- **Home**: week strip, "Next up" routine (saved routine offered first, empty start beside it), weekly volume vs last week, "{done} of {target} planned sessions this week", muscle recovery card (with Health Connect sleep note), "Continue workout" when active, Recent workouts (last 10 only, `slice(0, 10)`), streak flame tap replays animation, announcement banner, gym tag — [src/components/home/HomeDashboard.tsx](src/components/home/HomeDashboard.tsx); [src/lib/home.ts](src/lib/home.ts); [e2e/home.spec.ts](e2e/home.spec.ts); [e2e/streak.spec.ts](e2e/streak.spec.ts)
- **Workout** (logger): see section 2 — [src/app/workout/page.tsx](src/app/workout/page.tsx)
- **Workout summary**: duration, volume, sets, exercises, muscles worked, "Volume vs last {routine}", calorie estimate (MET), send to Health Connect, share as .tcx (Strava, Garmin, Huawei), Share story, rename, add workout photos, tag gym, "Save as routine" — [src/app/workout/summary/page.tsx](src/app/workout/summary/page.tsx); [e2e/share.spec.ts](e2e/share.spec.ts); [e2e/health.spec.ts](e2e/health.spec.ts); [e2e/workout-photos.spec.ts](e2e/workout-photos.spec.ts)
- **History** (`/history?id=`): one past workout — rename, delete, Repeat, fold/unfold sets per exercise, records, share of volume per exercise, share story, save as routine; unknown id shows not-found — [src/app/history/page.tsx](src/app/history/page.tsx); [e2e/history.spec.ts](e2e/history.spec.ts); [e2e/session-actions.spec.ts](e2e/session-actions.spec.ts)
- **Routines**: My Routines with optional folders (e.g. Push / Pull / Legs), create/duplicate/delete, start (blocked while a workout is active), Template Vault tab — [src/components/routines/RoutineLibrary.tsx](src/components/routines/RoutineLibrary.tsx); [e2e/routines.spec.ts](e2e/routines.spec.ts)
- **Routine editor**: name, folder by split, add exercise, sets with set type, target weight and target reps per set, rest, reorder, superset/giant set builder; "Changes save as you type" — [src/app/routines/edit/page.tsx](src/app/routines/edit/page.tsx)
- **Template Vault**: 17 single-session templates across splits ppl (6), upper_lower (2), full_body (3), calisthenics (2), core (1), specialized (3); filter by split, estimated time, muscles, "Fits your {phase}" badge, Start or Save to My Routines (editable copy) — [src/lib/seed-routines.ts](src/lib/seed-routines.ts); [src/components/routines/TemplateVault.tsx](src/components/routines/TemplateVault.tsx); [e2e/templates.spec.ts](e2e/templates.spec.ts)
- **Exercises library**: 138 bundled seed exercises with photos; filter by muscle and equipment (keyboard-accessible dropdowns), list/grid toggle remembered, grouped by muscle; create custom exercise (load mode, bodyweight, muscles, equipment); optional on-demand catalog download of ~870 exercises from free-exercise-db (pinned commit, GitHub raw) — [src/data/seed-exercises.generated.ts](src/data/seed-exercises.generated.ts); [src/data/catalog.ts](src/data/catalog.ts); [e2e/exercises.spec.ts](e2e/exercises.spec.ts); [e2e/catalog.spec.ts](e2e/catalog.spec.ts)
- **Exercise detail**: tabs Summary / History / How to; quick stats (Heaviest, Best e1RM, Most reps, Workouts, Last done); "Estimated 1RM over time (Epley)" chart; records per gym; motion photos looping, video tab (search links, custom video URL validation, offline notice), anatomy tab; start a workout with it / add to workout; edit/delete custom — [src/app/exercises/detail/page.tsx](src/app/exercises/detail/page.tsx); [src/components/exercise/RecordsSummary.tsx](src/components/exercise/RecordsSummary.tsx); [e2e/media.spec.ts](e2e/media.spec.ts); [e2e/exercise-card.spec.ts](e2e/exercise-card.spec.ts)
- **Profile**: photo (resized on device), name, handle, 12-week volume, streak, tabs Lifts / Progress; Lifts board ranks top lifts by best e1RM with "×body weight" and a filter by focus — [src/app/profile/page.tsx](src/app/profile/page.tsx); [src/components/profile/LiftsBoard.tsx](src/components/profile/LiftsBoard.tsx); [e2e/profile.spec.ts](e2e/profile.spec.ts)
- **Profile edit**: name, height (cm or ft/in), weigh-in log (same-day update, delete, range validation), account section/sign-in — [e2e/profile.spec.ts](e2e/profile.spec.ts); [src/components/profile/BodyweightSection.tsx](src/components/profile/BodyweightSection.tsx)
- **Phase** (`/phase`, `/phase/setup`, `/phase/fuel`): see section 6 — [src/app/phase](src/app/phase)
- **Settings**: Preferences (weight unit, default rest, rest alert, RPE column, week start, language auto/en/id, theme system/dark/light, visual effects auto/full/lite, sounds & vibration), Backup & sync, Health apps, Gyms, Workout reminders, Live capsule, Storage protection status, Billing / Founder pass, App update, Support / contact, "Follow ABOT" social links marked "Soon" — [src/components/settings/SettingsHome.tsx](src/components/settings/SettingsHome.tsx); [src/components/settings/sections.tsx](src/components/settings/sections.tsx); [e2e/settings.spec.ts](e2e/settings.spec.ts)
- **Admin / Mission Control** (hidden entry + PIN): modules Overview, Monetization (mode, prices, banner), Licenses (redeem codes: 1-year Pro, 30-day influencer trial, Lifetime, Founder pass; refund/expire), Algorithms (tunables calibration), Exercises CMS, Routines & gyms, Database tools, Device — [src/app/admin/page.tsx](src/app/admin/page.tsx); [src/components/admin](src/components/admin); [e2e/admin.spec.ts](e2e/admin.spec.ts)
- **Onboarding**: one-time intro with Next and swipe, Skip intro, then a permissions step ("Each one turns on a feature"), fits 360-class screens without scrolling — [src/app/onboarding/page.tsx](src/app/onboarding/page.tsx); [e2e/onboarding.spec.ts](e2e/onboarding.spec.ts)
- **Login**: Google sign-in only when the build has Supabase; "Continue without an account"; returns to origin on cancel/finish — [src/app/login/page.tsx](src/app/login/page.tsx); [e2e/sync.spec.ts](e2e/sync.spec.ts)

### Inferences
- Past workouts older than the 10 most recent are reachable only through the calendar (`/progress/calendar`) or an exercise's History tab; there is no searchable/filterable history feed.
- Templates are single sessions, not multi-week programs.

### Gaps
- Did not render the UI; all statements come from code and e2e test titles.

## 2. Logger (active workout)

### Takeaway
The logger is feature-rich (set types, RPE, supersets/giant sets, plate calculator, bodyweight/assisted load, variations, notes, swipe delete, autofill, swap, next-exercise suggestions, Coach Pill, pause/adjust start, live notification). Missing: duration/distance inputs for cardio/timed exercises, myo-reps, warm-up generator, voice logging, session-level notes.

### Cited Findings
- Set types: `warmup | normal | dropset | failure` (myorep planned in master plan but not in type) — [src/types/workout.ts](src/types/workout.ts); [docs/plans/abot-master-plan.md](docs/plans/abot-master-plan.md) §8.1
- Set row columns: Set (type chip), Prev, Weight, Reps, optional RPE, Done — grid `44px minmax(0,1fr) 60px 44px [40px] 44px` — [src/components/workout/setGrid.ts](src/components/workout/setGrid.ts)
- RPE 6–10 in 0.5 steps, column toggleable in Settings — [src/components/workout/SetRow.tsx](src/components/workout/SetRow.tsx); [e2e/settings.spec.ts](e2e/settings.spec.ts)
- Prev column shows last values (incl. "BW+x × reps"); tapping fills weight/reps/RPE; completing an empty set falls back to previous values; placeholders show previous — [src/components/workout/SetRow.tsx](src/components/workout/SetRow.tsx)
- Completing without reps refused with inline message — [e2e/logger.spec.ts](e2e/logger.spec.ts)
- Rest timer starts on set completion (default 1:30, per-exercise rest, +15s / −15s / skip), pips 3-2-1 then rings, sits above dock within thumb reach — [e2e/logger.spec.ts](e2e/logger.spec.ts); [e2e/effects.spec.ts](e2e/effects.spec.ts); [e2e/workout-tools.spec.ts](e2e/workout-tools.spec.ts)
- Plate calculator: barbell exercises only, follows the gym's bar weight and plate inventory, fills the set — [src/components/workout/PlateCalculatorModal.tsx](src/components/workout/PlateCalculatorModal.tsx); [e2e/plates.spec.ts](e2e/plates.spec.ts)
- Supersets / giant sets: labelled A1/A2/A3, no rest hand-off, rest after the last exercise, scroll to next; built in logger or routine editor and carried into workouts — [src/lib/superset.ts](src/lib/superset.ts); [e2e/exercise-extras.spec.ts](e2e/exercise-extras.spec.ts); [e2e/routines.spec.ts](e2e/routines.spec.ts)
- Load modes `total | per_hand | unilateral` (per-hand/unilateral volume ×2); bodyweight exercises count body weight plus added load or minus assistance (`assisted`, `bodyLoadKg` snapshot) — [src/types/workout.ts](src/types/workout.ts); [src/data/bodyweight-load.ts](src/data/bodyweight-load.ts); [e2e/bodyweight.spec.ts](e2e/bodyweight.spec.ts); [e2e/locations.spec.ts](e2e/locations.spec.ts)
- Variation per exercise (chosen on card, kept in history); exercise notes ("Seat height, grip, cues") — [e2e/exercise-extras.spec.ts](e2e/exercise-extras.spec.ts); [src/components/workout/ExerciseExtras.tsx](src/components/workout/ExerciseExtras.tsx)
- Swipe left to delete a set; short swipe springs back; added set copies last set's numbers — [e2e/exercise-extras.spec.ts](e2e/exercise-extras.spec.ts)
- Replace exercise (keeps typed values, similar ones first: "Same movement / Same muscle · n% match"); PRO Smart swap with equipment profile and weight conversion (DB ~41% per hand, Smith 105%, machines 110%) — [src/lib/exercise-swapper.ts](src/lib/exercise-swapper.ts); [src/components/workout/ExerciseSwapModal.tsx](src/components/workout/ExerciseSwapModal.tsx); [e2e/workout-tools.spec.ts](e2e/workout-tools.spec.ts); [e2e/coaching.spec.ts](e2e/coaching.spec.ts)
- Next-exercise suggestions: "For {muscle}, not trained yet today" / "Still to train today · {routine}" from the routine or the routine due today — [src/lib/exercise-suggest.ts](src/lib/exercise-suggest.ts); [src/components/workout/SessionActions.tsx](src/components/workout/SessionActions.tsx)
- Reorder exercises (sheet), how-to sheet from name tap, photo + equipment icon per exercise, picker with photo grid and muscle icons — [e2e/workout-tools.spec.ts](e2e/workout-tools.spec.ts); [e2e/howto.spec.ts](e2e/howto.spec.ts)
- Header: workout name, duration, pause/resume clock, adjust start time, volume, sets, gym tag, live muscle map filling as sets are ticked — [src/components/workout/ActiveWorkoutHeader.tsx](src/components/workout/ActiveWorkoutHeader.tsx); [e2e/session-actions.spec.ts](e2e/session-actions.spec.ts)
- Live PR detection while logging (PR kinds: heaviest_weight, best_1rm (Epley), best_set_volume; no rep-PR kind); records per gym for machine exercises — [src/types/workout.ts](src/types/workout.ts); [src/lib/calc.ts](src/lib/calc.ts); [docs/plans/abot-master-plan.md](docs/plans/abot-master-plan.md) §1.3
- Finish dialog: unmarked sets warning + "Mark all remaining as done", PR list; Discard with confirm — [src/components/workout/FinishDialog.tsx](src/components/workout/FinishDialog.tsx); [e2e/logger.spec.ts](e2e/logger.spec.ts)
- Post-finish: first workout of a week triggers Streak moment (flame + sound) then summary; heavier repeat celebrates the record vs last time — [src/lib/streak-moment.ts](src/lib/streak-moment.ts); [e2e/streak.spec.ts](e2e/streak.spec.ts); [e2e/share.spec.ts](e2e/share.spec.ts)
- Sounds/haptics: latch on tick, record chord, power-on glide, closing chord (toggle "Sounds & vibration") — [src/lib/sound-effects.ts](src/lib/sound-effects.ts); [e2e/effects.spec.ts](e2e/effects.spec.ts)
- Android live notification / status-bar capsule (workout clock or rest-only, next set or volume line, buttons) via native WorkoutLiveService; in-app Dynamic Island bar "Set {n} of {of}", "Next: {name}, no rest" — [src/lib/live-capsule.ts](src/lib/live-capsule.ts); [src/components/layout/DynamicIsland.tsx](src/components/layout/DynamicIsland.tsx); [e2e/island.spec.ts](e2e/island.spec.ts)
- Active workout survives reload; second tab waits and takes over cleanly; logging works offline — [e2e/logger.spec.ts](e2e/logger.spec.ts); [e2e/tabs.spec.ts](e2e/tabs.spec.ts); [src/lib/tabLock.ts](src/lib/tabLock.ts); [e2e/local-first.spec.ts](e2e/local-first.spec.ts)
- `logType` (`reps_only | duration | distance_duration`) and `durationSec` / `distanceM` exist on the model, but no component reads `logType` and `SetRow` has no duration or distance input — [src/types/workout.ts](src/types/workout.ts); [src/components/workout/SetRow.tsx](src/components/workout/SetRow.tsx) (grep of `logType` in `*.tsx` returns nothing)
- No warm-up generator code exists (grep for warmup generator/calculator returns nothing), although M3 in the master plan lists "warm-up generator" — [docs/plans/abot-master-plan.md](docs/plans/abot-master-plan.md) §8
- Voice logger: listed as PRO feature `voice_handsfree_logger`, but status "Not started" and no SpeechRecognition code — [docs/plans/NEXT_FEATURES_SPEC.md](docs/plans/NEXT_FEATURES_SPEC.md); [src/lib/entitlements.ts](src/lib/entitlements.ts)
- `WorkoutSession.notes` exists but only per-exercise notes have a setter (`setExerciseNotes`); no session-level note UI found — [src/store/useWorkoutStore.ts](src/store/useWorkoutStore.ts); [src/types/workout.ts](src/types/workout.ts)

### Inferences
- Cardio/timed exercises (planks, runs, rows) can be added but cannot be logged by time or distance in the UI; the Coach Pill also skips timed/distance exercises.
- The paywall advertises a voice logger that does not exist, a credibility risk once COMMERCIAL_LIVE is on.

### Gaps
- Did not verify whether keyboard numpad/quick-step toolbar (M4) exists; no component named for it was found.

## 3. Programs and progression

### Takeaway
There is automatic per-exercise progression (Coach Pill, double progression + deload, phase-aware) and phase-level deload weeks, plus a weekly schedule with reminders. There are no multi-week program templates, periodized blocks beyond body phases, or rep-range targets on routines.

### Cited Findings
- Coach Pill: reads last 3 sessions; clean session → +2.5 kg (lower-body compounds) or +5 kg when RPE ≤7; else double progression to 12 reps then smallest jump and back to 8; deload −10% on falling volume, high RPE with missed reps, or 3 stalled sessions; lbs users get 5/10 lb jumps; APPLY fills remaining sets — [src/lib/progressive-overload.ts](src/lib/progressive-overload.ts); [src/components/workout/OverloadBanner.tsx](src/components/workout/OverloadBanner.tsx); [e2e/coaching.spec.ts](e2e/coaching.spec.ts)
- Phase modifies coaching: cut holds weight at RPE ≥8.5, bulk adds weight/extra set when recovered, strength peak moves compounds to 3–5 reps — [src/lib/progressive-overload.ts](src/lib/progressive-overload.ts)
- Phase setup: "Deload every {n} weeks", "Deload week: lighter loads", block progress W{week}/{of}; durations 4/6/8/12/16 weeks — [src/lib/phase-engine.ts](src/lib/phase-engine.ts); [src/app/phase/setup/page.tsx](src/app/phase/setup/page.tsx); [src/components/analytics/ProgressPanel.tsx](src/components/analytics/ProgressPanel.tsx)
- Weekly schedule: training days, session time, routine per day, "pack your bag" pre-alarm, test reminder with Start and Snooze, fires when closed, export as weekly .ics calendar — [src/lib/notifications/schedule.ts](src/lib/notifications/schedule.ts); [src/components/settings/WorkoutReminderSettings.tsx](src/components/settings/WorkoutReminderSettings.tsx); [e2e/reminders.spec.ts](e2e/reminders.spec.ts)
- Routine targets are per-set `targetWeightKg` and `targetReps` only; `targetRepRange` from the plan is not in `RoutineSet` — [src/types/workout.ts](src/types/workout.ts); [docs/plans/abot-master-plan.md](docs/plans/abot-master-plan.md) §8.1
- Finished workout → "Save as routine" (lifts, order, rest, notes, supersets, variations; done sets as targets) — [src/lib/session-routine.ts](src/lib/session-routine.ts); [e2e/session-actions.spec.ts](e2e/session-actions.spec.ts)

### Inferences
- Routine post-session sync (updating a routine's targets from what was lifted, a Hevy parity item in master plan §4.4) appears only as "Save as routine" (new copy), not as "update routine" prompt.
- No program marketplace or multi-week template (e.g. 5/3/1, GZCL, nSuns) exists.

### Gaps
- Did not confirm whether the Coach Pill's suggestion writes back into the routine.

## 4. Analytics

### Takeaway
Analytics cover weekly volume/workouts/time trends, sets per muscle (this week / last n weeks), calendar, e1RM chart per exercise, lifetime top lifts, recovery heat map, 6-axis symmetry radar, and period totals with % change. No year-in-review / monthly recap, no body-weight-vs-strength chart outside phase page, no per-muscle volume trend over time chart.

### Cited Findings
- Progress panel: range tabs, hero with change vs previous period ("first period on record" when none), streak, weeks trained, sets per muscle this week, body phase tile, share — [src/components/analytics/ProgressPanel.tsx](src/components/analytics/ProgressPanel.tsx); [src/lib/progress.ts](src/lib/progress.ts); [e2e/progress.spec.ts](e2e/progress.spec.ts)
- Trend page: Volume / Workouts / Time per week, last n weeks — [src/app/progress/trend/page.tsx](src/app/progress/trend/page.tsx)
- Muscles page: sets per muscle, this week or last n weeks (primary 1, secondary 0.5) — [src/app/progress/muscles/page.tsx](src/app/progress/muscles/page.tsx); [src/lib/symmetry-analyzer.ts](src/lib/symmetry-analyzer.ts)
- Calendar: months, days link to workouts — [src/components/analytics/WorkoutCalendar.tsx](src/components/analytics/WorkoutCalendar.tsx)
- e1RM over time per exercise (Epley) — [src/app/exercises/detail/page.tsx](src/app/exercises/detail/page.tsx)
- Recovery map: front/back SVG, fatigue 15% primary / 7.5% secondary per working set scaled by RPE, linear recovery 72h big / 48h small muscles, sleep from Health Connect scales speed, phase scales recovery — [src/lib/muscle-recovery.ts](src/lib/muscle-recovery.ts); [src/components/anatomy/RecoveryMap.tsx](src/components/anatomy/RecoveryMap.tsx); [e2e/recovery.spec.ts](e2e/recovery.spec.ts)
- Symmetry radar: push/pull/knee/hip/arms/core, balance score, suggestions "add ≥2 sets" — [src/lib/symmetry-analyzer.ts](src/lib/symmetry-analyzer.ts); [src/components/progress/SymmetryRadarCard.tsx](src/components/progress/SymmetryRadarCard.tsx)
- Phase page: scale weight vs trend weight, relative strength (needs squat/bench/deadlift/press + weigh-in) — [src/app/phase/page.tsx](src/app/phase/page.tsx)
- Training focus labels (Push/Pull/Legs/Upper/Lower/Full body/Cardio) derived from sets — [src/lib/training-focus.ts](src/lib/training-focus.ts)

### Inferences
- "Recaps" exist only as per-workout summary/story and per-range story; there is no monthly or yearly recap.
- EMA trendlines and sparklines on exercise cards (M3 plan) were not found.

### Gaps
- Did not inspect chart component internals for tooltips/interaction.

## 5. Social and sharing

### Takeaway
Sharing is image-export only: Story Card Studio (11 presets, 1080×1920 PNG, photo backgrounds, Web Share) and Streak Studio (12 themes). No feed, friends, follows, comments, leaderboards, or shared routine links.

### Cited Findings
- Story presets: Obsidian Raw, Thermal Matrix, Brutalist Receipt, Cyber-Volt HUD, Monochrome Steel, PR Trophy Vault, Photo Backdrop, Split Spec Sheet, Loaded Bar, Plate Grid, Volt Poster — [src/lib/story-exporter.ts](src/lib/story-exporter.ts)
- Studio: 1080×1920 PNG download, background from camera/gallery/workout photos, overlay and grayscale, system share sheet, works offline, carries username — [src/components/share/StoryCardStudio.tsx](src/components/share/StoryCardStudio.tsx); [e2e/share.spec.ts](e2e/share.spec.ts)
- Progress range can be shared as story ("eight layouts") — [e2e/progress.spec.ts](e2e/progress.spec.ts)
- Streak shared as story card in twelve themes — [src/lib/streak-card.ts](src/lib/streak-card.ts); [e2e/streak.spec.ts](e2e/streak.spec.ts)
- Social links in Settings marked "Soon" — [src/components/settings/SettingsHome.tsx](src/components/settings/SettingsHome.tsx)
- `src/lib/social.ts` exists (social link data) — [src/lib/social.ts](src/lib/social.ts)

### Inferences
- Routine sharing (export/import a single routine as link/QR) is absent.

### Gaps
- Did not read `src/lib/social.ts` fully.

## 6. Body metrics, nutrition/phase, Health Connect, cloud sync, import/export, gyms

### Takeaway
Strong local-first data story: Dexie/IndexedDB, JSON backup (with photos), Hevy/Strong CSV import, Supabase two-way sync, Health Connect write/read, TCX export, gyms with plate inventory and GPS auto-pick. Body metrics are weight (+ optional body fat %, waist via phase page); no body progress photos or other circumference measurements.

### Cited Findings
- Weigh-ins: history, same-day update, delete, range validation; optional body fat % and waist from the phase page ("Add body fat and waist") — [src/components/profile/BodyweightSection.tsx](src/components/profile/BodyweightSection.tsx); [src/app/phase/page.tsx](src/app/phase/page.tsx); [src/types/workout.ts](src/types/workout.ts)
- Body phases CUTTING/BULKING/RECOMP/STRENGTH_PEAK; setup wizard (sex, age, height, activity, target weight, rate) → daily kcal/macros (Mifflin-St Jeor), trend weight, "Today, training day/rest day" — [src/lib/phase-engine.ts](src/lib/phase-engine.ts); [e2e/phase.spec.ts](e2e/phase.spec.ts)
- Fuel page: food guide (Indonesian-friendly foods, USDA values, portion by eye, fullness, digestion), meals sized to target, swap foods, protein (+25 g) and water (+500 ml) pacer — [src/lib/nutrition-guide.ts](src/lib/nutrition-guide.ts); [src/app/phase/fuel/page.tsx](src/app/phase/fuel/page.tsx); [src/store/useFuelPacer.ts](src/store/useFuelPacer.ts)
- Nutrition is a guide + protein/water counter; no full food diary/barcode/calorie logging found — inferred from [src/app/phase/fuel/page.tsx](src/app/phase/fuel/page.tsx) strings
- Health Connect (Android): writes finished workout as weightlifting session with estimated calories (idempotent by id); reads latest weigh-in and last night's sleep; auto-sync toggle; links Google Fit / Samsung / Huawei via HC — [src/lib/health-sync.ts](src/lib/health-sync.ts); [src/components/settings/HealthSyncCard.tsx](src/components/settings/HealthSyncCard.tsx)
- Calories: MET 3.5–6.5 from volume density and RPE; no heart rate — [src/lib/calorie-estimator.ts](src/lib/calorie-estimator.ts)
- TCX export for Strava/Garmin/TrainingPeaks — [src/lib/tcx.ts](src/lib/tcx.ts)
- Storage: Dexie repository + memory repo, migration from localStorage, `navigator.storage.persist()` status — [src/data/repo](src/data/repo); [src/lib/storagePersistence.ts](src/lib/storagePersistence.ts); [e2e/migration.spec.ts](e2e/migration.spec.ts)
- Cloud sync: Supabase, Google sign-in, guest data uploaded on sign-in, two-way merge, failure surfaced on Profile — [src/data/sync/engine.ts](src/data/sync/engine.ts); [src/data/sync/supabase.ts](src/data/sync/supabase.ts); [e2e/sync.spec.ts](e2e/sync.spec.ts)
- JSON backup export/import (replace), 50 MB cap, workout photos included; Hevy and Strong CSV import with preview, unit prompt, exercise matching — [src/data/backup.ts](src/data/backup.ts); [src/lib/data-portability.ts](src/lib/data-portability.ts); [e2e/backup.spec.ts](e2e/backup.spec.ts); [e2e/csv-import.spec.ts](e2e/csv-import.spec.ts)
- Workout photos stay on phone, go into backups, not synced — [src/components/workout/WorkoutPhotos.tsx](src/components/workout/WorkoutPhotos.tsx)
- Gyms: name, bar weight, plate inventory, default; "Find gyms near me" via OpenStreetMap Overpass/Nominatim (only on tap); pin to current location (300 m radius) auto-picks gym at workout start; machine records and previous sets per gym — [src/lib/nearby-gyms.ts](src/lib/nearby-gyms.ts); [src/lib/gym-nearby.ts](src/lib/gym-nearby.ts); [src/components/settings/LocationsSection.tsx](src/components/settings/LocationsSection.tsx); [src/components/layout/AutoGym.tsx](src/components/layout/AutoGym.tsx); [e2e/locations.spec.ts](e2e/locations.spec.ts)
- Android in-app update from GitHub Releases — [src/lib/app-update.ts](src/lib/app-update.ts); [src/components/update/UpdateCenter.tsx](src/components/update/UpdateCenter.tsx)
- i18n: English + Indonesian — [src/i18n](src/i18n)

### Inferences
- Multi-angle body check-in with ghost overlay (master plan §5.4, M4) is not implemented: no BodyCheckin type or component found.
- No CSV export (only JSON backup and TCX).

### Gaps
- Did not verify whether Health Connect reads heart rate or steps; code reads only weight and sleep.

## 7. Monetization (PRO gating)

### Takeaway
Currently FOUNDERS_BETA: all PRO open, every install stamped Founder. In COMMERCIAL_LIVE, 8 PRO feature keys gate coaching/telemetry/story extras/phases; logging, routines, records, sync and Health Connect stay free.

### Cited Findings
- Modes FOUNDERS_BETA (default) / COMMERCIAL_LIVE via build env; tiers free/pro/lifetime; release builds trust only account (server) licences — [src/lib/entitlements.ts](src/lib/entitlements.ts)
- PRO keys: progressive_overload_coach, symmetry_radar_telemetry, thermal_recovery_inspector, voice_handsfree_logger, smart_exercise_swap, story_studio_pro_presets, remove_story_watermark, body_phase_protocols — [src/lib/entitlements.ts](src/lib/entitlements.ts)
- Matrix: Core = logging/routines/records, recovery "Map only", radar "Radar only", 2 story presets, cloud + Health Connect sync; Pro = coach, inspector, diagnostics, 11 presets + no watermark, voice logger, body phases — [src/lib/entitlements.ts](src/lib/entitlements.ts) `PRO_MATRIX`
- Default prices: IDR 29,000/mo, 199,000/yr, 798,000 lifetime; USD 2.99 / 19.99 / 79.98; remotely changeable — [src/lib/remote-config.ts](src/lib/remote-config.ts)
- Midtrans checkout through Supabase Edge Functions; redeem codes; refund/expire in admin — [src/lib/checkout.ts](src/lib/checkout.ts); [src/lib/redeem-service.ts](src/lib/redeem-service.ts); [docs/payments-setup.md](docs/payments-setup.md)
- Free-locked flow: Coach Pill, radar and PRO story layouts open the paywall — [e2e/pro.spec.ts](e2e/pro.spec.ts)

### Inferences
- PRO value relies partly on an unbuilt feature (voice logger).

### Gaps
- None material.

## 8. Gaps and friction vs typical loggers; unfinished plan items

### Takeaway
Main absences: timed/distance set logging, warm-up calculator, myo-reps, rep PRs, voice logger, multi-week programs, routine update-after-workout, full history list/search, session notes, body progress photos, recaps, home-screen widgets, Wear OS, social feed, CSV export. No TODO/FIXME comments in `src`.

### Cited Findings
- No TODO/FIXME comments found by grep in `src/` (only false hits on "XXX"-like text) — grep over [src](src)
- No widget / Wear OS code (grep "widget", "Wear OS" no relevant hits) — [src](src); [android](android)
- No interval/EMOM/AMRAP/tabata timer (grep hits only unrelated intervals) — [src/lib](src/lib)
- NEXT_FEATURES Phase 2 #6 voice logger "Not started" — [docs/plans/NEXT_FEATURES_SPEC.md](docs/plans/NEXT_FEATURES_SPEC.md)
- Master plan items not found in code: warm-up generator, myo-reps, Rep PR, EMA trendlines, sparklines + post-exercise feedback pills (easy/joint), quick-step toolbar/numpad + per-set timing, body check-in 3 poses + ghost overlay, ZIP photo export, routine post-session sync — [docs/plans/abot-master-plan.md](docs/plans/abot-master-plan.md) §4, §5, §8 (absence verified by grep for warmup/myorep/rep_pr/checkin)
- Home Recent shows 10 workouts; History page requires an id — [src/components/home/HomeDashboard.tsx](src/components/home/HomeDashboard.tsx); [src/app/history/page.tsx](src/app/history/page.tsx)
- Catalog exercises need a network download from GitHub raw (exception to zero-network) — [src/data/catalog.ts](src/data/catalog.ts)

### Inferences
- Highest-leverage friction: (1) cardio/timed logging gap, (2) finding old workouts, (3) routines don't learn from completed sessions, (4) PRO promises voice logging that does not exist.
- Retention features commonly in Hevy/Strong/Fitbod that ABOT lacks: monthly/yearly recap, widgets, watch app, social feed, shareable routines.

### Gaps
- Did not inspect `android/` native code beyond names referenced in TS (HealthConnectPlugin, LiveWorkoutPlugin/WorkoutLiveService); a widget could theoretically exist there, but no TS references were found.
