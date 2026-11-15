# Signed licence tokens

Date: 2026-11-15. Status: approved by the owner ("setuju, gas").

## Why

ABOT sells PRO as a licence that works offline. Today a paid tier counts in release builds when
the stored entitlement says `licenseSource: "account"`, and the monetization mode falls back to
a localStorage cache (`abot.remote-config`). Both are plain data: editing either one in DevTools
(web) opens every PRO feature. The fix must keep PRO working offline for people who paid.

## Goals

- In release builds, a paid tier opens PRO only from a licence token signed by ABOT's server
  whose signature checks out against a public key built into the app.
- The token works offline for 30 days after it was issued; every signed-in start refreshes it.
- After the owner goes live, an edited cache cannot turn the Founders beta back on.

## Non-goals

- Stopping someone who rebuilds the APK from the public repo or patches the JavaScript itself.
- Binding a token to a device.
- Changing development builds (the simulator stays).

## Constraints

- WebCrypto only, no new dependency. ECDSA P-256 with SHA-256 (ES256): every browser and Android
  WebView verifies it. Ed25519 is missing from older WebViews; HMAC would need the secret in the app.
- The private key lives only in a Supabase secret (`LICENSE_PRIVATE_JWK`). The public key is a
  build variable (`NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY`, JWK JSON), set on Vercel and in the
  repository's Actions variables for the APK.
- Network: one call to a new Supabase Edge Function (`license`) on the same occasions the app
  already reads `user_entitlements`. Supabase is already an approved host.
- A build without a public key keeps today's behaviour, so paying users never lose PRO because a
  variable was forgotten. Mission Control's Overview says whether signing is on.

## Design

- **Token**: compact JWS, `header.payload.signature` in base64url, header `{"alg":"ES256","typ":"ABOT-LICENSE"}`,
  payload `{ v: 1, sub, tier: "free"|"pro"|"lifetime", pro_until: ISO|null, iat, exp }` with
  `exp = iat + 30 days` (seconds). Signature is the raw 64-byte r||s WebCrypto produces.
- **Server**: `supabase/functions/_shared/license.ts` signs (pure WebCrypto, tested in Vitest);
  `supabase/functions/license/index.ts` checks the caller's Supabase token like `delete-account`,
  reads their `user_entitlements` row with the service role, and returns `{ token }`; 503
  `not_configured` without the secret.
- **App**: `src/lib/license-token.ts` verifies (alg, typ, signature, `exp > now`, `iat <= now + 10 min`)
  and returns `{ sub, tier, proUntil, exp }` or null. The token is stored in the entitlement as
  `licenseToken` (settings; backups drop it like the tier). An in-memory store holds the verified
  result; `EntitlementsProvider` verifies on load and whenever the token changes.
- **Gate**: `resolveEntitlement` gains a `license` argument. Release builds with a public key take the
  tier only from a verified, unexpired licence (pro also needs `pro_until > now`); without a public
  key they keep the `licenseSource` rule.
- **Mode floor**: `NEXT_PUBLIC_ABOT_MONETIZATION_FLOOR=COMMERCIAL_LIVE` makes release builds treat
  the mode as live whatever the cache says.
- **Sync**: `restoreEntitlementFromAccount` also asks `license` for a token and puts it in `next`.
- **Setup**: `scripts/make-license-keys.mjs` prints a new key pair (nothing written to disk);
  `docs/payments-setup.md` gets the steps.

## Known limits

A token is a bearer token. On a signed-in device it counts only for that account (`sub` must match),
and every sync replaces it with the account's own. On a signed-out device a token copied from
someone else works until it expires (at most 30 days). Device binding stays a non-goal.

Setting the phone's clock back keeps a token alive past 30 days (but not before its `iat`). A
rebuilt or patched app ignores all of this.
