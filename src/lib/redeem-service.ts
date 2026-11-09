import { SUPABASE_ENV, isCloudSyncConfigured } from "@/data/sync/supabase";
import { getSupabase, maySignedIn } from "@/data/sync/client";
import { useRemoteConfig } from "./remote-config";
import type { Tier } from "./entitlements";

/**
 * VIP, influencer and promo codes.
 *
 * 1. With Supabase set up and online, the code goes to the `redeem_code` function, which checks
 *    and counts uses atomically and, when signed in, records the grant on the account.
 * 2. Built-in codes (ABOT-FOUNDER-2026, ABOT-BLACK-LIFE, ...) also work offline. They are in every
 *    copy of the app, kept only as SHA-256 hashes, and Mission Control can turn them off for
 *    everyone (remote config). Treat them as public promo codes, not secrets.
 * 3. Codes made in Mission Control on a build without Supabase are kept on that device only.
 * Codes made in Mission Control with Supabase are checked online only: a code that can be
 * verified with no server would have to ship its secret inside the app.
 */

export interface Grant {
  tier: Exclude<Tier, "free">;
  /** null: lifetime. */
  days: number | null;
  founder: boolean;
}

export type RedeemResult = { ok: true; code: string; grant: Grant; source: "server" | "offline" | "local" } | { ok: false; reason: string };

/** "abot vip  30d" -> "ABOT-VIP-30D" */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** SHA-256 of the normalized code -> what it grants. */
const BUILT_IN: Record<string, Grant> = {
  // ABOT-FOUNDER-2026
  "7ede389f83e8adffa9ea1bea43d2f01630ab1015d4bb9aad1bb008d68af8ddf8": { tier: "pro", days: 365, founder: true },
  // ABOT-VIP-LIFETIME
  "3fb43f0b8c747062757e69ab77578022a4ab6ba4cbb96ab783b51e802f848824": { tier: "lifetime", days: null, founder: false },
  // ABOT-BLACK-LIFE
  "2a4ff8dc861586acbcbfd37782181b6112a3b2ae7e2d0f2b62f639ce1a6f3aa0": { tier: "lifetime", days: null, founder: false },
  // ABOT-PRO-30D
  ab5cb157fdd264617bdf265edbddb640ab63af7c54ff448458627c150c33d69e: { tier: "pro", days: 30, founder: false },
  // ABOT-VIP-30D
  df92b5adc8fc29568ead60b5b732fe4995b8a488ce6c1db4bd0bd42585848c61: { tier: "pro", days: 30, founder: false },
};

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------- local codes */

export interface LocalCode {
  code: string;
  grant: Grant;
  maxUses: number;
  uses: number;
  active: boolean;
  createdAt: string;
}

const LOCAL_CODES = "abot.local-codes";

export function readLocalCodes(): LocalCode[] {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_CODES) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function writeLocalCodes(codes: LocalCode[]): void {
  try {
    localStorage.setItem(LOCAL_CODES, JSON.stringify(codes));
  } catch {
    // Storage blocked: nothing to keep.
  }
}

/* ---------------------------------------------------------------- generator */

/** No 0/O or 1/I, so a code read out over WhatsApp is not mistyped. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * ABOT-VIP-XXXX-XXXX-XXXX: 12 random symbols (60 bits), too many to guess through the redeem
 * function. `kind` is a readable label (VIP, LIFE, PRO, FOUNDER).
 */
export function generateCode(kind: string, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(12);
  const sym = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `ABOT-${normalizeCode(kind)}-${sym.slice(0, 4)}-${sym.slice(4, 8)}-${sym.slice(8, 12)}`;
}

/* ------------------------------------------------------------------- redeem */

type ServerAnswer = { grant: Grant } | { none: true } | { unreachable: true };

/** The redeem_code RPC: with the session when signed in (the grant lands on the account). */
async function redeemOnServer(code: string): Promise<ServerAnswer> {
  if (!isCloudSyncConfigured()) return { unreachable: true };
  try {
    let rows: { grant_tier: string; duration_days: number | null; grants_founder_badge: boolean }[] | null;
    if (maySignedIn()) {
      const { data, error } = await (await getSupabase()).rpc("redeem_code", { p_code: code });
      if (error) return { unreachable: true };
      rows = data as typeof rows;
    } else {
      const res = await fetch(`${SUPABASE_ENV.url}/rest/v1/rpc/redeem_code`, {
        method: "POST",
        headers: { apikey: SUPABASE_ENV.anonKey!, Authorization: `Bearer ${SUPABASE_ENV.anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_code: code }),
      });
      if (!res.ok) return { unreachable: true };
      rows = await res.json();
    }
    const r = Array.isArray(rows) ? rows[0] : null;
    if (!r) return { none: true };
    const tier = r.grant_tier === "lifetime" ? "lifetime" : "pro";
    return { grant: { tier, days: tier === "lifetime" ? null : (r.duration_days ?? 30), founder: r.grants_founder_badge === true } };
  } catch {
    return { unreachable: true };
  }
}

export const REDEEM_REASONS = {
  empty: "Enter a code.",
  unknown: "This code is not valid, or it has been used up.",
} as const;

/**
 * Checks a code (server first, then built-in and this device's own) and returns what it grants.
 * Applying the grant and the celebration are the caller's (see useEntitlements.redeem).
 */
export async function redeemLicenseCode(input: string): Promise<RedeemResult> {
  const code = normalizeCode(input);
  if (code.length < 6) return { ok: false, reason: REDEEM_REASONS.empty };

  const server = await redeemOnServer(code);
  if ("grant" in server) return { ok: true, code, grant: server.grant, source: "server" };

  if (useRemoteConfig.getState().config.offlineCodesEnabled) {
    const builtIn = BUILT_IN[await sha256Hex(code)];
    if (builtIn) return { ok: true, code, grant: builtIn, source: "offline" };
  }

  const local = readLocalCodes();
  const hit = local.find((c) => c.code === code && c.active && c.uses < c.maxUses);
  if (hit) {
    writeLocalCodes(local.map((c) => (c === hit ? { ...c, uses: c.uses + 1 } : c)));
    return { ok: true, code, grant: hit.grant, source: "local" };
  }
  return { ok: false, reason: REDEEM_REASONS.unknown };
}
