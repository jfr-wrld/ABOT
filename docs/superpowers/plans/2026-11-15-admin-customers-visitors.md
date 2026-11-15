# Customers tab and visitor counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mission Control shows who has paid and their PRO status (Customers tab) and ABOT's own daily web visitor counts (Growth tab).

**Architecture:** One idempotent migration adds `web_visits` plus four `security definer` functions (`track_visit` for anon, `admin_visits`, `admin_visit_paths`, `admin_customers` for admins). The web build calls `track_visit` once per client navigation; Mission Control reads the admin functions through `src/lib/admin-api.ts` and renders them with the existing `ui.tsx` pieces.

**Tech Stack:** Next.js 16, TypeScript, Supabase JS, Postgres (plpgsql), Recharts, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-admin-customers-visitors-design.md`

## Global Constraints

- Admin functions start with `if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;` and `revoke all ... from public, anon; grant execute ... to authenticated`.
- Migration file: `supabase/migrations/20261116_admin_customers_visits.sql`, safe to run more than once.
- Days are Asia/Jakarta dates.
- Known paths: `/`, `/workout`, `/progress`, `/history`, `/exercises`, `/routines`, `/phase`, `/plan`, `/profile`, `/settings`, `/onboarding`, `/login`, `/privacy`, `/terms`, `/permissions`; anything else stored as `other`; `/admin*` never counted.
- Revenue and order counts exclude `payment_type = 'simulated'`.
- Counter runs only when `process.env.ABOT_WEB_ANALYTICS === "1"`, `NODE_ENV === "production"` and `isCloudSyncConfigured()`.
- Mission Control copy in English, sentence case, no em dashes; antislop (during) rules apply.

## Review Focus

- localStorage throws (private mode): counts as first visit once per page load, never throws. Test in Task 2.
- A path with query, hash or trailing slash (`/workout/?start=x`) counts as `/workout`. Test in Task 1 (SQL) and Task 2 (client sends pathname only).
- A buyer with a paid annual order and a later expired checkout shows the paid order. Test in Task 1.
- A user with only a VIP code (no orders) appears with source "code" and zero paid orders. Test in Task 1.
- Supabase missing admin function (migration not applied) shows "apply supabase/migrations/20261116_admin_customers_visits.sql" instead of a raw error. Test in Task 3.

---

### Task 1: Migration and schema check

**Files:**
- Create: `supabase/migrations/20261116_admin_customers_visits.sql`
- Modify: `supabase/tests/schema-check.sql` (add `\i` for `20261115_admin_growth.sql` and the new file in both passes; add checks after the `admin_stats` block)

**Interfaces:**
- Produces:
  - `track_visit(p_path text, p_first_today boolean) returns void` (anon, authenticated)
  - `admin_visits(p_days integer default 30) returns table (day date, visitors bigint, views bigint)`, zero-filled, oldest first
  - `admin_visit_paths(p_days integer default 30) returns table (path text, visitors bigint, views bigint)`, views desc, limit 10
  - `admin_customers() returns table (user_id uuid, email text, tier text, pro_expires_at timestamptz, is_founder boolean, founder_unit_code text, source text, paid_orders bigint, paid_total_idr bigint, last_plan text, last_status text, last_amount_idr integer, last_payment_type text, last_at timestamptz, founder_seat integer, over_cap boolean)`. Rows: users with a non-free tier, `is_founder`, or any non-simulated order. `last_*` = latest paid non-simulated order, else latest non-simulated order. `founder_seat` = rank by `paid_at` among paid non-simulated founders orders, null otherwise.
  - `admin_order_totals() returns table (revenue_idr bigint, paid bigint, pending bigint, failed bigint, refunded bigint)` where failed = failed + expired; all exclude simulated.

- [ ] **Step 1: Add checks to schema-check.sql** (as admin B, after seeding): `track_visit('/workout/?x', true)` twice with first=false the second time gives `/workout` visitors 1, views 2; `track_visit('/admin', true)` stores nothing; `track_visit('/nope', true)` stores `other`; as user A, `admin_visits()` raises `admins only`; as B, `admin_visits(7)` returns 7 rows; seed an order for A `paid annual 249000 qris` then a later `expired` one, plus a `simulated` paid one: `admin_customers()` row for A has `paid_orders = 1`, `last_status = 'paid'`, `last_payment_type = 'qris'`; `admin_order_totals()` revenue = 249000, failed = 1.
- [ ] **Step 2: Run** `scripts/check-supabase-schema.sh`. Expected: fails (function does not exist).
- [ ] **Step 3: Write the migration.** `web_visits(day date, path text, visitors integer not null default 0, views integer not null default 0, primary key (day, path))`, RLS on, `revoke all from anon, authenticated`. `track_visit` normalises with `split_part(split_part(split_part(p_path,'?',1),'#',1),'/',2)` against the list, upserts with `on conflict do update`.
- [ ] **Step 4: Run** `scripts/check-supabase-schema.sh`. Expected: all checks pass, twice-applied.
- [ ] **Step 5: Commit** `Add visit counter and customer admin functions`.

### Task 2: Visit counter in the web app

**Files:**
- Create: `src/lib/visit-counter.ts`, `src/lib/visit-counter.test.ts`, `src/components/layout/VisitCounter.tsx`
- Modify: `src/app/layout.tsx` (mount `<VisitCounter />` inside the Suspense next to `<WebAnalytics />`), `src/components/legal/legal-content.ts` (EN and ID line), `README.md`, `CLAUDE.md`

**Interfaces:**
- Produces: `firstVisitToday(storage: Pick<Storage,"getItem"|"setItem"> | null, today: string): boolean` (key `abot.visit-day`; true and stores `today` when the stored value differs; true when storage is null or throws); `jakartaDay(now: Date): string` (YYYY-MM-DD); `reportVisit(pathname: string, rpc: (fn: string, args: object) => Promise<unknown>, storage, now): Promise<void>` (skips `/admin*`, swallows errors).
- `VisitCounter`: client component; `usePathname()`; effect calls `reportVisit` with `getSupabase().then(s => s.rpc)` when enabled per Global Constraints.

- [ ] **Step 1: Tests:** first call true then false same day; next day true; throwing storage returns true without throwing; `jakartaDay(new Date("2026-11-15T18:00:00Z")) === "2026-11-16"`; `reportVisit("/admin")` never calls rpc; rejecting rpc does not throw; rpc gets `("track_visit", { p_path: "/workout", p_first_today: true })`.
- [ ] **Step 2: Run** `npx vitest run src/lib/visit-counter.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, mount, update privacy/README/CLAUDE.md lines (visits counted as totals per page and date, nothing that identifies the visitor; web only).
- [ ] **Step 4: Run** the test, `npx tsc --noEmit`, `npm run build`. Expected: pass.
- [ ] **Step 5: Commit** `Count web visits in ABOT's own database`.

