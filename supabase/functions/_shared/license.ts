// ABOT // licence tokens, signing side. The app verifies them with src/lib/license-token.ts.
// A token is a compact JWS (ES256: ECDSA P-256 with SHA-256), so every browser and Android
// WebView can check it with WebCrypto. It is valid for 30 days after it is issued; a signed-in
// app asks for a new one each time it starts. Pure WebCrypto: runs in Deno and in Vitest.

export const LICENSE_TTL_SECONDS = 30 * 24 * 3600;

export interface LicensePayload {
  v: 1;
  sub: string;
  tier: "free" | "pro" | "lifetime";
  pro_until: string | null;
  iat: number;
  exp: number;
}

/** The token's claims for an account's user_entitlements row (null when it has none). */
export function licensePayload(row: { tier?: unknown; pro_expires_at?: unknown } | null, userId: string, nowSec: number): LicensePayload {
  const tier = row?.tier === "pro" || row?.tier === "lifetime" ? row.tier : "free";
  const proUntil = tier === "pro" && typeof row?.pro_expires_at === "string" ? row.pro_expires_at : null;
  const iat = Math.floor(nowSec);
  return { v: 1, sub: userId, tier, pro_until: proUntil, iat, exp: iat + LICENSE_TTL_SECONDS };
}

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const HEADER = base64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "ABOT-LICENSE" })));

export async function signLicense(payload: LicensePayload, privateJwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const input = `${HEADER}.${base64url(new TextEncoder().encode(JSON.stringify(payload)))}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return `${input}.${base64url(new Uint8Array(sig))}`;
}
