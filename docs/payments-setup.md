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
4. On the web, the payment page opens in a new tab and ABOT stays open, signed in, in the tab the buyer came from. ABOT shows "Waiting for your payment" and reads the order until it settles. After paying, Midtrans opens `/payment-done.html`, a small static page that tells the ABOT tab and closes itself. In the Android app, the page's button reopens ABOT, which checks the order when it comes to the front. If the browser blocks the new tab, the payment opens in the same tab and comes back through the same page.

The Server Key only lives in Supabase secrets. It is never in the app, this repository or a chat.

## Setup (Sandbox first)

You need the Supabase CLI logged in and linked to the project (`supabase link --project-ref <ref>`).

1. **Database:** apply `supabase/migrations/20261111_midtrans_payments.sql`, then `20261112_payment_test_tools.sql`, then `20261113_security_hardening.sql`, then `20261114_founder_seat_lock.sql`, using the SQL editor or `supabase db push`.
2. **Secrets.** Use the Sandbox Server Key from Midtrans Dashboard → Settings → Access Keys (it starts with `SB-Mid-server-`). Replace `<site>` with the web app's domain.

   ```bash
   supabase secrets set MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx MIDTRANS_IS_PRODUCTION=false ABOT_RETURN_URL=https://<site>/settings/
   ```

3. **Functions:**

   ```bash
   supabase functions deploy midtrans-checkout
   ```

   ```bash
   supabase functions deploy midtrans-notify --no-verify-jwt
   ```

   ```bash
   supabase functions deploy delete-account
   ```

   `delete-account` backs Settings → Data & backup → Delete my data → "This phone and my account". It deletes the caller's own sign-in; every per-user table cascades with it. `payment_events` (Midtrans' notifications) carries no user id and stays as the payment record.

   `--no-verify-jwt` is required on `midtrans-notify` because Midtrans sends no Supabase token. The signature check protects it instead. `supabase/config.toml` pins the same settings, so a deploy that forgets the flag keeps them.

   After `20261113_security_hardening.sql`, redeploy both functions: checkout then reuses a pending order's payment page for 30 minutes and returns error codes only, and notify checks the signature before it looks up the order.
4. **Midtrans Dashboard (Sandbox) → Settings → Payment:**
   - Payment Notification URL: `https://<ref>.supabase.co/functions/v1/midtrans-notify`
   - Finish, Unfinish and Error Redirect URL: `https://<site>/payment-done.html`. The checkout also sends this per payment.
5. **Mission Control** (`/admin` → Monetization):
   - Tick **Midtrans checkout open** and push.
   - **Also in the Android app** is on by default. Read the Google Play note below.
   - The paywall offers the buy button in both modes. In `COMMERCIAL_LIVE` it is the main action. During `FOUNDERS_BETA` it sits under the beta pass, so founders can lock in lifetime early.
6. **Test** with the Sandbox simulator (QRIS, VA and e-wallet payments at simulator.sandbox.midtrans.com, test cards in the Midtrans docs). Check that:
   - after paying, the banner says the payment was received and Settings → Plan & billing shows BLACK PRO;
   - `payment_orders` shows `paid` and `payment_events` has the notifications;
   - a refund in the dashboard sets the order to `refunded` and the next sync removes PRO from the phone.

## Sandbox test checklist

**Without paying anything:** press Buy on the paywall, signed in, so a pending order exists. Then open Mission Control → Monetization → **Test payments (Sandbox)**. Each order there has **Success**, **Fail**, **Expire** and **Refund** buttons. They run the same grant and revoke a real Midtrans notification does. Go back to ABOT, or reopen it, to see the result.

The buttons work only for admins, and only while `payments_sandbox` is true.

