# Mission Control: Customers tab and first-party visitor count

Date: 2026-11-15. Status: awaiting owner approval.

## Why

ABOT went public on Threads and people are downloading and paying. The owner wants one place,
Mission Control (`/admin`), that answers: who has paid, what PRO each of them holds and until when,
how many people visit the web app, and how many downloaded the APK. Today the payers are only visible
in the Supabase table editor (the admin shows 15 orders in a sandbox test panel), visitors only in the
Vercel dashboard, and downloads in the Growth tab (PR jfr-wrld/ABOT#27, merged or about to be).

## Goals

1. A **Customers** tab: every account that holds or held paid access, with plan, PRO status and
   expiry, payment date and method, and the source of the PRO (Midtrans order, VIP code, manual grant,
   founder claim). Search by email. Totals at the top: revenue from paid orders, counts of paid,
   pending, failed/expired and refunded orders.
2. **Web visitors in the Growth tab**: unique visitors per day (one browser counts once per Jakarta day)
   and page views per day, for the last 30 days, next to the existing sign-up and download numbers.

## Non-goals

- No actions on the Customers tab: no extend, revoke or refund buttons. Granting PRO stays in
  Licenses → Manual upgrade. (Owner said "mau lihat": view only. Actions can come later.)
- No per-user workout data. The tab shows billing and entitlement only.
- No counting in the Android app. The APK keeps sending nothing; its reach is the download count.
- No countries, referrers or devices in ABOT's own counter: Vercel's dashboard keeps those.

## Anti-goals

- Storing anything that identifies a visitor (IP, user agent, cookie id, random id). The counter
  stores only aggregate integers per day and path.
- Exposing customer emails to anyone but an `app_admins` account.
- Slowing a page: the visit call is fire-and-forget after the page renders, and failures are silent.

## Constraints

- Every admin read goes through a `security definer` function that starts with
  `if not public.is_abot_admin() then raise exception 'admins only'`, like `admin_stats()` and
  `admin_growth()`. Migrations are idempotent ("safe to run more than once") and applied by the owner
  in the Supabase SQL editor.
- The CSP already allows the Supabase URL in `connect-src`; no new host.
- CLAUDE.md's zero-network rule: this is a new owner-approved exception (2026-11-15) and must be
  written into CLAUDE.md, README "Your data and privacy" and the Privacy Policy (EN and ID) next to
  the Vercel Analytics lines added in PR #27.
- Builds without Supabase configured (local mode) show a note instead of numbers, like Growth does.
- Mission Control's existing look (`src/components/admin/ui.tsx`: Panel, Metric, Note, cls).

## Approaches considered (visitor counter)

- **A. Browser calls a Supabase RPC (chosen by the owner).** After a page renders, the web app calls
  `track_visit(path, first_today)`; the function increments counters for today's Jakarta date. The
  browser remembers the last date it counted itself (localStorage) so it reports "first visit today"
  once per day. No server, no secret. Trade-off: anyone can call the RPC and inflate the numbers;
  accepted, the stakes are a statistic.
- B. A Next.js route handler on Vercel writes with the service-role key. Could add country from
  Vercel headers, but needs a new secret and more moving parts; Vercel's dashboard already has
  countries. Rejected.
- C. Vercel Drains. Paid Vercel plans only. Rejected.

Customers tab: one sensible way, an `admin_customers()` RPC read by a new module.

## Design

### Database (one migration, `supabase/migrations/20261116_admin_customers_visits.sql` (20261115 is taken by admin_growth))

- `public.web_visits (day date, path text, visitors integer, views integer, primary key (day, path))`.
  RLS on, no policies, no grants to anon/authenticated: only the functions below touch it.
- `public.track_visit(p_path text, p_first_today boolean)`: `security definer`, granted to `anon` and
  `authenticated`. Stores only the app's known top-level routes (`/`, `/workout`, `/progress`,
  `/history`, `/exercises`, `/routines`, `/phase`, `/plan`, `/profile`, `/settings`, `/onboarding`,
  `/login`, `/privacy`, `/terms`, `/permissions`): the first path segment is matched against that list
  and anything else is stored as `other`, so made-up paths cannot grow the table or leak ids
  (`/admin*` is ignored entirely), upserts the row for today (Asia/Jakarta): `views + 1`, and
  `visitors + 1` when `p_first_today`. A visitor is counted on the path they landed on first that day.
