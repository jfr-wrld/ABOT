# Signed licence tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Release builds open PRO only from an ES256-signed licence token, and a build-time floor stops a cached beta mode.
**Architecture:** Shared WebCrypto signer for the Edge Function, WebCrypto verifier in the app, verified result held in memory and passed to `resolveEntitlement`.
**Tech Stack:** WebCrypto (ECDSA P-256), Deno Edge Function, Zustand, Vitest.
**Spec:** `docs/superpowers/specs/2026-11-15-signed-license-design.md`

## Global Constraints
- Token header `{"alg":"ES256","typ":"ABOT-LICENSE"}`; payload `{ v: 1, sub, tier, pro_until, iat, exp }`; `exp = iat + 2592000`.
- Env: `LICENSE_PRIVATE_JWK` (Supabase secret), `NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY`, `NEXT_PUBLIC_ABOT_MONETIZATION_FLOOR`.
- No public key in the build means today's rule (`licenseSource === "account"`).

## Review Focus
- A token signed by another key, or with an edited payload, opens nothing. Test in Task 1.
- Expired token (`exp <= now`) or a future `iat` (> now + 10 min) opens nothing. Test in Task 1.
- A pro token whose `pro_until` has passed is free even though `exp` is ahead. Test in Task 2.
- Edited `tier`/`licenseSource` with no token stays free when a key is configured. Test in Task 2.
- The Edge Function answers 503 without its secret and 401 without a signed-in user (read the code).

### Task 1: Sign and verify
Files: create `supabase/functions/_shared/license.ts` (`signLicense(payload, privateJwk): Promise<string>`, `licensePayload(row, userId, nowSec): LicensePayload`), `src/lib/license-token.ts` (`verifyLicense(token, publicJwk, nowMs): Promise<VerifiedLicense | null>`, `parsePublicKey(raw: string | undefined): JsonWebKey | null`), test `src/lib/license-token.test.ts` generating a key pair with WebCrypto.
- [ ] Tests: round trip; tampered payload; other key; expired; future iat; wrong alg/typ; garbage strings; `licensePayload` maps lifetime/pro/free and sets exp.
- [ ] RED, implement, GREEN, commit "Sign and verify licence tokens".

### Task 2: Gate and floor
Files: modify `src/lib/entitlements.ts` (`resolveEntitlement(e, appMode, now, devTools, license: VerifiedLicense | null = null, publicKeySet = LICENSE_KEY_SET, floor = MONETIZATION_FLOOR)`, `licenseToken: string | null` in `EntitlementState` default null), tests in `src/lib/entitlements.test.ts`.
- [ ] Tests: key set + no licence → free despite edited tier; verified lifetime → lifetime; pro licence with past pro_until → free; no key → old rule; floor turns FOUNDERS_BETA into COMMERCIAL_LIVE in release only.
- [ ] RED, implement, GREEN, commit "Gate PRO on a verified licence".

### Task 3: Wire it up
Files: create `src/store/useLicense.ts` (in-memory verified licence + `verifyStoredLicense(token)`), `supabase/functions/license/index.ts`, `scripts/make-license-keys.mjs`; modify `src/store/useEntitlements.ts`, `src/components/paywall/EntitlementsProvider.tsx`, `src/lib/entitlement-sync.ts` (+test: token lands in `next`), `src/components/admin/BusinessModules.tsx` (pass licence), `src/components/admin/SystemModules.tsx` (Overview: "Licence signing on/off"), `docs/payments-setup.md`, `.github/workflows/android.yml` (pass the two NEXT_PUBLIC vars), `CLAUDE.md`.
- [ ] Test for sync carrying the token; RED, implement, GREEN; full suite, tsc, lint, build; commit "Fetch and check signed licences"; push; update PR.
