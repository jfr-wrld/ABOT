# Google Play Billing for ABOT in Indonesia (status as of Nov 2026)

Research note: `support.google.com` and `android-developers.googleblog.com` could not be fetched from this session (network allowlist). Claims from those pages come from search-result excerpts of the pages, not full reads, and are marked "(excerpt)". `developer.android.com` was fetched directly.

## 1. Payments policy, User Choice Billing, and the KPPU case

### Takeaway
Digital subscriptions and lifetime unlocks sold inside the Android app must go through Google Play Billing, unless the developer enrols in User Choice Billing (UCB). Google's UCB page lists Indonesia, with a 4% fee reduction when the user picks the alternative biller. KPPU's January 2025 ruling ordered UCB for all developers with a fee cut of at least 5%. That ruling is final: the Commercial Court rejected Google's objection in June 2025 and the Supreme Court rejected its appeal by March 2026. I found no source saying Google has put the 5% figure into effect.

### Cited Findings
- KPPU found Google guilty of forcing developers to use Google Play Billing for in-app purchases. It fined Google Rp 202.5 billion (about US$12.6M) and ordered it to stop requiring Play Billing, to open UCB to all developers, and to give a service-fee discount of at least 5% for one year after the decision becomes final — [TechCrunch, 22 Jan 2025](https://techcrunch.com/2025/01/22/google-hit-with-12-6m-fine-in-indonesia-for-monopolistic-practices-in-payment-system); [Tempo](https://en.tempo.co/read/1966803/indonesias-kppu-fines-google-rp202-5bn-for-monopolistic-practices)
- The Central Jakarta Commercial Court rejected Google's objection in June 2025, and Google appealed to the Supreme Court — [Bernama](https://www.bernama.com/en/world/news.php?id=2534197)
- The Supreme Court rejected Google's appeal, so the KPPU ruling is valid and binding (reported 13 Mar 2026) — [Xinhua, 13 Mar 2026](https://english.news.cn/20260313/ae94e8ba64944f0f872c1051cc3b0c96/c.html); [Telusur (ID)](https://telusur.co.id/detail/ma-tolak-kasasi-google-putusan-kppu-soal-google-play-billing-berkekuatan-hukum-tetap)
- Google's UCB help page lists "Australia, Brazil, Indonesia, Japan, South Africa, United Kingdom, or EEA". It also says the fee "for Brazil, Indonesia, and South Africa is reduced by 4% for transactions where users pay with an alternative billing system until the updated service fees roll out globally" (excerpt) — [Play Console Help: Understanding user choice billing](https://support.google.com/googleplay/android-developer/answer/13821247?hl=en)
- From 30 Jun 2026, Google's new billing-choice programme lets developers offer alternative billing or link users out to the web in the US, UK and EEA, "with more markets coming soon" — [Google Play: The Latest Q2 2026](https://google.play/the-latest/2026-q2/); [gHacks, 25 Jun 2026](https://www.ghacks.net/2026/06/25/google-play-billing-choice-program-goes-live-june-30-with-lower-developer-fees-and-third-party-billing/)
- Rollout dates for the new structure: US/EEA/UK on 30 Jun 2026, AU/JP on 30 Sep 2026, KR on 31 Dec 2026 — [Play Console Help: lower service fees (excerpt)](https://support.google.com/googleplay/android-developer/answer/16954621?hl=en)
- An Indonesian outlet reports that the new system reaches Indonesia on 30 Sep 2027 — [Journalarta, 26 Jun 2026](https://journalarta.com/en/technology/impact-google-play-store-changes-indonesian-game-developers/) (secondary; not confirmed on a Google page)
- If ABOT uses UCB, it must still offer Play Billing alongside its own biller. The user picks, and Google charges a reduced fee on the alternative path — [Play Console Help: UCB (excerpt)](https://support.google.com/googleplay/android-developer/answer/13821247?hl=en)

### Inferences
- In practice, UCB in Indonesia saves only 4 percentage points (perhaps 5 if Google applied the KPPU order). ABOT would also have to integrate a second PSP (Midtrans or Xendit, for example) and handle tax and support for that path. For a small app, Play Billing alone is the simpler first step. UCB is an option to revisit later.
- Selling on the web and PWA through ABOT's own checkout falls outside Play policy, as long as the Android app does not steer users to it in a way the policy prohibits. Redeem codes that a user types in the app to unlock a purchase made off-Play are a grey area. Check the Payments policy text before shipping them.

### Gaps
- I found no Google page confirming that Google has applied the KPPU-ordered "at least 5%" UCB discount for Indonesia. It is also unclear whether the order is being treated as fulfilled by Indonesia already being on the UCB list.
- I could not read the full current Payments policy text (support.google.com was blocked). It needs a direct read for the rules on in-app redeem codes and links to web purchases from the Indonesian app.

## 2. Service fees and Indonesian VAT (PPN)

### Takeaway
Indonesia has not yet moved to the new fee structure. Google's fee page lists 15% on the first US$1M a developer earns each year, 30% above that, and 15% on auto-renewing subscriptions from day one. At ABOT's scale, all three products, including the lifetime one-time purchase, fall in the 15% bracket. Google sets, collects and remits Indonesian VAT on Play sales, so the developer does not. The effective rate appears to be 11%.

### Cited Findings
- Current fee for markets not yet on the new structure: 15% on the first $1M (USD) of developer revenue each year, 30% above that (excerpt) — [Play Console Help: Service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- Auto-renewing subscriptions pay 15%, cut from 30% on 1 Jan 2022 — [MacRumors, Oct 2021](https://www.macrumors.com/2021/10/21/google-lowers-play-store-subscription-fee/) (older announcement; the 15% subscription rate is still current outside the new-structure markets per the Play Help excerpt above)
- New structure where it applies: a 10% service fee on the first $1M and on all auto-renewing subscriptions, plus a separate 5% billing fee only when Google Play Billing is used — [daily.dev summary of Google blog](https://daily.dev/posts/expanded-billing-choice-and-lower-fees-on-google-play-sm1ll46zy); [PocketGamer.biz](https://www.pocketgamer.biz/google-play-expands-billing-options-and-lowers-fees-for-developers/). Reported rates above $1M for one-time products: 20% for new installs, 25% for existing installs — [Journalarta](https://journalarta.com/en/technology/impact-google-play-store-changes-indonesian-game-developers/) (secondary; sources disagree on the tiers)
- Google became responsible for determining, charging and remitting Indonesian VAT on Play paid apps and in-app purchases from 1 Aug 2020. Developers do not calculate or remit it separately — [Google notice relayed on KDE mailing list, Jul 2020](https://mail.kde.org/pipermail/marble-devel/2020-July/009607.html)
- Google told users the Play VAT rate would rise from 11% to 12% on 1 Jan 2025 — [Jakarta Post, 5 Dec 2024](https://www.thejakartapost.com/business/2024/12/05/google-alerts-users-of-12-vat-on-services-from-jan-1)
- Under PMK 131/2024, 12% applies to an 11/12 tax base, so the effective rate stays at 11% for non-luxury goods and services. Reporting says Google Play returned to the effective 11% rate — [Makarim & Taira advisory](https://makarim.com/news/understanding-indonesia-s-new-vat-calculations/pdf); [Bloomberg Technoz (ID)](https://www.bloombergtechnoz.com/detail-news/59539/toko-aplikasi-google-balik-ke-tarif-ppn-11-ini-kata-perusahaan/2)

### Inferences
- Play prices in IDR include VAT. Rough net per sale with a 15% fee and 11% effective VAT inside the price: Rp 29.000 / 1.11 × 0.85 ≈ Rp 22.200; Rp 199.000 → ≈ Rp 152.400; Rp 399.000 → ≈ Rp 305.500; Rp 798.000 → ≈ Rp 611.000. These are estimates and exclude withholding and FX effects.
- If the new structure reaches Indonesia on 30 Sep 2027, Play-billed subscriptions stay at about 15% (10% + 5%), and the lifetime purchase also stays at 15% under $1M.

### Gaps
- No Google page in this research states the Play VAT rate for Indonesia as of Nov 2026, or confirms the 2027 date for Indonesia.

## 3. IDR pricing

### Takeaway
All four price points sit well above the last documented Play minimum for Indonesia, which is Rp 3.000 (2015). I found no current official IDR minimum or maximum. Play Console lets you set a price per country and use pricing templates. Enter IDR prices manually so FX conversion does not produce odd numbers.

### Cited Findings
- In Nov 2015 Google lowered Indonesia's minimum price for paid apps and in-app products to Rp 3.000 (from Rp 12.000) — [Android Developers Blog, Nov 2015](https://android-developers.googleblog.com/2015/11/minimum-purchase-price-for-apps-and-in.html); [TechCrunch, Nov 2015](https://techcrunch.com/2015/11/17/google-lowers-minimum-price-for-android-apps-and-in-app-purchases-in-17-countries/) (OLD)
- A 2026 pricing guide uses Rp 39.000 (~US$2.70) as a sample Indonesian price point — [regionalpricecalculator.com](https://regionalpricecalculator.com/blog/google-play-pricing-strategy.html) (commercial, illustrative only)

### Inferences
- Rp 29.000/month, Rp 199.000/year (about 43% off 12 × monthly), Rp 399.000 and Rp 798.000 are all plausible Play prices. The Founders split (Rp 399.000 vs Rp 798.000) could be done two ways: two one-time products, or one one-time product with a discounted purchase option or offer under Play's newer one-time-product model. A limited Rp 399.000 founders SKU is the simplest.
- Rp 798.000 is more than most Indonesian Play gift-card and voucher top-ups. Users paying with e-wallets need enough balance (see section 4).

### Gaps
- Current Play Console IDR minimum and maximum, and price-template behaviour, could not be confirmed (support.google.com blocked).

## 4. Payment methods for Indonesian Play users

### Takeaway
Google's official Indonesia list includes the e-wallets DANA, DOKU, GoPay, OVO and ShopeePay, as well as cards and Play balance. Carrier billing (Telkomsel, Indosat, XL/AXIS, Tri, Smartfren) and minimarket top-ups (Indomaret, Alfamart, through vouchers) are reported by secondary sources. Some prepaid methods cannot pay for subscriptions.

### Cited Findings
- E-wallets listed for Indonesia: Dana, Doku, GoPay, OVO, ShopeePay. The user needs a registered account with enough balance (excerpt) — [Google Play Help: Accepted payment methods – Indonesia](https://support.google.com/googleplay/answer/2651410?hl=en&co=GENIE.CountryCode%3DID)
- Phone-bill payment through Telkomsel, Indosat, XL/AXIS, Tri and Smartfren is reported for Indonesia. The same source says cash, virtual-account transfer and QRIS cannot pay for subscriptions — [TeknoPulse (ID), 2026](https://teknopulse.id/posts/cara-bayar-chatgpt-gopay-dana/) (secondary)
- Users top up Play balance at minimarkets and through e-wallets (Indomaret, Alfamart, Codashop and similar voucher sellers) — [Kontan (ID)](https://finansial.kontan.co.id/news/panduan-lengkap-top-up-google-play-minimarket-hingga-e-wallet); [Codashop](https://www.codashop.com/id-id/kode-voucher-google-play)

### Inferences
- E-wallets plus carrier billing cover the large group of users without a card. This is the main reason to use Play Billing in Indonesia rather than a card-only web checkout.
- Play balance from vouchers may not pay for auto-renewing subscriptions, and e-wallet balance can run out at renewal. Expect involuntary churn, which makes grace period and account hold (section 5) matter more. The lifetime SKU suits balance-funded buyers well.

### Gaps
- I found no share or usage data for each payment method in Indonesia. Whether carrier billing appears on Google's official list could not be confirmed.

## 5. Product types, offers, promo codes, lifecycle

### Takeaway
Model monthly and annual as two base plans on one subscription product, with free-trial or intro-price offers attached. Model the lifetime licence as a one-time (non-consumable) product, and acknowledge it within 3 days. Promo codes allow 10,000 per quarter per subscription (these grant free trials only) and 500 per quarter for one-time products. As of Dec 2025, account hold defaults to 60 days minus the grace period.

### Cited Findings
- Subscription states: Active, Cancelled, In grace period, On hold, Paused, Expired — [developer.android.com: Integrate](https://developer.android.com/google/play/billing/integrate)
- Purchases must be acknowledged "within three days so that the purchase isn't automatically refunded and entitlement revoked". Do not rely on that expiry window to reject a purchase — [developer.android.com: Integrate](https://developer.android.com/google/play/billing/integrate)
- Promo codes: 10,000 one-time-use codes per quarter per subscription product. Custom codes allow 2,000–99,999 redemptions. One-time products get 500 codes per quarter across the app. The two pools are separate, unused codes expire at quarter end, and subscription promo codes grant free trials, not free subscriptions — [developer.android.com: Promo codes](https://developer.android.com/google/play/billing/promo); [Play Console Help: Create promotions (excerpt)](https://support.google.com/googleplay/android-developer/answer/6321495)
- Since 1 Dec 2025, account hold is calculated automatically as 60 days minus the grace period (a 7-day grace period gives a 53-day hold). Grace plus hold must total at least 30 days. Grace can be up to 30 days per base plan (excerpt) — [Play Console Help 16631229](https://support.google.com/googleplay/android-developer/answer/16631229?hl=en); [RevenueCat: Google Play lifecycle](https://www.revenuecat.com/blog/engineering/google-play-lifecycle)
- Grace-period options per billing period are reported as Monthly 7/14/30 days and Annual 7/14/30 days. Sources disagree on whether grace is on by default — [RevenueCat blog](https://www.revenuecat.com/blog/engineering/google-play-lifecycle); [newly.app](https://newly.app/guides/subscription-grace-period)
- PBL 7.0+ supports pending transactions for prepaid subscription plans — [developer.android.com: Integrate](https://developer.android.com/google/play/billing/integrate)

### Inferences
- Play promo codes could replace some of ABOT's redeem codes on Android: 500 per quarter for lifetime, and subscription codes as free trials. ABOT's own redeem codes would still be needed for web and PWA.
- Make the entitlement logic read the subscription state, granting access in Active, Cancelled-before-expiry and Grace and denying it in On hold, Paused and Expired. Do not rely on a simple expiry date.

### Gaps
- I could not verify how Play handles refunds for developers (refund window, voided purchases API) from a primary page in this session. It is known to exist (Voided Purchases API), but no source was fetched.

## 6. Implementing from Capacitor 8

### Takeaway
There are two maintained options. RevenueCat (`@revenuecat/purchases-capacitor`) is free up to US$2.5k monthly tracked revenue, then 1%, and it handles validation, acknowledgement, RTDN and entitlements, so no own server is needed. Fovea's `cordova-plugin-purchase` v13 has a native Capacitor package (`capacitor-plugin-cdv-purchase`, since v13.15) built on PBL 9; it needs a validator such as iaptic or your own. Since 31 Aug 2026 (1 Nov 2026 with an extension), new apps and updates must use PBL 8 or later.

### Cited Findings
- All new apps and updates must use Billing Library 8 or later by 31 Aug 2026, with an extension available to 1 Nov 2026. This is a publishing gate, not a runtime cutoff — [Foresight Mobile](https://foresightmobile.com/blog/google-play-billing-library-8-migration); [RevenueCat: PBL 8 migration](https://www.revenuecat.com/blog/engineering/play-billing-8-migration/)
- PBL 9.0.0 shipped 19 May 2026. Reported next cutoffs: PBL 8 by 31 Aug 2027, PBL 9 by 31 Aug 2028 — [ecorpit](https://ecorpit.com/google-play-billing-library-8-migration-deadline-2026/) (secondary)
- The official integration guide's current dependency example is `com.android.billingclient:billing:9.1.0` — [developer.android.com: Integrate](https://developer.android.com/google/play/billing/integrate)
- RevenueCat pricing: free up to $2,500 MTR per month, then 1% of MTR. Verify on revenuecat.com/pricing, as one aggregator conflicts — [costbench](https://costbench.com/software/subscription-billing/revenuecat/free-plan/); [toolradar](https://toolradar.com/tools/revenuecat/pricing)
- `@revenuecat/purchases-capacitor` releases include 12.2.x. v10.0.0 and later require Capacitor 7+ — [newreleases.io](https://newreleases.io/project/github/RevenueCat/purchases-capacitor/release/10.0.0); [11.3.0](https://newreleases.io/project/github/RevenueCat/purchases-capacitor/release/11.3.0)
- `cordova-plugin-purchase` latest is 13.20.0. Since v13.15 the Capacitor package `capacitor-plugin-cdv-purchase` has its own native bridges with no Cordova dependency. Since v13.17.0 the Android plugin builds against PBL 9.0.0. v13.13 moved to PBL 8.3.0, which needs minSdk 23 — [npm](https://www.npmjs.com/package/cordova-plugin-purchase); [Release notes](https://github.com/j3k0/cordova-plugin-purchase/blob/master/RELEASE_NOTES.md); [Fovea Capacitor setup](https://purchase.cordova.fovea.cc/setup/setup-capacitor)
- The Fovea plugin recommends a receipt validator URL (your own backend or iaptic, validator.iaptic.com) — [Fovea docs: Introduction](https://purchase.cordova.fovea.cc/introduction)
- A release note mentions a fix for a regression where non-consumable ownership stopped firing after upgrading to 13.13.1+. That matters for ABOT's lifetime SKU — [Release notes](https://github.com/j3k0/cordova-plugin-purchase/blob/master/RELEASE_NOTES.md)

### Inferences
- At Rp 29.000/month, US$2.5k MTR is roughly 1,400 or more paying monthly subscribers (assuming about Rp 16.500/USD; the rate is not sourced). That means RevenueCat is effectively free for ABOT's early stage.
- RevenueCat also offers a web billing path for the Vercel PWA. It is not researched here, so check whether it fits Indonesian payment methods.
- Confirm that the chosen plugin version supports Capacitor 8 specifically before integrating. The sources confirm Capacitor 7+ (RevenueCat) and native Capacitor support (Fovea), not Capacitor 8 by name.

### Gaps
- iaptic pricing was not found.
- RevenueCat Capacitor 8 compatibility, and the RevenueCat-to-Supabase webhook integration, were not confirmed from docs.
- No other maintained Capacitor IAP plugin (for example Capgo's native-purchases) was researched.

## 7. Server-side requirements

### Takeaway
Google's recommended flow is to verify the purchase on a server, grant the entitlement, then acknowledge within 3 days. Subscription state changes arrive through Real-time Developer Notifications on Cloud Pub/Sub, and the Google Play Developer API holds the authoritative state. RevenueCat removes the need to run this server. A Supabase Edge Function can also do it, using a service account to call the Developer API and a Pub/Sub push subscription pointed at the function.

### Cited Findings
- Life of a purchase: show products, launch the flow, verify on your server, grant content, then acknowledge (consumables are consumed instead). If verification or fulfilment fails, do not acknowledge — [developer.android.com: Integrate](https://developer.android.com/google/play/billing/integrate)
- Unacknowledged purchases are automatically refunded and revoked once the window expires. Google cannot tell an intentional rejection from a backend timeout — [developer.android.com: Integrate](https://developer.android.com/google/play/billing/integrate)
- Purchases are refunded after 3 days if the app has not processed them, so handle purchases made while the app was not running at app start or login — [developer.android.com: Integrate](https://developer.android.com/google/play/billing/integrate)

### Inferences
- Fully offline-first apps can acknowledge on the client (PBL `acknowledgePurchase`) without a server. The cost is no fraud verification, and on Android an entitlement cannot be shared with the web/PWA account.
- A Supabase design: an Edge Function `verify-purchase` calls `purchases.subscriptionsv2.get` or `purchases.productsv2` with a Google service-account JWT, writes to an `entitlements` table and acknowledges. A second function receives the Pub/Sub RTDN push and refreshes state. This can be built but is extra work compared with RevenueCat webhooks into Supabase.
- Doing verification on Supabase introduces a runtime network call to Google, which conflicts with the project's "no runtime network calls" rule. That rule needs an explicit exception for billing either way.

### Gaps
- The RTDN setup steps and the exact Developer API endpoint names were not fetched from primary docs in this session (the inference above uses general knowledge of subscriptionsv2 and productsv2 and should be verified).

## 8. Testing

### Takeaway
Personal developer accounts created after 13 Nov 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before they can apply for production. Organisation accounts are exempt. License testers in Play Console can make test purchases with test cards.

### Cited Findings
- Personal accounts created after 13 Nov 2023 need a closed test with at least 12 testers opted in continuously for at least 14 days. The count was cut from 20 to 12 in Dec 2024. The 14 days start after release approval and 12 opt-ins. Internal testing does not count. Organisation (D-U-N-S) accounts are exempt (excerpts and secondary sources) — [Play Console Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en); [testerscommunity.com](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026); [Choicely](https://www.choicely.com/blog/google-play-12-tester-rule)
- Claims that 2026 added engagement checks (testers must actively use the app) are unverified on Google's page — [newly.app](https://newly.app/how-to/google-play-twelve-testers-rule) (secondary)

### Inferences
- Start the closed test, with billing products set up, early: production is at least about 2 weeks away from the first approved closed build. Use the same testers as license testers so billing can be tested during the 14 days.

### Gaps
- License-tester behaviour (test card options, accelerated renewal periods such as 5-minute monthly) was not confirmed from a primary source in this session.
