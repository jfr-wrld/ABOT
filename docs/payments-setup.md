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

## Sandbox test checklist

Run these signed in with Google, on the web first, then in the APK.

| # | Scenario | How | Expected |
|---|---|---|---|
| 1 | QRIS / GoPay paid | Annual → QRIS. Pay the QR image URL in the Sandbox simulator (QRIS menu) | Back on Settings: "Payment received", plan card BLACK PRO, about 365 days |
| 2 | Bank transfer (VA) | BCA VA → pay the VA number in the simulator | "Waiting for your payment" first, then PRO on |
| 3 | Card paid | `4811 1111 1111 1114`, any future date, CVV `123`, OTP `112233` | Paid at once |
| 4 | Card declined | `4911 1111 1111 1113` | "The payment did not go through", PRO stays off |
| 5 | Expired | Start a VA and do not pay | Order `expired` once Midtrans sends expire |
| 6 | Refund | Dashboard → Transactions → paid card or GoPay → full refund | Order `refunded`; next Restore or app open removes PRO |
| 7 | Lifetime | Buy lifetime | Plan card LIFETIME |
| 8 | Founders | Founder account buys lifetime (Rp 399.000); non-founder tries the same | Founder: lifetime. Non-founder: "for founders only" |
| 9 | Android | Scenario 1 in the APK; close the browser after paying | Banner appears back in ABOT |

Test cards and simulator menus are from the Midtrans Sandbox docs; follow docs.midtrans.com if they differ.

To check the data, run these in the SQL editor:

```sql
select order_id, plan, amount_idr, status, payment_type, created_at, paid_at from public.payment_orders order by created_at desc limit 10;
select order_id, transaction_status, fraud_status, gross_amount, received_at from public.payment_events order by received_at desc limit 20;
select u.email, e.tier, e.pro_expires_at, e.is_founder, e.source from public.user_entitlements e join auth.users u on u.id = e.user_id order by e.updated_at desc limit 10;
```

### When something fails
- **"The payment page could not be opened":** read the `midtrans-checkout` logs. The usual causes are a wrong Server Key or the wrong `MIDTRANS_IS_PRODUCTION`.
- **Paid but no PRO, and no row in `payment_events`:** the Notification URL is wrong, or `midtrans-notify` was deployed without `--no-verify-jwt`. A `401 bad signature` in the logs means the key does not match.
- **A row in `payment_events` but the order is still pending:** compare its `gross_amount` with the order's `amount_idr`.
- **CORS error in the browser:** the site's origin is missing from `ABOT_ALLOWED_ORIGINS`.
- **Notification arrived before a fix:** the Midtrans dashboard can resend it.

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
