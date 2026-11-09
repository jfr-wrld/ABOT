# ABOT // MISSION CONTROL: architecture spec

Audit of the codebase as of the Priority 12 branch, and what the founder console (`/admin`)
controls, where it writes, and who it affects. Keep this file current: `/sync-admin`
(`.claude/commands/sync-admin.md`) re-runs the audit and updates the matrix and the console.

## 1. Audit: what exists

### 1.1 Storage

| Layer | Where | What it holds |
| --- | --- | --- |
| IndexedDB (Dexie, db `abot`, schema v3) | `src/data/repo/dexie.ts` | tables `sessions`, `routines`, `exercises` (custom and adopted catalog copies), `locations` (gyms), `catalog` (downloaded free-exercise-db), `kv`, `syncStatus` |
| `kv` keys | `src/data/repo/types.ts` (`KvValues`) | `settings` (UserSettings incl. `entitlement`, `healthAutoSync`, `lastSleep`, `tapFeedback`), `activeWorkout`, `restTimer`, `exerciseMedia`, `bodyweightLog`, `syncState`, `conflicts`, `reminders`, `reminderState`, `migratedFromLocalStorage` |
| Repository API | `src/data/repo/types.ts` | `snapshot()`, `replaceAll()`, `mergeAll()`, per-table CRUD; in-memory twin in `memory.ts` for tests |
| Persistence bridge | `src/store/persistence.ts` | stores -> repo writes, `hydrateStores`, `runExclusive` |
| Backup file | `src/data/backup.ts` | `ABOT_BACKUP_YYYY_MM_DD.json`, schemaVersion 1, merge or replace |
| localStorage | various | remote config cache and local override, local redeem codes, dismissed banner, plate settings per unit, view modes |
| Supabase (optional) | `supabase/migrations/` | `abot_records` (cloud sync, RLS per user); from Priority 12: `app_admins`, `app_remote_config`, `redeem_codes`, `redeem_claims`, `user_entitlements`, RPCs `redeem_code`, `claim_founder`, `admin_grant`, `admin_stats`, `is_abot_admin` |

### 1.2 Feature modules

| Area | Source | Built-in data and constants |
| --- | --- | --- |
| Exercise library | `src/data/seed-exercises.generated.ts`, `src/data/exercises.ts`, `src/data/normalize.ts`, `src/store/useExerciseStore.ts`, `src/data/catalog.ts` | 88 seed exercises (muscles, equipment, `loadMode` total/per_hand/unilateral, `logType`, `isMachineDependent`); custom exercises CRUD; on-demand catalog (~800) from GitHub raw |
| Routine templates | `src/lib/seed-routines.ts` (live, `TemplateVault`) | 17 templates in 6 splits (PPL, Upper/Lower, Full Body, Calisthenics, Core, Specialized) |
| Routines | `src/store/useRoutineStore.ts` | create, rename, folder, duplicate, delete, exercises, supersets |
| Workout logger | `src/store/useWorkoutStore.ts`, `src/components/workout/*` | sets (W/N/D/F), RPE, rest timer per exercise (default 90 s), supersets and giant sets, smart swap, pause |
| Plates | `src/lib/plate-calculator.ts`, `src/data/normalize.ts` | kg plates 25 to 1.25, bars 20/15/10/0; lbs set; per gym bar and inventory (`GymLocation`) |
| Records | `src/lib/calc.ts` | heaviest weight, best 1RM (Epley), best set volume; worked out from history |
| Calories | `src/lib/calorie-estimator.ts` | MET 3.5 to 6.5 from kg/min (40 to 300) and RPE; 75 kg fallback |
| Recovery map | `src/lib/muscle-recovery.ts` | 15% / 7.5% per set, 72 h / 48 h, ready at 20%, RPE x0.75 to x1.25, sleep x0.7 to x1.1 |
| Coach Pill | `src/lib/progressive-overload.ts` | clean at RPE <= 8.5, deload at RPE >= 9.5 or falling volume, -10%, reps 8 to 12 |
| Symmetry radar | `src/lib/symmetry-analyzer.ts` | 6 axes, ideal shares, push > pull x1.25, quad:ham >= 0.75, legs >= 25%, 6 sets minimum |
| Smart swap | `src/lib/exercise-swapper.ts` | pattern matching, DB 41% / Smith 105% / machine 110% |
| Story Studio | `src/lib/story-exporter.ts`, `src/components/share/StoryCardStudio.tsx` | 11 layouts, first 2 free, watermark and founder badge |
| Health Connect | `android/.../HealthConnectPlugin.kt`, `src/lib/health-sync.ts` | write sessions + kcal, read weight and sleep, auto-sync |
| Reminders | `src/lib/notifications/*`, `src/store/useReminderStore.ts` | weekly schedule, native alarms, live workout notification |
| Gyms | `src/store/useLocationStore.ts`, `src/lib/gym-nearby.ts` | pinned gyms, auto pick within 300 m |
| Entitlements | `src/lib/entitlements.ts`, `src/store/useEntitlements.ts` | FOUNDERS_BETA / COMMERCIAL_LIVE, tiers, founder pass, simulator, plans |
| Cloud sync | `src/data/sync/*`, `src/store/useSyncStore.ts` | Google sign-in, `abot_records` push/pull |