### Task 3: Customers tab

**Files:**
- Create: `src/lib/customers.ts`, `src/lib/customers.test.ts`, `src/components/admin/CustomersModule.tsx`
- Modify: `src/lib/admin-api.ts` (add `customers()`), `src/app/admin/page.tsx` (module id `customers`, label "Customers", icon `Users`, after Growth, global), `docs/payments-setup.md` (go-live step: list then delete sandbox orders and reset their entitlements)

**Interfaces:**
- Consumes: `admin_customers()`, `admin_order_totals()` from Task 1.
- Produces: `parseCustomers(raw: unknown): Customer[]`, `parseTotals(raw: unknown): OrderTotals`, `proStatus(c: Customer, now: number): { label: string; tone: "volt" | "amber" | undefined }` ("Lifetime", "Active until 13 Nov 2027", "Expired 1 Dec 2026", "Free"), `sourceLabel(source: string | null): string` (`midtrans:*`→"Midtrans", `code:*`/`redeem*`→"Code", `admin*`→"Manual", `founder*`→"Founder claim", `midtrans-refund:*`→"Refunded", else "-"), `missingFunctionMessage(e: unknown, fn: string, file: string): string`. `customers(): Promise<{ list: Customer[]; totals: OrderTotals }>` in admin-api.
- Check the real `source` strings in the migrations before fixing `sourceLabel`'s prefixes.

- [ ] **Step 1: Tests** for parse (bigint strings, nulls), each `proStatus` case, each `sourceLabel` case, `missingFunctionMessage` turns `Could not find the function public.admin_customers` into the apply-migration text.
- [ ] **Step 2: Run** `npx vitest run src/lib/customers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** lib, api, module (Metric tiles: Revenue (Rp), Paid, Pending, Failed or expired, Refunded; note about sandbox orders; email filter input; table on `sm:` and stacked rows below; over-cap badge; Refresh), wire into page.
- [ ] **Step 4: Run** tests, tsc, eslint on changed files. Expected: pass.
- [ ] **Step 5: Commit** `Add the Customers tab to Mission Control`.

### Task 4: Visitors in Growth

**Files:**
- Modify: `src/lib/growth.ts` (+ test), `src/lib/admin-api.ts` (`visits(days)`), `src/components/admin/GrowthModule.tsx` (replace `VisitorsPanel`)

**Interfaces:**
- Consumes: `admin_visits`, `admin_visit_paths` from Task 1; `missingFunctionMessage` from Task 3.
- Produces: `summarizeVisits(days: unknown, paths: unknown): VisitSummary` with `{ days: {day, visitors, views}[], today, last7, last30, topPaths: {path, visitors, views}[] }` (top 5).

- [ ] **Step 1: Test** `summarizeVisits` totals and top-5 cut.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement**; panel "Web visitors" (wide): Metric tiles Today / Last 7 days / Last 30 days, 30-day bar chart (visitors volt, views muted), top pages list, Vercel link kept for countries and referrers, local-mode note.
- [ ] **Step 4: Verify:** tests, tsc, `npm run build`, dev-server screenshot of `/admin#growth` and `/admin#customers` at 1280 and 390 px with no horizontal scroll.
- [ ] **Step 5: Commit** `Show web visitors in Growth`, push, update PR jfr-wrld/ABOT#27 description with the new owner step (apply the 20261116 migration).
