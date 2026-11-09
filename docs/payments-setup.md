# Payments with Midtrans: setup

ABOT sells BLACK PRO through Midtrans Snap: QRIS, e-wallets (GoPay, ShopeePay, OVO, DANA), virtual
accounts and cards. All of these are one-off payments, so the checkout sells:

| Plan | Price (Mission Control) | What it grants |
|---|---|---|
| Annual | `annual_price_idr` (Rp 199.000) | 365 days of PRO, added onto any time left |
| Lifetime | `lifetime_price_idr` (Rp 798.000) | Lifetime |
| Founders | half of lifetime (Rp 399.000) | Lifetime, only for accounts with a founder pass, capped by `founder_seats` (500) |

Monthly is not sold through Midtrans, because a one-off payment cannot renew.

## How it works

1. The app, signed in, calls the Edge Function `midtrans-checkout` with a plan.
   - The function reads the price from `app_remote_config`; the app never sends it.
   - It creates a pending row in `payment_orders` and opens a Snap payment page.
2. Midtrans calls `midtrans-notify`, which:
   - checks the SHA-512 signature with the Server Key;
   - reads the status again from Midtrans' status API;
   - logs it in `payment_events`;
   - then grants the plan (`abot_order_paid`), takes it back on a refund or chargeback (`abot_order_reversed`), or closes a failed or expired order.
3. The grant lands in `user_entitlements`. The app already syncs that table, so PRO turns on, and turns off again after a refund, on every phone signed in to the account.
4. After paying, the buyer comes back to ABOT, either through the web return URL or by closing the browser on Android. The app reads the order until it settles and shows one line saying what happened.

The Server Key only lives in Supabase secrets. It is never in the app, this repository or a chat.

## Setup (Sandbox first)

You need the Supabase CLI logged in and linked to the project (`supabase link --project-ref <ref>`).

1. **Database:** apply `supabase/migrations/20261111_midtrans_payments.sql`, using the SQL editor or `supabase db push`.
2. **Secrets.** Use the Sandbox Server Key from Midtrans Dashboard → Settings → Access Keys (it starts with `SB-Mid-server-`). Replace `<site>` with the web app's domain.

   ```bash
   supabase secrets set MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx MIDTRANS_IS_PRODUCTION=false ABOT_RETURN_URL=https://<site>/settings/ ABOT_ALLOWED_ORIGINS=https://<site>,https://localhost
   ```

   `https://localhost` is the Android app's origin (Capacitor).
3. **Functions:**

   ```bash
   supabase functions deploy midtrans-checkout
   ```

   ```bash
   supabase functions deploy midtrans-notify --no-verify-jwt
   ```

   `--no-verify-jwt` is required on `midtrans-notify` because Midtrans sends no Supabase token. The signature check protects it instead.
4. **Midtrans Dashboard (Sandbox) → Settings → Payment:**
   - Payment Notification URL: `https://<ref>.supabase.co/functions/v1/midtrans-notify`
   - Finish, Unfinish and Error Redirect URL: `https://<site>/settings/`
5. **Mission Control** (`/admin` → Monetization):
   - Tick **Midtrans checkout open** and push.
   - **Also in the Android app** is on by default. Read the Google Play note below.
   - The paywall offers the buy button in both modes. In `COMMERCIAL_LIVE` it is the main action. During `FOUNDERS_BETA` it sits under the beta pass, so founders can lock in lifetime early.
6. **Test** with the Sandbox simulator (QRIS, VA and e-wallet payments at simulator.sandbox.midtrans.com, test cards in the Midtrans docs). Check that:
   - after paying, the banner says the payment was received and Settings → Plan & billing shows BLACK PRO;
   - `payment_orders` shows `paid` and `payment_events` has the notifications;
   - a refund in the dashboard sets the order to `refunded` and the next sync removes PRO from the phone.

## Going live

1. Production Server Key: run `supabase secrets set MIDTRANS_SERVER_KEY=Mid-server-xxxx MIDTRANS_IS_PRODUCTION=true`.
2. Set the same Notification and Redirect URLs in the **Production** dashboard.
3. Redeploy both functions so they pick up the new secrets.

The seat cap is in `app_remote_config.founder_seats`, for example `update public.app_remote_config set founder_seats = 300;`. A pending founder order holds a seat for 24 hours.

## Google Play note

The owner chose to show the Midtrans checkout inside the Android app as well (2026-11-11). Google Play's payments policy requires Play Billing for digital goods unless the app is enrolled in User Choice Billing, which is available in Indonesia. Showing another checkout without that enrolment risks the app being rejected or removed.

If Google objects, untick **Also in the Android app** in Mission Control. The Android app then hides the buy button at once, with no new build, and the web keeps selling.

## Tax and legal (from `reports/ABOT payment spec Indonesia.md`)

- No PPN while turnover is under Rp 4,8 miliar a year.
- Final income tax is 0.5%, and the first Rp 500 juta a year is free for individuals.
- You need an NPWP, an NIB, PSE registration with Komdigi, and a written refund policy.