- `public.admin_visits(p_days integer default 30)`: admin only; one row per day (zero-filled):
  `day, visitors, views`, plus a top-paths breakdown either as a second function or a second result
  shape (builder's call).
- `public.admin_customers()`: admin only. One row per user who has a `user_entitlements` row with a
  non-free tier or founder flag, or any `payment_orders` row. Columns: email, tier, pro_expires_at,
  is_founder, founder_unit_code, entitlement source, their latest **paid** order (plan, amount_idr,
  payment_type, paid_at, over_cap), or their latest order of any status when they never paid; the number
  of paid orders and their paid total; and, for a founders order, the seat number = its rank among paid
  founders orders by paid_at (the payment flow grants founders buyers plain lifetime without
  `founder_unit_code`, so that column alone would be blank for payers). Plus totals (revenue = sum of `amount_idr` where
  status = 'paid'; counts per status). How the totals are returned is the builder's call.

### Web app

- `src/lib/visit-counter.ts`: decides `first_today` from a localStorage date (try/catch: storage
  blocked means "count as first" at most once per page load), skips `/admin`, skips the Android build
  and development, skips when Supabase is not configured, calls the RPC without awaiting the UI.
- Mounted beside `WebAnalytics` in `src/app/layout.tsx`, firing on each client navigation (pathname
  change), like Vercel's component.

### Mission Control

- New **Customers** module (global scope), added to the module list after Growth. Totals as Metric
  tiles, then a searchable table (email filter, client side) with columns: email, plan/source, PRO
  status ("Lifetime", "Active until 13 Nov 2027", "Expired 1 Dec", "Free"), founder number (the
  stored `founder_unit_code`, else the derived seat), last paid date, method, paid orders and total;
  over-cap founders flagged. The source label maps the stored `source`, which is the last grant written
  (Midtrans order / code / manual / founder claim / refunded); because it is only the last writer, the
  paid-orders column is what says whether someone has ever paid. On a phone the table becomes stacked
  rows. Refresh button, no background polling.
- **Growth** gains a "Web visitors" panel replacing the Vercel-only panel: Today / last 7 days /
  last 30 days unique visitors, a 30-day chart of visitors and views, top 5 pages, and the Vercel link
  kept for countries and referrers.
- The orders sandbox panel in Monetization stays as it is.

### Docs and privacy

- Privacy Policy (EN/ID), "Other services ABOT contacts": the web app also counts visits in ABOT's own
  database: the page path and the date, as totals, with nothing that identifies the visitor.
- README and CLAUDE.md exception lines updated.

### Sandbox orders (decided by the owner, 2026-11-15)

Midtrans still runs in Sandbox, so every order in `payment_orders` today is a test. Revenue and the
order counts leave out `payment_type = 'simulated'` (the admin's own test buttons) always. Every other
order counts as shown. When the owner switches Midtrans to Production, they delete the sandbox orders
once; `docs/payments-setup.md`'s go-live steps gain that SQL (delete from `payment_orders` where
`created_at` < the switch time, after checking the list), and the entitlements those test orders granted
are reset with it. Under the totals the tab always shows one short note: test payments count until the
sandbox orders are cleared at go-live (docs/payments-setup.md). The client cannot tell Sandbox from
Production, so the note is not conditional.

## Left to the builder

- Exact SQL shape of totals and top paths; table pagination (the list is small today).
- Tests: unit tests for the counter's first-today logic and path normalisation, and for any parsing of
  RPC rows; extend `supabase/tests/schema-check.sql` if it covers admin functions.
- Wording of labels, following the antislop copy rules already used in Mission Control.
