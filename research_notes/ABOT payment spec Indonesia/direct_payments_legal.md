# Direct (non-app-store) payments in Indonesia for ABOT: gateways, MoR, creator platforms, legal and tax (as of Nov 2026)

> Method note: this session's network blocked direct page fetches to midtrans.com, xendit.co, tripay.co.id, mayar.id and polar.sh (DNS refused by the sandbox allowlist). All findings below come from web-search result summaries. Many fee figures therefore come from third-party comparison sites, not the vendor's own pricing page. Each one is labelled. Before quoting a price to users, re-check it on the vendor page (or allow those hosts and re-run).

## 1. Indonesian payment gateways (Midtrans, Xendit, DOKU, Tripay, Duitku, iPaymu): fees, recurring, onboarding, webhooks

### Takeaway
Midtrans is the only major gateway confirmed to onboard an **individual** with just a KTP. Third-party sources put its fees at QRIS 0.7%, VA Rp 4.000 flat, e-wallets 1.5-2%, cards 2.9% + Rp 2.000. Xendit's published fees look similar, but it does **not** accept unregistered individuals. True auto-debit recurring in Indonesia is realistic only on **cards** and **GoPay tokenization**, and the GoPay route needs a separate activation. QRIS and VA are one-off only. That fits well with selling annual and lifetime plans as one-off purchases.