Findings outside the console's scope: `src/data/routine-templates.ts` and
`src/components/routines/TemplatesSection.tsx` are no longer rendered (the live template list is
`seed-routines.ts` via `TemplateVault`).

### 1.3 What the founder must be able to manage

1. Business: monetization mode, prices (IDR and USD), the Home announcement, offline promo codes.
2. Licenses: generate VIP / influencer / promo codes with quotas, switch codes off, upgrade a
   buyer by email, see users, founders, active licenses.
3. Algorithm calibration: recovery, MET, Coach Pill, radar thresholds, free story layouts, gym
   radius, without a new APK.
4. Content on this device: the exercise library (custom CRUD, seeds read-only, catalog
   download), routines (CRUD, add built-in templates), gyms and plate inventory.
5. Database: snapshot inspector per table, integrity check, backup export, full reset.
6. Device diagnostics: Health Connect, notifications, cloud sync, remote config source,
   entitlement on this device.

## 2. Matrix: console module vs what it controls

Scope: **Global** changes every install (through Supabase `app_remote_config` or the license
tables; needs the build's Supabase and an admin account). **Device** changes this phone or
browser only (stores and IndexedDB, synced to the account like any user edit when signed in).

| Module | Panel | Controls (source file) | Writes to | Scope |
| --- | --- | --- | --- | --- |
| Overview | Telemetry grid | counts from `repo.snapshot()`, `admin_stats()` | read only | Device + Global |
| Monetization | Mode switch | `APP_MONETIZATION_MODE` -> `resolveEntitlement` (`lib/entitlements.ts`, `store/useEntitlements.ts`) | `app_remote_config.monetization_mode` | Global |
| Monetization | Prices | `PLANS` via `plansFor()` (`lib/entitlements.ts`), `AbotProModal` | `*_price_idr`, `*_price_usd` | Global |
| Monetization | Broadcast banner | `AnnouncementBanner` on Home | `announcement_banner` | Global |
| Monetization | Offline codes | `BUILT_IN` in `lib/redeem-service.ts` | `offline_codes_enabled` | Global |
| Licenses | Voucher generator | `generateCode`, `redeem_code()` | `redeem_codes` | Global |
| Licenses | Code table | `redeem_codes.is_active`, uses | `redeem_codes` | Global |
| Licenses | Manual upgrade | `admin_grant()` -> `user_entitlements`, pulled at the buyer's next start | `user_entitlements` | Global |
| Licenses | This device | `settings.entitlement` (`updateEntitlement`, simulator) | IndexedDB `kv.settings` | Device |
| Algorithms | Recovery, MET, Coach, Radar, Story, Gyms | `lib/tunables.ts` read by `muscle-recovery`, `calorie-estimator`, `progressive-overload`, `symmetry-analyzer`, `StoryCardStudio`, `gym-nearby` | `app_remote_config.tunables` | Global |
| Exercise CMS | Library | `useExerciseStore` (`addCustom`, `updateCustom`, `removeCustom`), seeds read-only, catalog `loadCatalog` | IndexedDB `exercises`, `catalog` | Device |
| Routine CMS | Routines and templates | `useRoutineStore`, `templateToRoutine` (`lib/seed-routines.ts`) | IndexedDB `routines` | Device |
| Routine CMS | Gyms and plates | `useLocationStore` (bar, plate inventory, default) | IndexedDB `locations` | Device |
| Database | Snapshot inspector | `repo.snapshot()` per table, JSON | read only | Device |
| Database | Integrity check | `lib/db-inspect.ts` | read only | Device |
| Database | Export / reset | `backupFromSnapshot`, `repo.replaceAll(empty)` then `hydrateStores` | IndexedDB (all) | Device |
| Device | Diagnostics | Health Connect `HealthSyncService.status()`, reminders permission, sync phase, remote config source and refresh | read, refresh | Device |

## 3. Security model

- The PIN (`NEXT_PUBLIC_ABOT_ADMIN_PIN`, default `2026`) only hides the page: it ships inside
  the static bundle.
- Every Global write goes through Supabase and is checked by RLS or a security definer function
  against `app_admins` (the signed-in Google email). Without that, Global panels are read only
  and say why.
- Without Supabase in the build, Global panels run in **local mode**: the remote config is a
  local override and codes live on this device. It is a preview; nobody else is affected.
- Codes made in the console are validated online only. Built-in offline codes are in every copy
  of the app (as SHA-256 hashes) and can be switched off remotely.
- Entitlements on the device are client state, editable by a determined user; `user_entitlements`
  on the server is the record of truth for paid access once payments are connected.

## 4. Layout

- Desktop (lg and up): sidebar of modules on the left, panels in a two-column grid on the right.
- Phone (APK): a horizontal module bar under the header, one column.
- Matte Obsidian `#09090b` page, Carbon `#121215` panels, Volt `#ccff00` for live / primary,
  Cyan `#00f0ff` for device-scope tags, `font-mono tabular-nums` for every number and code.
- Entry: `/admin`, or five taps on `ABOT vX // TELEMETRY BUILD` at the foot of Settings.