The table below is the full test through Midtrans itself.

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
- **"(FunctionsFetchError)" after the message:** the browser got no readable answer. Usually "Verify JWT" is still on for `midtrans-checkout` (the gateway rejects the browser's preflight), or the function name is not exactly `midtrans-checkout`.
- **Notification arrived before a fix:** the Midtrans dashboard can resend it.

## Signed licences

Release builds with a licence public key open PRO only from a token the `license` Edge Function
signed, checked offline in the app (`src/lib/license-token.ts`). Editing the stored tier on a phone
or in a browser then opens nothing. A token works offline for 30 days and every signed-in start
renews it. Without the public key a build keeps the older rule, so nobody loses PRO because a
variable is missing. Mission Control → Overview → Live config says which rule a build uses.

1. Make a key pair once (nothing is written to disk):

   ```bash
   node scripts/make-license-keys.mjs
   ```

2. Run the `supabase secrets set LICENSE_PRIVATE_JWK='…'` line it prints. Keep the private key
   nowhere else.
3. Deploy the function:

   ```bash
   supabase functions deploy license --no-verify-jwt
   ```

4. Put the public key it printed in `NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY`: in Vercel (Project →
   Settings → Environment Variables) and in the repository's Actions variables (for the APK). Redeploy.

Before step 4, sign in on the web app and check that `license` answers (Supabase → Edge Functions →
license → Logs shows a 200), then set the variable. A build with the key and no working function
shows paying users "Your Pro license needs a quick check" until it can fetch a token. After the
redeploy, Mission Control → Licenses → Entitlement on this device should say the licence is verified. A new key pair later works the same way and invalidates old tokens
until each phone is online.

When ABOT sells for real, also set `NEXT_PUBLIC_ABOT_MONETIZATION_FLOOR=COMMERCIAL_LIVE` in the same
two places. The mode then stays live even if someone edits the cached remote config back to beta.
Leave it unset during the Founders beta.

## Payments and admin hardening (2026-11-18)

Apply `supabase/migrations/20261118_payments_admin_hardening.sql` in the SQL editor, then redeploy
the checkout: `supabase functions deploy midtrans-checkout`. After it:

- The Mission Control payment simulator works only on orders made while `payments_sandbox` was on;
  a real order can never be marked paid from there.
- Unpaid founders orders hold at most a fifth of the unsold seats at once (always at least one); a
  buyer past that is asked to try again in a few minutes.
- An admin must have signed in with Google; an Email-provider account with the same address is not
  an admin.
- A refund never removes a lifetime that an admin granted by hand.
- The web visit counter stops at 1,000,000 per day and page. Treat those numbers as indicative:
  anyone holding the public key can call it.

## Paid orders kept, record ceiling (2026-11-19)

Apply `supabase/migrations/20261119_keep_paid_orders_and_record_caps.sql` in the SQL editor, then
redeploy `supabase functions deploy delete-account`. After it:

- Deleting an account keeps its payment orders, with no account attached. Founder seats that were
  sold stay sold, a later refund still finds its order, and revenue totals stay whole.
- A payment that settles after its buyer deleted the account is recorded as paid; nobody gets PRO.
- Deleting an account needs a sign-in in the last 10 minutes. The app tells the lifter to sign out
  and in again first.
- Each account holds at most 200 MB of synced records, and a record dated more than a day ahead is
  refused.

## Going live

1. Turn the test buttons off: run `update public.app_remote_config set payments_sandbox = false;`.
2. Production Server Key: run `supabase secrets set MIDTRANS_SERVER_KEY=Mid-server-xxxx MIDTRANS_IS_PRODUCTION=true`.
3. Set the same Notification and Redirect URLs in the **Production** dashboard.
4. Redeploy both functions so they pick up the new secrets.
5. Clear the Sandbox orders, so Mission Control's Customers tab counts only real money. Do it right
   after step 2 and before the first real payment. Look first:
   `select order_id, user_id, plan, status, payment_type, created_at from public.payment_orders order by created_at;`
   Then, in the SQL editor, PRO that a Sandbox order granted goes back to free and the orders go:
   ```sql
   begin;
   update public.user_entitlements set tier = 'free', pro_expires_at = null, source = 'sandbox-cleared'
     where source in (select 'midtrans:' || order_id from public.payment_orders);
   delete from public.payment_events;
   delete from public.payment_orders;
   commit;
   ```
   Accounts that got PRO from a code or a manual grant keep it.
6. Lock PRO to signed licences, in Vercel and in the repository's Actions variables, then redeploy
   and rebuild the APK:
   - `NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY` (see Signed licences above). Without it a build trusts the
     tier stored on the phone, which anyone can edit.
   - `NEXT_PUBLIC_ABOT_MONETIZATION_FLOOR=COMMERCIAL_LIVE`. Without it, editing the cached remote
     config back to beta reopens every PRO feature.
   The APK build stops with an error when the floor is live and the key is missing.

The seat cap is in `app_remote_config.founder_seats`, for example `update public.app_remote_config set founder_seats = 300;`. A pending founder order holds a seat for 30 minutes, and its Midtrans payment page closes after the same 30 minutes. Seats are taken under a database lock, so two buyers cannot both get the last one. If a founders payment still settles past the cap (Midtrans grace, a manual settlement), the buyer gets lifetime and the order is marked `over_cap` for you to review or refund: `select order_id, user_id, paid_at from public.payment_orders where over_cap;`. Mission Control shows it as OVER CAP.

## Google Play note

The owner chose to show the Midtrans checkout inside the Android app as well (2026-11-11). Google Play's payments policy requires Play Billing for digital goods unless the app is enrolled in User Choice Billing, which is available in Indonesia. Showing another checkout without that enrolment risks the app being rejected or removed.

If Google objects, untick **Also in the Android app** in Mission Control. The Android app then hides the buy button at once, with no new build, and the web keeps selling.

## Tax and legal (from `reports/ABOT payment spec Indonesia.md`)

- No PPN while turnover is under Rp 4,8 miliar a year.
- Final income tax is 0.5%, and the first Rp 500 juta a year is free for individuals.
- You need an NPWP, an NIB, PSE registration with Komdigi, and a written refund policy.