### Cited Findings
**Midtrans**
- Fees (third-party summary, which says it reflects Midtrans pricing): VA/bank transfer Rp 4.000 flat per successful transaction; QRIS 0.70% (VAT-inclusive); GoPay 2.00%; OVO 1.50%; DANA 1.50%; ShopeePay 2.00%; cards 2.90% + Rp 2.000. No setup, monthly or termination fee. Other fees exclude 11% VAT. — [CheckoutFlow: Midtrans pricing](https://checkoutflow.pages.dev/id-en/best-payment-gateway-ecommerce/midtrans-pricing/)
- Conflicting card fee: 2.9% + Rp 2.500 — [Dodo Payments: Midtrans alternatives 2026](https://dodopayments.com/zh/blogs/midtrans-alternatives). The official fee pages are [docs.midtrans.com/docs/biaya](https://docs.midtrans.com/docs/biaya) and [midtrans.com/pricing](https://midtrans.com/pricing), but neither could be read in this session. **Verify before use.**
- The "zero fee program" campaign ended 30 Nov 2020 and does not apply. — [Midtrans zero-fee campaign](https://stg.midtrans.com/campaign/zero-fee-program)
- Recurring: GoPay Tokenization works as account linking (Account Linking API) followed by charges through the Direct Debit Payment API. Recurring without a PIN works only once the recurring feature has been enabled through Midtrans sales. Snap also supports recurring via GoPay Tokenization. — [Midtrans GoPay Tokenization (non Pre-Auth)](https://docs.midtrans.com/reference/direct-debit-api-gopay-tokenization); [GoPay Linking](https://docs.midtrans.com/reference/gopay-tokenization-1); [Midtrans recurring payment](https://midtrans.com/features/recurring-payment)
- Onboarding: Midtrans accepts individual businesses as well as legal entities (PT, CV, foundations). An individual needs a KTP (Indonesian citizens) or KITAS (foreigners). The snippet does not list an NPWP for the individual track. — [Midtrans Passport](https://midtrans.com/passport); [What if I don't have an ID/KTP?](https://docs.midtrans.com/docs/what-if-i-dont-have-an-idktp)

**Xendit**
- Fees (third-party, which says they come from Xendit's pricing page): QRIS 0.70%; VA Rp 4.000; cards 2.90% + Rp 2.000; settlement T+1 to T+2 for VA and e-wallets. E-wallet tiers were not clearly listed. — [CheckoutFlow: Xendit](https://checkoutflow.pages.dev/id-en/best-payment-gateway-ecommerce/xendit-payment-gateway-indonesia/); [LearnWithHasan: Xendit](https://learnwithhasan.com/payment-gateways/xendit/). Official page (not readable here): [xendit.co/en/pricing](https://www.xendit.co/en/pricing)
- A third-party comparison lists DANA recurring at 3.00% vs 1.50% for DANA with PIN (unverified). — [rfp.wiki Xendit vs GoPay](https://www.rfp.wiki/payments-fraud/payment-gateways/xendit/gopay)
- Recurring: the `GOPAY` channel code is for one-time payments and `GOPAY_RECURRING` is for recurring payments, which needs extra activation with the partner. — [Xendit docs: GoPay](https://docs.xendit.co/docs/gopay)
- Onboarding: "At the moment, we [do] not accommodate Individual business to create an account in Xendit." Xendit supports legal entities, including sole proprietorships, partnerships and corporations. — [Xendit Help: Can Individual businesses use Xendit](https://help.xendit.co/hc/en-us/articles/360035083911-Can-Individual-businesses-use-Xendit-s-services)
- Product: Payment Links / Invoices (XenInvoice) give a hosted checkout. — [Xendit XenInvoice](https://xendit.co/products/xeninvoice/)
- Context: VA makes up more than 50% of Xendit TPV, and QRIS transactions on Xendit grew 142% from Jan 2025 to Apr 2026. — [Kontan](https://keuangan.kontan.co.id/news/transaksi-qris-melalui-xendit-tumbuh-142-lampaui-kartu-kredit); [InvestorTrust](https://investortrust.id/financial/23085/xendit-virtual-account-masih-jadi-pilihan-utama-pembayaran)

**Duitku**
- Published per-transaction fee page: credit card 2.9% + Rp 2.500; VA from Rp 1.500 (Artha Graha) to Rp 5.000 (BCA), others Rp 3.000. No QRIS figure is shown. **Likely outdated.** — [Duitku: Metode Pembayaran Biaya Per Transaksi](https://duitku.com/?p=722)

**iPaymu**
- VA is described as free for withdrawal to certain banks. Withdrawal fee is Rp 3.000 (same day, H+0) or Rp 7.500 (banks not on BI-FAST). For current QRIS pricing, the page says to check the site. — [iPaymu pricing](https://ipaymu.com/en/pricing/); [iPaymu VA](https://ipaymu.com/en/virtual-account/); [iPaymu QRIS](https://ipaymu.com/en/qrcode-indonesian-standard/)

**HitPay (bonus option, publishes rates by entity type)**
- QRIS 0.8%; VA Rp 5.000; cards 2.9% + Rp 1.500. Individuals and foundations: cards 2.7% + Rp 1.700. No setup or monthly fee. — [HitPay ID pricing](https://hitpayapp.com/id/pricing)

**OY! Indonesia**: pricing page exists — [oyindonesia.com/pricing](https://oyindonesia.com/pricing). Rates were not captured.

**QRIS MDR baseline (regulator)**
- Bank Indonesia sets the QRIS MDR. The merchant bears it and may not pass it on to the consumer. Commonly cited regular rate is 0.7%, education 0.6%. — [BI: MDR QRIS](https://www.bi.go.id/id/publikasi/ruang-media/cerita-bi/Pages/mdr-QRIS.aspx); [OCBC article](https://www.ocbc.id/id/article/2024/05/29/apakah-transaksi-dengan-qris-kena-biaya-admin)

### Inferences
- For an individual owner with no PT/CV, Midtrans (KTP only) is the clear first choice among the big two. Xendit would need at least a registered sole proprietorship (NIB via OSS) or a PT Perorangan.
- Because the BI rule bars passing the QRIS MDR on to the consumer, price points should absorb the 0.7%. On Rp 29.000 that is about Rp 203. A flat Rp 4.000 VA fee is about 14% of the monthly plan, so VA suits annual and lifetime plans and fits poorly with monthly.
- Monthly auto-renew at Rp 29.000 would rely on card or GoPay-tokenized recurring, and both need extra activation. A "prepaid period" model (buy 1/12 months, no auto-renew) through QRIS/e-wallet is simpler and avoids recurring-specific compliance.
- Webhook model (general knowledge, not verified this session): Midtrans sends an HTTP POST notification with a `signature_key` = SHA512(order_id + status_code + gross_amount + ServerKey). Xendit sends callbacks with an `x-callback-token` header to compare with the dashboard token. Both are plain HTTPS calls, so no Node-only SDK is needed. **Re-verify against current docs.**

### Gaps
- No primary-source fee tables for Midtrans, Xendit, DOKU, Tripay, Duitku or iPaymu could be read (fetch blocked). **DOKU and Tripay: no fee data found at all.**
- Recurring support for cards, direct debit and OVO/DANA/ShopeePay on Midtrans and Xendit was not confirmed from official docs.
- Onboarding requirements for DOKU, Tripay, Duitku and iPaymu (individual vs PT/CV, NPWP/NIB) were not found.

## 2. Merchant-of-record options (Lemon Squeezy, Paddle, Polar, Gumroad) and Stripe in Indonesia

### Takeaway
MoRs charge about 5% + US$0.50 per transaction (Lemon Squeezy), which is about Rp 8.000+ on top of 5% and too heavy for a Rp 29.000 monthly plan. No source confirmed that any MoR offers QRIS or Indonesian e-wallets at checkout, so Indonesian buyers would be card or PayPal only. MoRs mainly make sense for future international sales.

### Cited Findings
- Lemon Squeezy fee: 5% + $0.50. Payouts carry an extra deduction that "varies depending on your payout method, region and settlement currency." — [Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees); [Lemon Squeezy getting paid](https://docs.lemonsqueezy.com/help/getting-started/getting-paid)
- A secondary claim says Lemon Squeezy charges +1.5% on international sales and 1% per payout to international bank accounts (unverified). — [Rework: Paddle vs Lemon Squeezy](https://resources.rework.com/tools/billing-revenue/paddle-vs-lemon-squeezy); [Dodo: Lemon Squeezy review](https://dodopayments.com/blogs/lemonsqueezy-review)
- Stripe acquired Lemon Squeezy in 2024. In January 2026 the Lemon Squeezy team announced Stripe Managed Payments (Stripe's own MoR product). Lemon Squeezy reportedly still operates with no sunset date announced. — [alexcloudstar: MoR in 2026](https://alexcloudstar.com/blog/merchant-of-record-indie-saas-2026/); [Airwallex comparison](https://www.airwallex.com/en-uk/blog/lemon-squeezy-vs-stripe-comparison)
- Polar uses Stripe Connect Express for payouts "in all of our supported countries". Whether Indonesia is on the list was not confirmed. — [Polar supported countries](https://polar.sh/docs/merchant-of-record/supported-countries)
- A secondary blog says Stripe's Indonesia offering "does not natively expose QRIS, OVO, DANA, or Virtual Accounts the way Xendit does" and suggests pairing Xendit with an MoR. — [LearnWithHasan: Indonesia gateways](https://learnwithhasan.com/payment-gateways/country/indonesia/). Another third-party page claims Stripe Indonesia supports cards, VA, e-wallets and QRIS. — [Cal Poly-hosted blog](https://grandavehousing.calpoly.edu/blog/stripe-indonesia-fees-and-costs-explained-1764800477). **These conflict, and both are low-quality sources.**
- Fee comparison across Stripe, Polar, Lemon Squeezy and Gumroad exists. — [UserJot comparison](https://userjot.com/blog/stripe-polar-lemon-squeezy-gumroad-transaction-fees)

### Inferences
- An MoR's tax-handling value matters little here. Domestic Indonesian sales by an Indonesian individual below the PKP threshold carry no PPN anyway (see section 4), so the MoR's main benefit doesn't apply to the core market.

### Gaps
- Paddle and Gumroad fees, IDR pricing support, and payouts to Indonesian banks: not found.
- Whether Stripe accepts Indonesia-registered businesses as a direct account (Stripe's own country list): not verified. Treat as unknown.
- Polar's Indonesia payout eligibility: not verified (fetch blocked).

## 3. Indonesian creator platforms (Mayar.id, Lynk.id, Trakteer, Saweria, Karyakarsa)

### Takeaway
Mayar is the only one with developer docs (API, payment links, an MoR fee model). The others are tip or storefront tools with a platform cut of about 3-10% and no confirmed webhooks, so automatic redeem-code delivery would be manual or rely on in-platform "digital file" delivery.

### Cited Findings
- Mayar fees: a per-transaction "Channel Fee" that depends on the payment method, plus an "Admin Fee" whose percentage depends on product and plan. Withdrawal costs a flat IDR 2.775. Per-method rates sit in an image that could not be read. — [Mayar docs: MoR fees](https://docs.mayar.id/mor/fees.md)
- Mayar has a public API covering payment links for digital products. — [Mayar llms-full docs](https://docs.mayar.id/llms-full.txt)
- Karyakarsa keeps a 10% administration cut, with a separate bank-transfer fee on withdrawal. — [Karyakarsa help: creator income policy](https://help.karyakarsa.com/karyakarsa-usage-guide/creator-guides/kebijakan-mengenai-gajiandikaryakarsa)
- Lynk.id: 3% transaction fee; Pro plan Rp 99.000/month (third-party blog). — [Dorangadget](https://dorangadget.com/?p=122220); sells digital products, services and webinars with a free tier — [Metro TV](https://www.metrotvnews.com/read/NleC9GzX-tanpa-ribet-begini-cara-mudah-jual-produk-digital-di-lynkid)
- Saweria about 5-6% and Trakteer about 5%, from an unlabelled community spreadsheet (unverified). — [Google Sheet comparison](https://docs.google.com/spreadsheets/d/1ii59-tKBwsol4jGwVehXy-oaJfVLKUciwXtB2tuKqQg/edit)

### Inferences
- If a creator platform is used, the lowest-effort way to deliver codes is to pre-generate a batch of single-use redeem codes and attach them as the "digital product" content. ABOT already supports redeem codes. This works only if the platform delivers one unique item per buyer, which was not verified.

### Gaps
- Webhook support for Mayar (likely, but not verified), Lynk, Trakteer, Saweria and Karyakarsa: not confirmed.
- Mayar membership/subscription feature and license-key feature: not confirmed.

## 4. Legal and tax obligations for an Indonesian individual / small seller

### Takeaway
(a) PSE registration through OSS is required in principle for private electronic system operators, and Komdigi enforces it with warnings before blocking. (b) A seller below Rp 4,8 miliar annual turnover is a "pengusaha kecil", does not have to register as PKP, and so does not charge PPN. (c) Income tax: PP 20/2026 (April 2026) keeps the 0.5% final UMKM rate **with no time limit** for individuals and PT Perorangan, and individuals pay nothing on the first Rp 500 juta of annual turnover. (d) PP 80/2019 requires e-commerce sellers to protect consumer rights, including cancellation and exchange.

### Cited Findings
**PSE (Komdigi)**
- The registration duty comes from PM Kominfo 5/2020 on private-scope PSE. Arts. 2 and 4 cover domestic and foreign operators and require registration before operating. Art. 7 sanctions go up to access termination. Registration runs through OSS. — [Katadata: Komdigi 25 PSE](https://katadata.co.id/digital/e-commerce/6ab0ed9861fca/komdigi-25-pse-lingkup-privat-belum-lapor-ada-whoosh-hingga-lion-air); Komdigi procedure page: s.komdigi.go.id/pendaftaranpseprivat (as cited there)
- Enforcement in 2026: Komdigi warned 25 PSEs in July 2026, including Strava, a fitness app. A later round warned 7 PSEs with a deadline of 1 Oct 2026, and Komdigi says it is open to clarification. — [Bisnis 2 Jul 2026](https://teknologi.bisnis.com/read/20260702/101/1985029/komdigi-catat-25-perusahaan-belum-daftar-pse-qatar-airways-hingga-strava); [Bisnis 28 Sep 2026](https://teknologi.bisnis.com/read/20260928/101/2007757/komdigi-beri-tenggat-1-oktober-7-pse-belum-terdaftar-terancam-kena-teguran); [Selular.id](https://selular.id/2026/07/25-pse-yang-terancam-kena-blokir-pemerintah-ada-strava-hingga-solo-paragon/)

**PPN**
- PMK 81/2024 took effect 1 Jan 2025 and replaces PMK 147/2017 on PKP registration. The duty to register as PKP does not apply to a pengusaha kecil (turnover ≤ Rp 4,8 miliar/year; threshold from PMK 197/2013 as amended by PMK 164/2023). Voluntary registration is allowed. — [DDTC: PMK 81/2024](https://news.ddtc.co.id/berita/nasional/1806903/pmk-81-revisi-ketentuan-tempat-pelaporan-usaha-pkp-begini-detailnya); [IKPI](https://ikpi.or.id/pengusaha-wajib-daftar-pkp-kecuali-kategori-ini/)
- PPN PMSE (collected by appointed e-commerce collectors, typically foreign digital platforms) has an effective rate of 11%: the 12% rate times a DPP of 11/12 of the payment value, under PMK 81/2024 and PER-12/PJ/2025. The DPP 11/12 mechanism comes from PMK 131/2024 (for the 12% rate) and PMK 11/2025. — [Ortax: PPN PMSE](https://ortax.org/subjek-pilihan/1/simak-ketentuan-terbaru-ppn-pmse); [DDTC: PMK omnibus DPP nilai lain](https://news.ddtc.co.id/berita/nasional/1808691/pmk-omnibus-terbit-revisi-aturan-dpp-nilai-lain-ppn-besaran-tertentu)

**PPh final UMKM**
- PP 55/2022: individuals pay no tax on the portion of turnover up to Rp 500 juta per year. The cap for the 0.5% scheme is Rp 4,8 miliar. The original Art. 59 limited individuals to 7 years. — [DDTC: Apa itu PPh final UMKM](https://news.ddtc.co.id/literasi/kamus/1811984/apa-itu-pph-final-umkm); [Hukumonline](https://www.hukumonline.com/berita/a/simak-begini-hak-dan-kewajiban-perpajakan-untuk-umkm-lt65649071adce6?page=all)
- **PP 20/2026** was enacted 22 April 2026 and revises PP 55/2022. The rate stays at 0.5%. The scheme is limited to individuals, PT Perorangan and cooperatives (cooperatives max 4 years). Art. 59's time limit is removed, so the scheme is permanent for individuals and PT Perorangan with turnover ≤ Rp 4,8 miliar. CV, firm, PT and BUMDes may continue only until their old period ends. — [DDTC: PP 20/2026](https://news.ddtc.co.id/berita/nasional/1819801/pp-202026-cegah-penyalahgunaan-pph-final-umkm-oleh-usaha-besar); [DDTC: aturan baru resmi terbit](https://news.ddtc.co.id/berita/nasional/1819741/akhirnya-aturan-baru-soal-pph-final-umkm-05-persen-resmi-terbit); [DDTC: cuma untuk OP, PT perorangan, koperasi](https://news.ddtc.co.id/berita/nasional/1819737/pp-direvisi-pph-final-umkm-cuma-untuk-op-pt-perorangan-dan-koperasi)
- Conflicting older source: Mekari said individual use of 0.5% ended Jan 2026. PP 20/2026 supersedes this. — [Mekari community](https://community.mekari.com/forums/topic/partisipasi-terakhir-tarif-setengah-persen/)

**Consumer protection**
- PP 80/2019 (PMSE) covers exchange and cancellation of purchases. Art. 26(1) requires business actors to guarantee consumer rights. Consumers can report losses to the Minister, and the reported business must resolve the complaint. — [Setkab: PP 80/2019](https://setkab.go.id/?p=176339); [PP 80/2019 text](https://peraturan.go.id/files/pp80-2019bt.pdf); [SIP Law analysis](https://siplawfirm.id/analisa-kebijakan-terbaru-e-commerce-berdasarkan-pp-80-tahun-2019/)
- YLKI criticised PP 80/2019 for lacking technical guidance. — [Bisnis](https://ekonomi.bisnis.com/read/20200114/12/1190075/perlindungan-konsumen-dagang-el-jadi-persoalan-serius)

### Inferences
- For ABOT run by an individual: get an NPWP (now NIK-based through Coretax) and an NIB via OSS as a perorangan business. Register the PSE through OSS. Do not charge PPN while under Rp 4,8 miliar. Prices should be shown as final with no PPN line. Pay 0% income tax on the first Rp 500 juta of annual gross receipts and 0.5% final on the excess, under PP 20/2026.
- The NPWP/Coretax step is cited at [OCBC: Coretax NPWP](https://www.ocbc.id/id/article/2026/01/06/coretax-daftar-npwp-cara-registrasi-npwp-online-terbaru-lewat-sistem-coretax).
- Refund policy: no subscription-specific statutory cooling-off period for digital goods was found. A clear written refund/cancellation policy on the checkout page fits PP 80/2019's transparency and cancellation provisions.

### Gaps
- Whether a small individual PWA/app is in practice expected to register as a PSE, and any turnover/user threshold: not established.
- Specific article text of PP 80/2019 on cancellation timelines and auto-renewal disclosure: not retrieved. UU 8/1999 (Consumer Protection) clauses were not checked.

## 5. Google Play anti-steering and the PWA/web route

### Takeaway
In Indonesia, the KPPU ruling (Jan 2025) ordering Google to stop mandating Play Billing and open UCB was upheld by the Commercial Court (June 2025) and the Supreme Court (March 2026). Even so, no source confirmed an Indonesia-specific "link-out to web checkout" program. Indonesia is in **User Choice Billing** (alternative billing alongside Play Billing, 4% fee reduction). Linking out from the Android app to buy the same digital goods remains outside policy unless enrolled in a qualifying program. The web/PWA can sell directly with no Google involvement.

### Cited Findings
- Indonesia is among the countries where users can choose a billing system per purchase (with Australia, Brazil, India, Japan, South Africa, South Korea and the US). Alternative-billing developers must use the alternative billing APIs from 13 Mar 2024. — [Google Play Help: alternative billing](https://support.google.com/googleplay/answer/11174377?hl=en); [Play Console Help 12570971](https://support.google.com/googleplay/android-developer/answer/12570971?hl=en-AU)
- UCB pilot reached Indonesia on 1 Sep 2022. — [Android Central](https://www.androidcentral.com/apps-software/google-user-choice-billing-pilot-enrollment)
- The UCB pilot gives a 4% service-fee reduction for alternative billing transactions (Google's ID blog on the KPPU appeal). — [Google Indonesia blog](https://blog.google/intl/id-id/products/platforms/mengapa-kami-mengajukan-banding-atas-putusan-kppu-terkait-sistem-penagihan-google-play/)
- KPPU (Jan 2025): fine of Rp 202,5 miliar; ordered Google to stop requiring Google Play Billing and to let developers use UCB. — [Bisnis 22 Jan 2025](https://teknologi.bisnis.com/read/20250122/101/1833948/komdigi-hormati-putusan-kppu-terkait-praktik-monopoli-google); [InvestorTrust](https://investortrust.id/business/70097/google-kalah-dari-kppu-wajib-hentikan-play-billing-dan-bayar-denda-rp-202-5-miliar)
- Commercial Court rejected Google's objection on 19 June 2025. The Supreme Court rejected cassation (reported 17 Mar 2026). — [MA Marinews](https://marinews.mahkamahagung.go.id/berita/kasasi-google-ditolak-ma-wajib-setor-denda-202-5-miliar-0Zx); [CNBC Indonesia](https://www.cnbcindonesia.com/tech/20260317140204-37-719813/kasasi-ditolak-google-bayar-denda-rp-2025-miliar-di-indonesia/amp); [Makarim & Taira](https://www.makarim.com/news/indonesia-upholds-antitrust-fine-against-google-key-lessons-for-global-companies)
- US only: from 29 Oct 2025 to 1 Nov 2027, developers may steer US users to external payments, with enrollment in the External Content Links program. Proposed fees are 10% for auto-renewing subscriptions and 20% for other digital purchases (link-outs); fee start dates were unclear. Steering non-US users may be a policy violation. — [Neon: US policies Dec 2025](https://www.neonpay.com/blog/google-plays-new-u.s.-billing-linking-policies-what-game-developers-need-to-know); [Play Console Help 16505463](https://support.google.com/googleplay/android-developer/answer/16505463?hl=en)
- EEA has a separate external offers program under the DMA. — [Appcharge](https://appcharge.com/blog/external-payments-arrive-on-android-in-europe); [Android dev: external offers (ID)](https://developer.android.com/google/play/billing/alternative?hl=id)

### Inferences
- Safe design for the Capacitor Android build: keep in-app purchase screens off the Play build (or use Play Billing / UCB), and don't show "buy on web" links or prices. Accepting a redeem code in-app is commonly tolerated as long as the app doesn't steer. Whether redeem-code entry for web-bought goods is acceptable is a judgement call; check against the current Payments policy text.
- Alternatively, enroll in UCB for Indonesia and use Midtrans/Xendit as the alternative biller inside the app. That requires the alternative billing APIs and pays Google's fee minus 4%.
- The Vercel PWA is outside Play policy entirely. Direct selling there is unrestricted.

### Gaps
- Exact current Play Payments policy wording on "consumption-only apps" and redeem codes: not fetched.
- Whether Google changed UCB terms in Indonesia after the Supreme Court ruling (Mar 2026): not found.

## 6. Architecture: gateway webhook → Supabase Edge Function → entitlement / redeem code

### Takeaway
All candidate gateways deliver webhooks as plain HTTPS POSTs with a verifiable signature or token, so an Edge Function (Deno) can verify with Web Crypto and `fetch`, without vendor Node SDKs.

### Cited Findings
- Midtrans Snap supports recurring via GoPay Tokenization and offers a hosted checkout. — [Midtrans recurring](https://midtrans.com/features/recurring-payment)
- Xendit hosted checkout / payment links: XenInvoice. — [Xendit XenInvoice](https://xendit.co/products/xeninvoice/)
- Mayar exposes a public API for payment links. — [Mayar docs](https://docs.mayar.id/llms-full.txt)

### Inferences
- Flow: client (logged in with Supabase Google auth) calls Edge Function `create-checkout` → server creates a Midtrans Snap token or Xendit invoice with `order_id` = uuid stored in `orders` (user_id, plan, amount, status=pending) → user pays → gateway POSTs to Edge Function `payment-webhook` → verify the signature (Midtrans SHA-512 `signature_key`; Xendit `x-callback-token` comparison) → re-query the transaction status API for defence in depth → idempotent upsert into `entitlements` (user_id, plan, expires_at; null for lifetime) and/or insert a single-use row into `redeem_codes` → client reads entitlement through RLS.
- The official Midtrans and Xendit Node SDKs are optional. Their REST APIs use HTTP Basic auth with the server key, which works directly from Deno. npm-compat imports (`npm:midtrans-client`, `npm:xendit-node`) may work in Supabase Edge Runtime but were **not verified**.
- Keep server keys only in Edge Function secrets. This adds network calls to a hosted backend only at checkout time, which conflicts with the project rule of no runtime network calls ("Zero External Paid API: no runtime network calls, no tokens" in CLAUDE.md). Flag this to the owner for a decision.

### Gaps
- Current signature algorithms and header names were not re-verified against live Midtrans/Xendit/Tripay/Duitku/Mayar docs in this session.
- Deno compatibility of vendor SDKs: unverified.
