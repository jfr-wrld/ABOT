# ABOT: Next Features Spec

Palette: Tactile Industrial Luxury (`#09090b` Matte Obsidian, `#121215` Carbon Surface,
`#ccff00` Volt, `#00f0ff` Cyan, `#f59e0b` Amber, `#ef4444` Crimson). Every number uses
`font-mono tabular-nums`. Everything runs on the device: no runtime network calls.

## Phase 2: status

| Priority | Feature | Status |
| --- | --- | --- |
| 1 | Plate calculator and barbell visualizer | Shipped (jfr-wrld/ABOT#7) |
| 2 | Tactile audio synthesizer and graduated haptics | Shipped (jfr-wrld/ABOT#8) |
| 3 | Smart superset and giant set grouping | Shipped (jfr-wrld/ABOT#9) |
| 4 | Data portability: JSON backup, Hevy and Strong CSV import | Shipped (jfr-wrld/ABOT#10) |
| 5 | Anterior / posterior thermal recovery map | Shipped (jfr-wrld/ABOT#11) |
| 6 | Hands-free voice logger (Web Speech API) | Not started |
| 7 | Native health sync (Health Connect, calories, TCX) | Shipped (jfr-wrld/ABOT#12) |

---

# Phase 3: Smart Coaching Intelligence & Cockpit Telemetry

## PRIORITY 8: Auto-Progressive Overload Engine ("The Coach Pill")

**Objective:** read the local history to suggest next session's weight or reps for each
exercise, so the lifter keeps progressing and backs off before a plateau.

### 8.1 Progression algorithm (`src/lib/progressive-overload.ts`)
- Read the **last 3 sessions** of the exercise (same gym for machine exercises), skipping the
  workout in progress. Working sets only: no warm-ups, no drop sets.
- **Load upgrade.** The last session was clean: every set at the top weight reached the same
  reps, no failure set, average RPE 8.5 or less when logged.
  - Lower-body compounds on a barbell, Smith machine or machine (quads, hamstrings, glutes,
    back): **+2.5 kg**, or **+5 kg** when it felt easy (RPE 7 or less). Pounds: +5 lb / +10 lb.
  - Upper body, isolation and dumbbells (chest, shoulders, biceps, triceps): double
    progression. **+1 rep** (+2 when easy) at the same weight up to 12 reps, then the smallest
    loadable jump (**+2.5 kg**, **+1 kg** on dumbbells under 20 kg) and back to 8 reps.
  - Bodyweight and reps-only exercises: +1 or +2 reps.
- **Stagnation and deload (fatigue protection).** Any of: volume fell three sessions in a row;
  the last two sessions averaged RPE 9.5 or more with missed reps; three sessions at the same
  weight with none clean. Recommend **-10%**, rounded down to a loadable weight.
- No suggestion without history, for timed or distance exercises, or after a session that
  was neither clean nor a reason to deload.

### 8.2 UI (`src/components/workout/OverloadBanner.tsx`)
- A compact pill under the exercise name in the active workout, on black in every theme:
  - **Load (Volt `#ccff00`):** `OVERLOAD TARGET: 82.5 KG × 8 (+2.5 KG) [ APPLY ]`
  - **Reps (Cyan `#00f0ff`):** `VOLUME TARGET: 80 KG × 10 (+2 REPS) [ APPLY ]`
  - **Deload (Amber `#f59e0b`):** `CNS FATIGUE: DELOAD: 72.5 KG × 5 (-10%) [ APPLY ]`
- **APPLY** plays the mechanical tick with its haptic (`feedback.tick()`, which honours the
  Sounds & vibration setting) and writes the weight and reps into every working set not yet
  ticked. The pill hides once those sets hold the target.

---

## PRIORITY 9: Symmetry & Muscle Balance Radar (Hexagon Telemetry)

**Objective:** show how training is split between muscle groups as a cockpit-style hexagon
radar, and name the imbalances that lead to posture problems or injury.

### 9.1 Ratio engine (`src/lib/symmetry-analyzer.ts`)
- Working sets and effective volume over **7, 30 or 90 days** on six axes. A set counts 1 for
  its primary muscles and 0.5 for secondary ones, once per axis:
  1. **PUSH**: chest, shoulders, triceps
  2. **PULL**: lats, upper back, traps, biceps
  3. **QUADS / ANTERIOR**: quads, calves, adductors
  4. **HAMS / POSTERIOR**: hamstrings, glutes, lower back, abductors
  5. **ARMS**: biceps, triceps, forearms
  6. **CORE**: abs, lower back
- Balanced shares: push 20%, pull 22%, quads 17%, hams 17%, arms 14%, core 10%.
- **Checks**, each with the sets to add this week (at least 2):
  - Push to pull: ideal 1 : 1.0 to 1 : 1.2. Push more than 25% over pull: shoulder warning
    (internal rotation risk). No pull work at all is reported as such.
  - Quad to hamstring: ideal 1 : 0.75 to 1 : 1.0.
  - Upper to lower: legs under 25% of upper plus lower sets is the "skip leg day" pattern.
  - The weakest remaining axis under half its balanced share.
- **Score 0 to 100:** 100 minus 1.5 points per point of total variation distance from the
  balanced shares, minus 5 per check that fires. 85+ OPTIMAL, 70+ BALANCED, 50+ IMBALANCED,
  else CRITICAL. Fewer than 6 working sets: no score.

### 9.2 UI (`src/components/progress/SymmetryRadarCard.tsx`, Profile > Progress)
- Custom SVG hexagon: steel web (`stroke="#27272a"`), the balanced shape dashed
  (`stroke-dasharray="4 4"`), the lifter's shape in Volt (`fill="rgba(204, 255, 0, 0.18)"`,
  `stroke="#ccff00"`, `strokeWidth="2"`) with glowing vertices. A balanced share sits at two
  thirds of the radius; 1.5 times it reaches the rim.
- Terminal readout in `font-mono text-xs`: `SYMMETRY SCORE: 86/100 [OPTIMAL]`, then a
  `DIAGNOSTIC:` line per check, then the push : pull, quad : ham and legs ratios.

---

## PRIORITY 10: Equipment Profile & 1-Tap Smart Exercise Swap

**Objective:** swap an exercise in one tap when the station is taken or the gym (home, hotel)
lacks the equipment.

### 10.1 Engine (`src/lib/exercise-swapper.ts`)
- **Movement pattern** from the name: horizontal push, vertical push, horizontal pull,
  vertical pull, squat, lunge, hinge, fly, else isolation of the main muscle.
- **Match score (out of 99):** same pattern 45, same main muscle 25, shared primary muscles
  up to 15, shared secondary up to 8, same name apart from the equipment up to 6. Timed and rep
  exercises never swap for each other. Top 5 shown.
- **Equipment profiles:** Full gym (everything), Dumbbell / Home (dumbbell, barbell,
  kettlebell, bodyweight, band), Machine / Cable (machine, cable, Smith), Bodyweight
  (bodyweight, band).
- **Weight conversion:** the lifter's last top working weight on the new exercise when there
  is one; otherwise through a barbell equivalent: dumbbell **~41% per hand**, Smith **105%**,
  machine and cable **110%**, kettlebell as dumbbell, bodyweight and band left empty. Rounded
  to 2.5 kg (1 kg on dumbbells under 20 kg) or 5 lb. The starting weight is the next set's,
  else the last ticked set's, else last session's top weight.

### 10.2 UI (`src/components/workout/ExerciseSwapModal.tsx`)
- A `⇄ Swap` button on every exercise card (in the Rest row beside Plates, where a text label
  fits on a 360 px screen).
- Drawer: four profile buttons in a 2 x 2 grid, then up to five alternatives with
  `99% MATCH · SAME MOVEMENT: CHEST` and the starting weight (estimate or your last).
- Picking one keeps the planned sets: with nothing ticked the exercise is replaced in place;
  otherwise ticked sets stay with the old exercise and the sets left move to the new one,
  placed right after it and in the same superset. The new weight fills those sets.

---

# Phase 4: Commercial Architecture, Founder Pass & Paywall Engine

## PRIORITY 11: Entitlement Engine, Founder Pass & Tactile Paywall (`ABOT // BLACK PRO`)

**Objective:** monetization built on feature flags. It runs today as **Founders Early Access**
(every PRO feature open, marked `PRO // BETA`) and can switch to a **commercial paywall** with
one build setting, without touching the UI.

### 11.1 Entitlements (`src/lib/entitlements.ts`, `src/store/useEntitlements.ts`)
- **Monetization mode**, set at build time with `NEXT_PUBLIC_ABOT_MONETIZATION`:
  - `FOUNDERS_BETA` (default): every PRO feature is open; PRO spots carry `PRO // BETA`.
  - `COMMERCIAL_LIVE`: PRO needs `tier === "pro"` (not expired) or `"lifetime"`. Free users
    see a soft-locked preview and the paywall.
- **State**, kept in settings on the device and in backup files (settings are not part of cloud
  sync yet, so the pass travels by backup):
  ```ts
  interface EntitlementState {
    tier: "free" | "pro" | "lifetime";
    isFounder: boolean;
    founderUnitCode: string | null;   // "FOUNDER // #0421"
    founderJoinedAt: string | null;   // ISO date
    proExpiresAt: string | null;
    devOverrideMode: "AUTO" | "FORCE_FREE" | "FORCE_PRO" | "FORCE_BETA";
  }
  ```
- **Founder auto-claim:** once saved settings load during the beta, the install is stamped a
  Founder with a four-digit unit code from a random install seed. It never changes after.
- **Hook:** `useEntitlements()` gives `canAccessPro(feature)`, `isBetaUnlocked`, `proActive`,
  `isFounder`, `founderUnitCode`, `tier`, `openPaywall(feature)` and `setDevOverride(mode)`.
  `EntitlementsProvider` (in the root layout) claims the founder pass and holds the one paywall.
- **Feature keys:** `progressive_overload_coach`, `symmetry_radar_telemetry`,
  `thermal_recovery_inspector`, `voice_handsfree_logger`, `smart_exercise_swap`,
  `story_studio_pro_presets`, `remove_story_watermark`, `unlimited_routines`,
  `health_connect_autosync`.

### 11.2 Paywall (`src/components/paywall/AbotProModal.tsx`)
- Full screen, always dark: Matte Obsidian `#09090b`, a thin technical grid and a soft Volt glow,
  badge `ABOT // BLACK TELEMETRY SYSTEM`, headline `PRECISION ENGINEERED FOR SERIOUS LIFTERS.`
- Opened from a feature, it names it: `UNLOCK FEATURE: STORY STUDIO PRO PRESETS`.
- Comparison table `CORE (FREE)` against `BLACK PRO`.
- Three plans in `font-mono tabular-nums`:
  1. **Monthly protocol:** Rp 29.000 a month ($2.99), cancel any time.
  2. **Annual telemetry:** Rp 199.000 a year ($19.99, about Rp 16.583 a month), **save 43%**,
     Volt border, selected by default.
  3. **Founders lifetime license:** Rp 798.000 once ($79.98); founders pay **Rp 399.000**
     ($39.99) with the full price struck through and `FOUNDER 50% OFF PRIVILEGE APPLIED`.
- **Beta:** `ACTIVE: FOUNDERS BETA PASS. ALL PRO FEATURES UNLOCKED FREE.` with the unit code,
  `Claim / Verify Founder Pass`, and `Simulate activating this plan`.
- **Commercial:** `Activate <plan>` calls `startCheckout(plan)`, the single place where
  RevenueCat (Google Play Billing) or a QRIS / LemonSqueezy checkout URL plugs in. ABOT makes no
  network calls today, so it answers that payments are not connected yet.

### 11.3 Founder pass card and locks
- **`FounderPassCard`** at the top of Settings: a steel plate (`from-[#141418] to-[#09090b]`,
  `border-[#ccff00]/40`, rivets) with `FOUNDER UNIT // #XXXX`, the activation date, the status,
  `View ABOT // BLACK PRO specs`, and the **monetization simulator**:
  `Beta mode | Free locked | Pro active`.
- **Story Studio:** layouts 1 and 2 free, 3 to 11 tagged PRO. When locked, a PRO layout shows
  a preview with `Unlock with ABOT // BLACK`, and download and share open the paywall. A Pro tab
  holds `Hide ABOT watermark` (PRO: removes the ABOT mark and name from every layout) and
  `Show founder badge` (founders only: `ABOT // FOUNDER EDITION` and the unit number in the top
  corner of the 9:16 card).
- **Coach Pill:** a `PRO` tag; when locked, APPLY opens the paywall.
- **Symmetry radar and recovery map:** `PRO // TELEMETRY` in the corner. When locked, the radar
  still draws, and the score and diagnostics give way to an unlock panel; on the map, tapping a
  muscle shows the unlock panel instead of its recovery details.

---

## PRIORITY 12: Remote Config, VIP Redeem Codes & Founder Mission Control (`/admin`)

**Objective:** the founder runs the business and calibrates the app from a console, without a
new APK: monetization switch, prices, announcement, algorithm constants, license codes, manual
upgrades, plus device-level content and database tools. Architecture and the full module matrix:
[`ADMIN_ARCHITECTURE_SPEC.md`](ADMIN_ARCHITECTURE_SPEC.md). Future features are brought into the
console with the `/sync-admin` command (`.claude/commands/sync-admin.md`).

### 12.1 Supabase schema (`supabase/migrations/20261109_admin_and_redeem.sql`)
- `app_admins (email)`: who may write; filled once in the SQL editor. `is_abot_admin()`.
- `app_remote_config` (one `global` row): `monetization_mode`, `monthly/annual/lifetime_price_idr`
  and `_usd`, `announcement_banner`, `offline_codes_enabled`, `tunables` (jsonb), `updated_at`.
  Anyone reads it; only admins update it.
- `redeem_codes`: `code`, `grant_tier` (`pro` / `lifetime`), `duration_days` (null = lifetime),
  `grants_founder_badge`, `max_uses`, `current_uses`, `is_active`, `note`. Admin only.
- `redeem_claims`, `user_entitlements` (tier, expiry, founder unit; users read their own row and
  never write it).
- Functions: `redeem_code(code)` (locks the row, counts the use once per account, grants on the
  account when signed in), `claim_founder(code)` (beta only), `admin_grant(email, tier, days)`,
  `admin_stats()`.
- Checked on a local Postgres by `scripts/check-supabase-schema.sh` (anon cannot write the config
  or list codes, a user cannot grant themselves a tier, use limits hold, admins can do all).

### 12.2 App side
- `src/lib/remote-config.ts`: cached copy at start, background read through Supabase REST (no
  supabase-js) at most every 6 hours, local override for Mission Control without Supabase.
  Monetization mode, prices (`plansFor`) and the Home announcement follow it.
- `src/lib/tunables.ts`: recovery, MET, Coach Pill, radar, free story layouts and gym radius are
  read at call time from the remote config, bounded field by field.
- `src/lib/redeem-service.ts`: server first; built-in offline codes `ABOT-FOUNDER-2026` (pro 365
  days + founder badge), `ABOT-PRO-30D` and `ABOT-VIP-30D` (30 days), stored as SHA-256 hashes
  and switchable off remotely (none grants lifetime: the repository is public); codes made
  in local mode work on that device. Generated codes are `ABOT-<KIND>-XXXX-XXXX-XXXX` (60 bits).
- `RedeemCodeModal`: from the paywall and the founder card; on success the record chord and
  haptic, `LICENSE ACTIVATED: ABOT // BLACK PRO [LIFETIME ACCESS]`, the entitlement saved on the
  device (and on the account when signed in).
- Signed in, the account's licence comes down at start (`lib/entitlement-sync.ts`).

### 12.3 Mission Control (`src/app/admin/page.tsx`, `src/components/admin/*`)
- Entry: `/admin`, or five taps on `ABOT vX // TELEMETRY BUILD` at the foot of Settings. PIN
  (`NEXT_PUBLIC_ABOT_ADMIN_PIN`, default `2026`) hides the page; Supabase RLS protects the data.
- Modules: Overview, Monetization, Licenses, Algorithms, Exercises, Routines & gyms, Database,
  Device. Every panel is tagged Global or Device.
- Sidebar on desktop, a module bar on phones; a full-screen layer outside the 640 px app shell.


## PRIORITY 13: Body Phase Protocols (Cut, Lean Bulk, Recomp, Strength Peak)

**Objective:** a block of weeks with one goal sets the daily calories and macros, tracks the
scale's trend and relative strength, and shifts the Coach Pill, the recovery map and the rest
timer to suit it. PRO feature `body_phase_protocols` (open to everyone during the beta).

### 13.1 and 13.3 Engine and fuel (`src/lib/phase-engine.ts`)
- `ActivePhaseConfig` (type, title, start day, 4/6/8/12/16 weeks, start and target weight,
  height, age, sex, activity outside training 1.2 to 1.9, planned weekly rate %, active) lives
  in settings (`bodyPhase`): IndexedDB and backup files. Settings are not synced to Supabase
  today, so the phase is not either.
- Trend weight: `EMA = today × 0.25 + previous EMA × 0.75` over the weigh-in log (which already
  takes Health Connect weight); weekly rate from the last two weeks.
- Fuel: Mifflin-St Jeor × activity + training calories per day over 4 weeks
  (`lib/calorie-estimator`). Cut −350 to −500 kcal (from the planned rate), protein 2.2 g/kg,
  fat 0.8 g/kg; bulk +250 to +350, 1.8 / 1.0; recomp ±150 on training / rest days, 2.0 / 0.9;
  peak at maintenance, 2.0 / 0.9; carbs fill the rest.
- Strength shield: best barbell or Smith compound e1RM (4 weeks) ÷ trend weight, against the 4
  weeks before. On a cut: holding or rising = muscle-loss risk low, down to −3% moderate, worse
  high.
- Mesocycle: week X of N from the start day; every 4th week is a deload week.
- Every constant is a tunable (`tunables().phase`), so Mission Control > Algorithms edits it.

### 13.2 Calibration
- Coach Pill (`lib/progressive-overload`): cut, a session at RPE ≥ 8.5 gives
  `Muscle retention target` (hold the weight), fatigue gives `Fatigue: drop one set` (APPLY
  removes one set left) instead of a 10% deload; bulk, a clean compound adds a load step at the
  same reps (`Surplus overload`) and `+1 set` when every primary muscle is fully recovered;
  peak, compounds go to 3 to 5 reps, above 5 the weight comes from the e1RM.
- Recovery map (`lib/muscle-recovery`): recovery time × 1.15 cutting, × 0.9 bulking.
- Rest timer: at least 180 s after a compound set while peaking.

### 13.4 UI (pages, not sheets: `src/app/phase/*`, `src/components/phase/*`)
Owner brief 2026-11-09: less text, tidier layout, full pages with illustration and motion.
- Identity motif: the block drawn as a weight plate (`BlockPlate`), one segment per week, lit in
  order as weeks pass. The plate is ABOT's mark, so the phase belongs to the app.
- Home and Profile: `PhaseCommandCard`, a glance card linking to `/phase`: phase and week, block
  bar, trend weight with a sparkline, today's calories with a macro bar, and protein and water
  rings that fill with a tap. Without a phase, one row with the four phase icons opens setup.
- `/phase`: plate hero with the week, trend weight and start-to-target bar; today's calories as
  a counting figure inside a macro donut; protein and water rings; weigh-in stepper (body fat
  and waist on request) with the scale against trend chart; relative strength with a change
  meter and muscle-loss risk on a cut.
- `/phase/setup`: four steps, one decision each (phase, about you, goal, plan), sliding in the
  direction of travel. Phase cards draw their own weight curve (falling, rising, cycling,
  stepped). Steppers instead of text fields; the plan step counts the calories up and lists what
  changes in the coach and recovery map with icons.
- `/phase/fuel`: meals before and after training as a timeline around a dumbbell, foods as chips
  with grams; the food grid shows an icon, kcal per 100 g, a macro bar, and opens to the portion
  and note on tap.
- Routines > Templates: `Fits your <phase>` on the templates that suit it (`templateFitsPhase`).
- Motion purpose: plate segments light in order (how far through the block), calories count up,
  donut and bars draw in, wizard steps slide with the direction; reduced motion shows end states.

### 13.5 Food guide and pacer (`src/lib/nutrition-guide.ts`, `NutritionGuideModal`)
- 24 foods and drinks, many easy to find in Indonesia (chicken, eggs, tempeh, tofu, tuna,
  tilapia, salmon, beef, rice, potato, ubi, oats, banana, avocado, coffee, coconut water, whey,
  soy milk), each with macros per 100 g (USDA FoodData Central typical values), a portion by
  eye, the phases it suits, satiety, digestion speed and a one-line note. Ikan kembung is left
  out until a reliable figure for that species is sourced.
- Meals around training: before, 20% of the day's calories and protein from a lean, quick
  protein and fast carbs; after, 25% of calories and 30% of protein; portions in 10 g steps,
  "Other foods" cycles the pairs.
- Pacer (`store/useFuelPacer`): `+25 g` protein and `+500 ml` water against today's targets
  (water ≈ 35 ml per kg), per device, reset each day.
