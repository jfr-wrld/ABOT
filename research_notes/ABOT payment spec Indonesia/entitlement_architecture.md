# Entitlement and licensing architecture for an offline-first app (ABOT, as of Nov 2026)

Method note: revenuecat.com and its docs mirrors (www-docs, docs-origin) could not be fetched from this session (host not on the network allowlist). RevenueCat facts below come from search-result extracts of RevenueCat's own pages and community forum threads, not full-page reads, so the report writer should treat exact RevenueCat wording as "per search extract". Google's developer.android.com pages were fetched in full.

## 1. RevenueCat as the entitlement source (offline cache, web purchases, aliasing, webhooks, pricing)

### Takeaway
RevenueCat's SDK caches CustomerInfo on disk and keeps serving it offline indefinitely, but it does not tell you the data is stale, so it is not a time-bounded offline licence. Web sales go through a separate `purchases-js` SDK (RevenueCat Billing on Stripe, or Stripe/Paddle Billing), other gateways need the v1 "grant promotional entitlement" endpoint, and the free tier is reported as $2,500 MTR then 1%.

### Cited Findings
**Offline caching**
- The SDK refreshes CustomerInfo when the cache is older than 5 minutes and the app is in the foreground; one doc page says the refresh only happens when your code calls `getCustomerInfo()`, makes a purchase, or restores. — [RevenueCat docs: Caching](https://www.revenuecat.com/docs/test-and-launch/debugging/caching)
- Cached CustomerInfo is returned offline "forever" if the user never goes online, unless something invalidates the cache; `app_user_id` and CustomerInfo persist across app launches and `logOut` clears the cache. — [RevenueCat docs: Caching](https://www.revenuecat.com/docs/test-and-launch/debugging/caching)
- A developer reports that offline CustomerInfo for an uncached user looks identical to "no entitlements", with no offline indicator in the response. — [RevenueCat community #3635](https://community.revenuecat.com/sdks-51/how-do-we-differentiate-if-customerinfo-is-missing-entitlements-because-not-purchased-or-because-offline-3635)
- A community post (not official docs) says backgrounded apps refresh about every 25 hours. — [RevenueCat community #2407](https://community.revenuecat.com/general-questions-7/does-the-getcustomerinfo-function-work-periodically-in-a-non-sandbox-environment-2407)
- `invalidateCustomerInfoCache()` forces a re-fetch. — [RevenueCat community #4452](https://community.revenuecat.com/sdks-51/purchases-getcustomerinfo-returns-incorrect-cached-value-no-matter-what-fetch-policy-i-try-4452)
- The separate "Offline Entitlements" feature covers RevenueCat *server* outages: on Android it reads current purchases through Play BillingClient and computes entitlements on device; purchases made during the outage are queued. — [RevenueCat blog: Introducing offline entitlements](https://www.revenuecat.com/blog/engineering/introducing-offline-entitlements/)
- RevenueCat says Offline Entitlements still left "a couple of scenarios" uncovered, which its later "Fortress" system addresses. — [RevenueCat blog: Building the RC Fortress](https://www.revenuecat.com/blog/engineering/building-the-rc-fortress/)
- Google Play API incidents still happen (e.g. ~4h on 29 May 2026), and during one RevenueCat granted temporary entitlements to affected customers. — [isdown RevenueCat incident 597616](https://isdown.app/status/revenuecat/incidents/597616-elevated-google-play-api-error-rate)

**Capacitor and web**
- `@revenuecat/purchases-capacitor` is listed as an iOS/Android plugin (latest 13.0.x on npm). Web Billing uses a separate package, `@revenuecat/purchases-js`. — [Socket: @revenuecat/purchases-capacitor](https://socket.dev/npm/package/@revenuecat/purchases-capacitor); [RevenueCat Web SDK docs](https://production-docs.revenuecat.com/docs/web/web-billing/web-sdk)
- No Capacitor 8 compatibility statement from RevenueCat was found. The Capawesome `@capawesome-team/capacitor-purchases` plugin lists Capacitor >= 8. — [Capawesome purchases plugin](https://capawesome.io/plugins/purchases)
- RevenueCat web billing engines: RevenueCat Billing (on Stripe), Stripe Billing, Paddle Billing. RevenueCat charges no extra fee for web; processing is Stripe's (e.g. 2.9% + $0.30 US) plus the normal 1% above $2,500 MTR. Stripe Billing adds 0.7% of volume. — [RevenueCat Web overview](https://www.revenuecat.com/docs/web/overview); [RevenueCat Billing](https://www.revenuecat.com/billing)
- The Paddle integration does not support Paddle's abandoned-cart emails. — [RevenueCat blog: win-back with Web Billing](https://www.revenuecat.com/blog/growth/how-to-build-a-win-back-campaign-with-revenuecat-web-billing)
- For other gateways: `POST /v1/subscribers/{app_user_id}/entitlements/{entitlement_id}/promotional` with a secret key grants an entitlement for a `duration` (forum: `expires_at` not accepted); `.../revoke_promotionals` revokes. Staff say REST API v2 does not grant entitlements directly. — [RevenueCat API v1: Entitlements](https://www.revenuecat.com/docs/api-v1/entitlements); [community #6621](https://community.revenuecat.com/third-party-integrations-53/how-to-add-entitlement-to-customer-using-rest-api-v2-6621); [community #2014](https://community.revenuecat.com/sdks-51/nodejs-rest-api-for-grant-a-promotional-entitlement-seems-not-work-2014?postid=6510)

**App User ID aliasing**
- Without a custom ID the SDK creates an anonymous App User ID; `logIn(customId)` may alias and merge CustomerInfo when the custom ID is new. — [RevenueCat docs: Identifying customers](https://www.revenuecat.com/docs/customers/identifying-customers)
- If `logIn` runs after configure/purchase, the purchase can attach to the anonymous ID; webhooks then carry the anonymous ID in `app_user_id`, and the custom ID must be found in `aliases`. Staff recommend using only custom IDs. — [community #5562](https://community.revenuecat.com/sdks-51/issue-with-anonymous-app-user-id-on-webhook-breaking-subscription-flow-5562); [community #6880](https://community.revenuecat.com/general-questions-7/revenuecat-webhooks-only-return-anonymous-app-user-id-even-after-login-with-custom-user-id-6880)
- Aliasing an anonymous purchaser on login does not fire a TRANSFER webhook. — [community #6767](https://community.revenuecat.com/general-questions-7/no-transfer-webhook-when-logging-in-after-anonymous-purchase-6767)
- A developer reports passing the Supabase UUID from first launch, since Supabase anonymous auth keeps the same user id across the anon-to-email upgrade. — [FlutterFlow community: RevenueCat and Supabase Auth](https://community.flutterflow.io/database-and-apis/post/revenuecat-and-supabase-auth-PODpamB2b3k7ldI)
- Restore behaviour is project-wide. The default "Transfer to new App User ID" moves purchases to the new ID unless they contain an active subscription; one-time purchases do not block transfers. "Keep with original App User ID" errors when another ID restores. "Share between App User IDs" is legacy-only. — [RevenueCat docs: Restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior)

**Webhooks to Supabase**
- Returning 400 for an unknown user makes RevenueCat retry; a forum answer recommends logging and returning 200. — [community #6557](https://community.revenuecat.com/third-party-integrations-53/error-extracting-app-user-id-from-webhook-in-supabase-400-user-id-not-found-6557)
- A thread reports a read-after-write gap between webhook delivery and the v1 subscribers endpoint. — [community #7813](https://community.revenuecat.com/general-questions-7/read-after-write-gap-between-webhook-events-and-v1-subscribers-7813)

**Pricing**
- Third-party 2026 sources agree: free up to $2,500 monthly tracked revenue (MTR), then 1% of MTR; months under $2,500 drop back to free. The official pricing page was not reachable. One CostBench page says "no free tier", which conflicts. — [pricepush glossary: MTR (Nov 2026)](https://pricepush.app/glossary/monthly-tracked-revenue); [costbench RevenueCat free plan](https://costbench.com/software/subscription-billing/revenuecat/free-plan/); [pricingsaas 2026Q2 diff](https://pricingsaas.com/companies/revenuecat/diffs/2026Q2)

### Inferences
- For ABOT, RevenueCat's cache alone cannot answer "how long do I trust PRO offline?". The app should still write its own `{tier, validUntil, lastVerifiedAt}` record from CustomerInfo and apply its own offline window.
- Configure RevenueCat with the Supabase `auth.uid()` as the App User ID from first launch (Supabase anonymous sign-in gives a stable UUID before Google sign-in). This avoids anonymous IDs in webhooks and the missing TRANSFER event.
- Web flow options: (a) `purchases-js` + RevenueCat Billing (Stripe) on the PWA, which RevenueCat then exposes to Android with the same App User ID; or (b) an Indonesian gateway (Midtrans, Xendit, etc.) webhook to a Supabase Edge Function, which calls the v1 promotional endpoint. A lifetime promo grant appears to need the "lifetime" duration value; this is not confirmed (see Gaps).
- At ABOT's likely scale, RevenueCat is free.

### Gaps
- Could not read the official RevenueCat pricing page, Capacitor install page, or v1 promotional `duration` enum (whether `lifetime` is accepted) because the domain is blocked. Verify both.
- No confirmation that `purchases-capacitor` 13.x supports Capacitor 8, or that its web build delegates to `purchases-js`.
- Did not confirm whether RevenueCat Billing/Stripe supports IDR or Indonesian local methods (QRIS, e-wallets).
- Webhook auth (shared Authorization header value set in dashboard) and event list were not captured from primary docs.

## 2. Alternatives (Adapty, Qonversion, Glassfy, Apphud) and self-hosting on Supabase Edge Functions

### Takeaway
Glassfy is dead (ended operations around end of 2024). Adapty, Qonversion and Apphud have free tiers of roughly $5K-$10K MTR, but the numbers conflict between sources. Self-hosting Play verification on Supabase Edge Functions is feasible within the free tier, but the developer must own acknowledgement, RTDN/Pub/Sub auth, state mapping and refunds.

### Cited Findings
- Glassfy's archived SDK repo marks the SDKs deprecated, with operations ending at the end of 2024; Qonversion markets a migration page. — [Qonversion: Glassfy alternative](https://qonversion.io/glassfy-alternative); [sph.sh: RevenueCat alternatives 2026](https://sph.sh/en/posts/revenuecat-alternatives-comparison-2026/)
- Adapty: free tier commonly reported as $5K monthly revenue, then 1%; one blog says it was doubled to $5K in early 2026. — [theswiftk.it: RevenueCat vs Adapty vs Qonversion (2026)](https://theswiftk.it.com/blog/revenuecat-vs-adapty-vs-qonversion-ios); [yurudeep comparison May 2026](https://yurudeep.com/posts/web/2026/20260524/en/)
- Qonversion: $7K MTR then 0.8% per a Qonversion page and a late-2026 comparison; other 2026 posts say $10K. — [IndieAppStack PR #23](https://github.com/Sangsom/IndieAppStack/pull/23); [theswiftk.it](https://theswiftk.it.com/blog/revenuecat-vs-adapty-vs-qonversion-ios)
- Apphud: a November 2026 community capture says a free plan for apps under $10K/month and a revenue-share Pro at 0.99%; an older 2026 guide describes a flat ~$49/month Pro. Conflicting. — [revenuedot PR #166 (prices checked Nov 2026)](https://github.com/revenuedot/revenuedot/pull/166); [sph.sh](https://sph.sh/en/posts/revenuecat-alternatives-comparison-2026/)

**Self-hosting: Google Play facts**
- `purchases.subscriptionsv2.get` "is considered the source of truth"; `purchases.subscriptions.get` is deprecated. The purchase token stays valid until 60 days after expiration. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- Unacknowledged new subscriptions are refunded and revoked after three days. If a purchase fails checks, don't wait: revoke with `purchases.subscriptionsv2.revoke` and `"fullRefund": {}`. Renewals need no acknowledgement. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- Grant access only when `subscriptionState == SUBSCRIPTION_STATE_ACTIVE` (or in grace); the user can be identified via `externalAccountIdentifiers` if `setObfuscatedAccountId`/`setObfuscatedProfileId` were set at purchase. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- Grace period is on by default; users keep access during grace, and `expiryTime` is extended through it. A 0-day grace still has a minimum 1-day silent grace. Account hold is on by default, lasting 60 days minus the grace period, with no access during hold. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- Upgrades, downgrades and resubscribes create a new token with `linkedPurchaseToken` pointing at the old one. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- RTDN: notifications "tell you only that the purchase state changed"; you must call the Developer API for the full state. Payload is base64 JSON in a Pub/Sub message; Google advises de-duplicating by `messageId`. Types include subscription types 1-13, 17-22, `ONE_TIME_PRODUCT_PURCHASED/CANCELED` (opt-in), `voidedPurchaseNotification` (with `refundType`), and `pendingRefundReviewNotification`. — [Android: RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference)
- Pub/Sub push with authentication sends a Google-signed JWT in `Authorization`. Verify the signature, `aud` (defaults to the endpoint URL), `exp`, and the service-account `email` claim yourself. IAM propagation can cause temporary 403 retries. — [Google Cloud: Authenticate push subscriptions](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions); [Hookdeck: Pub/Sub webhooks](https://hookdeck.com/webhooks/skills/google-pubsub-webhooks)
- Supabase free plan: reported 500K Edge Function invocations/month, Pro $25/month with 2M; free projects pause after 7 days of inactivity (third-party sources). — [designrevision: Supabase pricing 2026](https://designrevision.com/blog/supabase-pricing.md); [jetadmin: Supabase pricing 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)

### Inferences
- Self-hosting effort for ABOT, roughly: (1) a Google Cloud service account with Play Console API access, minting OAuth tokens in Deno (JWT RS256 signing); (2) a `verify-purchase` edge function the app calls after `onPurchasesUpdated`, which calls `subscriptionsv2.get` or `productsv2`, checks `obfuscatedExternalAccountId == auth.uid()`, writes the entitlement, then acknowledges; (3) an `rtdn` edge function with Pub/Sub OIDC verification, `messageId` dedupe, and re-fetch of state; (4) handling for voided purchases and `linkedPurchaseToken`; (5) a periodic reconcile. This is several days of work, and the testing surface is mostly in Play's test tracks.
- Pitfalls: the free-tier project pause after 7 days of inactivity breaks RTDN delivery and acknowledgement, and the 3-day acknowledge window will refund buyers. Pub/Sub retries help only up to its retention. The owner would effectively need Supabase Pro ($25/month) or a keep-alive. RevenueCat avoids this at $0 under $2,500 MTR.
- A web-gateway lifetime sale is easy either way: gateway webhook, then an Edge Function writes to `entitlements`.

### Gaps
- Official vendor pricing pages for Adapty, Qonversion and Apphud were not fetched; numbers are from community trackers and conflict.
- Whether Adapty/Qonversion/Apphud ship maintained Capacitor 8 plugins was not checked.
- The exact pause semantics of a paused free Supabase project for incoming webhooks were not verified from Supabase docs.

## 3. Offline-first patterns: signed tokens, offline trust window, clock tampering, lapse while offline

### Takeaway
Use a server-signed, short-lived entitlement token (Ed25519/JWT) with `validUntil = min(storeExpiry, issuedAt + offlineWindow)` and a stored "last seen time" high-water mark. Signing prevents editing the expiry, but not winding the clock back, so clock defence must be heuristic plus revalidation when online.

### Cited Findings
- Keygen states that offline clock-tampering defence is out of its scope and must be done in application code; real defence needs periodic online validation. — [Keygen docs: Security](https://keygen.sh/docs/api/security/)
- Keygen's heuristic: write an inconspicuous file and compare its created/modified timestamps; a clock more than a couple of hours behind them suggests tampering. Its Go SDK exposes `ErrSystemClockUnsynced` and `ErrLicenseFileExpired`, and verification needs the embedded public key. — [Keygen docs: Security](https://keygen.sh/docs/api/security/); [keygen-go](https://pkg.go.dev/github.com/keygen-sh/keygen-go/v2)
- Licenz cross-checks the system clock against the build timestamp, licence issue time and last-validation time, with optional network time; tampering with a signed expiry is detectable. — [Licenz: Security model](https://licenz-site.pages.dev/docs/concepts/security-model)
- The `gatewarden` crate verifies Keygen's Ed25519 response signatures, rejects stale responses, and fails closed on missing signatures. — [gatewarden on docs.rs](https://docs.rs/crate/gatewarden/latest)
- Google's own entitlement model gives lapsed payers a grace period (access kept) then account hold (no access), up to 60 days in total by default. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)

### Inferences
- Suggested ABOT rules:
  - Token payload: `{sub: supabase_uid, tier, src: play|web|code, exp_store, iat, valid_until, kid}`, signed by an Edge Function with an Ed25519 key held in Supabase secrets. The public key is baked into the build, and `kid` allows rotation.
  - `valid_until` for subscriptions: store expiry + 3-7 days (grace). For lifetime: `iat` + a long window (e.g. 30-90 days) or no expiry. A refund must still be able to propagate when the device next comes online.
  - Monotonic `lastSeenAt` stored in IndexedDB. If `now < lastSeenAt - 2h`, treat it as tampering: do not extend PRO, and show "connect to verify".
  - Lapse while offline: keep PRO until `valid_until`, then degrade softly to read-only PRO data. Never delete user data. Re-verify on the next connection.
- On Android only, the Play BillingClient `queryPurchasesAsync` works from Play's local cache and can act as a second offline signal (this is what RevenueCat's Offline Entitlements relies on).
- Offline window choice: 7 days past a monthly expiry, matching Play's default grace, is a common, defensible number; a gym app has low fraud value, so erring generous is reasonable.

### Gaps
- No primary Supabase doc was gathered on signing custom JWTs/Ed25519 inside Edge Functions (Deno WebCrypto Ed25519 support should be verified).
- No published industry benchmark for the "right" offline trust window was found.

## 4. Restore purchases and cross-device (Supabase account, anonymous users, obfuscatedAccountId, lifetime web<->Android)

### Takeaway
Make the Supabase user id the single identity: pass it as RevenueCat App User ID (or as Play `obfuscatedAccountId` if self-hosting) and key all entitlements to it. Purchases then follow the account, not the device, and a web-bought lifetime licence carries to Android by signing in.

### Cited Findings
- Play returns `externalAccountIdentifiers` (obfuscated account/profile ids) in `subscriptionsv2` when set via `BillingFlowParams.setObfuscatedAccountId`; it is the documented way to map a purchase to your user. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- `obfuscatedAccountId` also arrives in `pendingRefundReviewNotification`. — [Android: RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference)
- RevenueCat's default restore transfers purchases to the restoring App User ID unless they include an active subscription; one-time purchases always transfer. — [RevenueCat docs: Restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior)
- Supabase anonymous auth keeps the user id when the anonymous user upgrades, per a developer report. — [FlutterFlow community](https://community.flutterflow.io/database-and-apis/post/revenuecat-and-supabase-auth-PODpamB2b3k7ldI)
- Late `logIn` attaches purchases to an anonymous ID. — [RevenueCat community #5562](https://community.revenuecat.com/sdks-51/issue-with-anonymous-app-user-id-on-webhook-breaking-subscription-flow-5562)

### Inferences
- Require sign-in (Google, or at minimum Supabase anonymous auth) before checkout, so every purchase is tagged with a `uid`. A purely local user with no uid can still buy on Play, and "Restore" then calls `queryPurchasesAsync` and verifies server-side, which binds the token to the newly signed-in uid.
- Web lifetime to Android: the gateway webhook writes an `entitlements` row for the uid; Android signs in and receives a signed token. Android lifetime to web works the same way through the Play verify function or the RevenueCat webhook.
- Abuse limit: because RevenueCat transfers one-time purchases on restore, a Play lifetime purchase could move between accounts. With a self-hosted design, bind the purchase token to the first uid and refuse or flag re-binding.
- The existing founder unit codes and redeem codes become another `source='code'` row in the same table.

### Gaps
- Not verified: whether Supabase anonymous-user ids survive `linkIdentity` with Google in all flows (official doc not fetched).

## 5. Anti-tamper realism for a client-only gate

### Takeaway
For a low-price indie gym app, a server-signed entitlement token plus a server-verified purchase is the right ceiling. Play Integrity is free (10K/day) but adds complexity and does not stop patched APKs from flipping a local boolean. Any gate that runs only on the client can be bypassed by a determined user.

### Cited Findings
- The Play Integrity default quota is 10,000 requests/day, shared between classic and standard requests, and raisable via form if the app is on Play and the Cloud project is linked. — [Android: Play Integrity overview](https://developer.android.com/google/play/integrity/overview); [Play Console Help 11395166](https://support.google.com/googleplay/android-developer/answer/11395166)
- Google advises: if a purchase fails your verification or fraud checks, revoke and refund immediately instead of waiting out the window. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- A third-party guide argues Play Integrity is worth enforcing only for some app classes. — [trysonar: Play Integrity, when to enforce](https://trysonar.app/blog/play-integrity-api-when-to-enforce-when-to-skip.md)

### Inferences
- Worth doing: server-side purchase verification; a signed token instead of a plain `tier` field in IndexedDB (a user editing IndexedDB or the Zustand store cannot forge it); keeping PRO-only *cloud* features (sync, backups) behind RLS that checks `entitlements`, since those are truly enforceable.
- Over-engineering for ABOT: Play Integrity on every launch, root/jailbreak detection, code obfuscation of gating, and certificate pinning. Optionally call Play Integrity once in the `verify-purchase` function.
- Existing offline built-in redeem codes are the weakest link: they ship in the bundle. Keep them only for the founders beta, or replace them with signed codes (Ed25519-signed payload, verified with the public key).

### Gaps
- No data found on actual piracy rates for low-price fitness apps.

## 6. Refunds, chargebacks, revocation and family sharing

### Takeaway
Play reports refunds and chargebacks via `SUBSCRIPTION_REVOKED`, `voidedPurchaseNotification` and `ONE_TIME_PRODUCT_CANCELED`, plus the Voided Purchases API as a pull backstop. A newer `pendingRefundReviewNotification` lets developers contest chargebacks within 24h. Offline devices see a revocation only when their token expires or they reconnect. Play Family Library historically excludes in-app products and subscriptions.

### Cited Findings
- `SUBSCRIPTION_REVOKED` (12) fires when a subscription is revoked before expiry, for example by `subscriptionsv2.revoke` or a chargeback; revoke access. — [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions); [Android: RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference)
- `VoidedPurchaseNotification` carries `purchaseToken`, `orderId` (a new orderId per subscription renewal), `productType`, and `refundType` (full or quantity-partial). The Voided Purchases API offers time-range pull. — [Android: RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference)
- `purchases.voidedpurchases.list` is a GET on `applications/{packageName}/purchases/voidedpurchases`. — [RevenueCat Google Play guide: API quick reference](https://www.revenuecat.com/guides/google-play-billing/appendix-google-play-developer-api-quick-reference)
- `PendingRefundReviewNotification`: for chargeback requests needing developer review; respond within 24 hours via the `orders.reviewrefund` API, with evidence. — [Android: RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference)
- Play terms (2016 Family Library launch): in-app and subscription products cannot be shared in a family group; paid-app sharing was developer opt-in and irreversible. — [Play Console Help 12154973](https://support.google.com/googleplay/android-developer/answer/12154973); [BetaNews 2016](https://betanews.com/2016/07/03/google-play-family-library-app-game-sharing)
- RevenueCat v1 has `revoke_promotionals` to remove web or promo grants. — [RevenueCat API v1: Entitlements](https://www.revenuecat.com/docs/api-v1/entitlements)

### Inferences
- Revocation reaches an offline device at the latest at the token's `valid_until`. For lifetime licences, a long offline window means a refunded lifetime can persist for that window. Keep it moderate (e.g. 30 days) or accept the risk.
- Web gateway refunds and chargebacks need the same treatment: the gateway webhook marks the entitlement revoked.
- Family sharing: for ABOT's subscription and lifetime IAP, nothing to handle on Play.

### Gaps
- No current (2025-2026) Google page confirming that Family Library still excludes IAP and subscriptions was found.

## 7. Data model, idempotent webhooks, and migration from redeem_code/user_entitlements

### Takeaway
Use an append-only `purchase_events` log keyed by provider event id (unique constraint, so retries are idempotent) and a derived `entitlements` table, one row per user per source. Have clients read a signed token or their own row through RLS, and let only service-role Edge Functions write.

### Cited Findings
- Google recommends de-duplicating RTDN by `messageId` and always re-reading state from the API rather than trusting the notification. — [Android: RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference)
- RevenueCat webhooks retry on non-2xx, so handlers should return 200 for events they cannot map. — [RevenueCat community #6557](https://community.revenuecat.com/third-party-integrations-53/error-extracting-app-user-id-from-webhook-in-supabase-400-user-id-not-found-6557)
- Order ids change per renewal and tokens change on upgrade (`linkedPurchaseToken`). — [Android: RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference); [Android: Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)

### Inferences
- Suggested schema (Postgres, RLS on):
  - `purchase_events(id bigserial, provider text check in ('play','revenuecat','web_gateway','code','admin'), provider_event_id text, user_id uuid null, raw jsonb, received_at timestamptz, processed_at timestamptz, unique(provider, provider_event_id))`. Insert with `on conflict do nothing`; process only if inserted. No client access.
  - `purchases(id, user_id, provider, product_id, purchase_token text unique, linked_purchase_token, order_id, kind check in ('subscription','lifetime'), state, expires_at, acknowledged bool, revoked_at, updated_at)`.
  - `entitlements(user_id, source, tier check in ('pro','lifetime'), valid_from, expires_at null, revoked_at null, purchase_id null, primary key(user_id, source))`. Effective tier is derived by a view or `get_my_entitlement()` RPC that also mints the signed token.
  - Keep `redeem_codes` and the `redeem_code` function, but have it insert into `entitlements` with `source='code'` and log a `purchase_events` row. Migrate `user_entitlements` rows into `entitlements` (`source='legacy'`), then turn `user_entitlements` into a compat view during the transition.
- Client: on launch or regaining connectivity, call `get_my_entitlement()`. Store the signed token in Dexie. The UI gate verifies signature, `valid_until` and the clock high-water mark. Keep the build switch (`FOUNDERS_BETA`/`COMMERCIAL_LIVE`) as an outer override.
- The remote config of prices should come from the store/RevenueCat offerings in COMMERCIAL_LIVE (Play requires showing Play's localised price), not from the Supabase config.

### Gaps
- Play's policy requirement to display Play-provided localised prices was not sourced in this pass.
- RevenueCat webhook payload field list and auth header mechanism were not captured from primary docs.
