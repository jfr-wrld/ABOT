/**
 * ABOT licence tokens, checking side (signed by supabase/functions/_shared/license.ts). Release
 * builds open a paid tier only from a token whose ES256 signature matches the public key built
 * into the app, so editing the stored tier on the device opens nothing. The check is offline.
 */

export interface VerifiedLicense {
  sub: string;
  tier: "free" | "pro" | "lifetime";
  proUntil: string | null;
  /** When the token stops working offline, in ms. */
  exp: number;
}

/** How far ahead of this device's clock a token's issue time may be: a phone set hours wrong still works. */
const SKEW_MS = 12 * 3600 * 1000;

/** The public key from NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY, or null. A private key is refused. */
export function parsePublicKey(raw: string | undefined): JsonWebKey | null {
  if (!raw) return null;
  try {
    const k = JSON.parse(raw) as JsonWebKey;
    return k && k.kty === "EC" && k.crv === "P-256" && typeof k.x === "string" && typeof k.y === "string" && k.d === undefined ? k : null;
  } catch {
    return null;
  }
}

function fromBase64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function json(bytes: Uint8Array | null): Record<string, unknown> | null {
  if (!bytes) return null;
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function verifyLicense(token: string, publicJwk: JsonWebKey, nowMs: number): Promise<VerifiedLicense | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  const header = json(fromBase64url(h));
  if (header?.alg !== "ES256" || header.typ !== "ABOT-LICENSE") return null;
  const sig = fromBase64url(s);
  if (!sig || sig.length !== 64) return null;
  try {
    const key = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
  } catch {
    return null;
  }
  const c = json(fromBase64url(p));
  if (!c || c.v !== 1 || typeof c.sub !== "string" || typeof c.iat !== "number" || typeof c.exp !== "number") return null;
  if (c.tier !== "free" && c.tier !== "pro" && c.tier !== "lifetime") return null;
  if (c.exp * 1000 <= nowMs || c.iat * 1000 > nowMs + SKEW_MS) return null;
  return { sub: c.sub, tier: c.tier, proUntil: typeof c.pro_until === "string" ? c.pro_until : null, exp: c.exp * 1000 };
}

/**
 * The licence counts for the account signed in on this device, or on a signed-out device. A token
 * copied from another account is refused while someone else is signed in.
 */
export function licenseFor(license: VerifiedLicense | null, signedInUserId: string | null): VerifiedLicense | null {
  return license && (signedInUserId === null || license.sub === signedInUserId) ? license : null;
}
