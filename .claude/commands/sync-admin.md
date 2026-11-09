---
description: Audit ABOT for features Mission Control (/admin) cannot manage yet, then add their panels.
argument-hint: "[optional: feature or folder to focus on]"
---

You are updating ABOT // MISSION CONTROL (`src/app/admin/page.tsx` and `src/components/admin/*`)
so the founder can manage every feature that exists in the codebase. Focus: $ARGUMENTS

Follow these steps in order. Do not write UI before steps 1 and 2 are done.

1. **Audit.** Read `docs/plans/ADMIN_ARCHITECTURE_SPEC.md` first: it lists what the console
   already controls. Then look for what is new since it was written:
   - `git log --oneline -30` and `git diff --stat <last commit that touched ADMIN_ARCHITECTURE_SPEC.md>..HEAD`
   - new stores in `src/store/`, new `kv` keys in `src/data/repo/types.ts`, new Dexie versions
     in `src/data/repo/dexie.ts`, new Supabase migrations in `supabase/migrations/`
   - new modules in `src/lib/` with hard-coded constants (thresholds, percentages, hours, counts,
     limits) or catalogs (arrays of presets, templates, plans)
   - new feature flags or PRO keys in `src/lib/entitlements.ts`
   For each finding decide: Global (every install, via Supabase) or Device (this phone).

2. **Update the spec.** Add the findings to sections 1.2 and 1.3 and a row per new control to
   the matrix in section 2 of `docs/plans/ADMIN_ARCHITECTURE_SPEC.md`: module, panel, what it
   controls (source file), where it writes, scope.

3. **Wire, smallest change that works:**
   - A constant that should be tunable: add it to `Tunables`, `DEFAULT_TUNABLES` (the shipped
     value) and `TUNABLE_SPECS` (label, min, max, step, unit) in `src/lib/tunables.ts`, and read
     it with `tunables()` at call time in its module. The Algorithms panel renders new specs by
     itself. Add a test in `src/lib/tunables.test.ts` that an override changes the behaviour.
   - A new Global setting that is not an algorithm constant: add a column to
     `app_remote_config` in a new migration (`alter table ... add column if not exists`), the
     field to `RemoteConfig` and `normalizeRemoteConfig` in `src/lib/remote-config.ts`, the save
     in `saveConfig` (`src/lib/admin-api.ts`), and a control in the Monetization module. Extend
     `supabase/tests/schema-check.sql` and run `scripts/check-supabase-schema.sh`.
   - New device data (a store or kv key): read and edit it through its store's actions in a
     Device module panel; add its table or key to the Database snapshot inspector and, if it
     can point at other data, a check in `src/lib/db-inspect.ts` (with a test).
   - A new PRO feature: add its key and label in `src/lib/entitlements.ts`.
   Never let the client write Global data except through RLS or security definer functions that
   check `is_abot_admin()`.

4. **UI rules.** Matte Obsidian `#09090b`, Carbon `#121215` panels, Volt `#ccff00` for Global and
   primary actions, Cyan `#00f0ff` tags for Device scope, `font-mono tabular-nums` for every
   number and code, 44 px tap targets, works at 360 px wide and on desktop (sidebar layout).
   Mark each panel's scope. Destructive actions need a typed confirmation.

5. **Verify.** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, and the
   Mission Control e2e (`npx playwright test e2e/admin.spec.ts --trace off`), plus a screenshot of
   the new panel at 360 px and 1280 px. Report what was added, what was left out and why.
