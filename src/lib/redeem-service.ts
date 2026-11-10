import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { getSupabase, maySignedIn } from "@/data/sync/client";
import { currentMonetizationMode, useRemoteConfig } from "./remote-config";
import type { Tier } from "./entitlements";
import { DEV_TOOLS } from "./dev-tools";

/**
 * VIP, influencer and promo codes.
 *
 * Release builds: a signed-in account sends the code to the `redeem_code` function, which checks
 * and counts uses atomically and records the grant on the account. That is the only way a code
 * grants anything, so a code cannot be stacked on a device or carried by a backup.
 *
 * Development builds also accept the built-in test codes (during the Founders beta, while
 * Mission Control allows them) and codes made in Mission Control on a build without Supabase,
 * kept on that device. Both lived in the app itself, so release builds leave them out (security
 * audit 2026-11-11).
 */

export interface Grant {
  tier: Exclude<Tier, "free">;
  /** null: lifetime. */
  days: number | null;
  founder: boolean;
}

export type RedeemResult =
  | {
      ok: true;
      code: string;
      grant: Grant;
      source: "server" | "offline" | "local";
      /** The grant was recorded on the signed-in account, so the account can later revoke it. */
      onAccount: boolean;
    }
  | { ok: false; reason: string };

/** "abot vip  30d" -> "ABOT-VIP-30D" */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Development only (see redeemLicenseCode): SHA-256 of a normalized test code -> its grant. */
const BUILT_IN: Record<string, Grant> = {
  "7ede389f83e8adffa9ea1bea43d2f01630ab1015d4bb9aad1bb008d68af8ddf8": { tier: "pro", days: 365, founder: true },
  ab5cb157fdd264617bdf265edbddb640ab63af7c54ff448458627c150c33d69e: { tier: "pro", days: 30, founder: false },
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

type ServerAnswer = { grant: Grant; onAccount: true } | { none: true } | { tooMany: true } | { unreachable: true };

/**
 * The redeem_code RPC, with the account's session: the server refuses signed-out calls and allows
 * 10 tries an hour (security audit 2026-11-11), and the grant lands on the account.
 */
async function redeemOnServer(code: string): Promise<ServerAnswer> {
  if (!isCloudSyncConfigured() || !maySignedIn()) return { unreachable: true };
  try {
    const { data, error } = await (await getSupabase()).rpc("redeem_code", { p_code: code });
    if (error) return error.code === "54000" ? { tooMany: true } : { unreachable: true };
    const rows = data as { grant_tier: string; duration_days: number | null; grants_founder_badge: boolean }[] | null;
    const r = Array.isArray(rows) ? rows[0] : null;
    if (!r) return { none: true };
    const tier = r.grant_tier === "lifetime" ? "lifetime" : "pro";
    return {
      grant: { tier, days: tier === "lifetime" ? null : (r.duration_days ?? 30), founder: r.grants_founder_badge === true },
      onAccount: true,
    };
  } catch {
    return { unreachable: true };
  }
}

/** Built-in codes count only during the Founders beta, and only while Mission Control allows them. */
export function builtInCodesAccepted(): boolean {
  return currentMonetizationMode() === "FOUNDERS_BETA" && useRemoteConfig.getState().config.offlineCodesEnabled;
}

export const REDEEM_REASONS = {
  empty: "Enter a code.",
  signIn: "Sign in to redeem a code: it is checked on ABOT's server and kept on your account.",
  unknown: "This code is not valid, or it has been used up.",
  tooMany: "Too many tries. Wait an hour, then enter the code again.",
} as const;

/**
 * Checks a code (server first, then built-in and this device's own) and returns what it grants.
 * Applying the grant and the celebration are the caller's (see useEntitlements.redeem).
 */
export async function redeemLicenseCode(input: string): Promise<RedeemResult> {
  const code = normalizeCode(input);
  if (code.length < 6) return { ok: false, reason: REDEEM_REASONS.empty };

  // Release builds: a code is checked on the server, for a signed-in account, and the grant lands
  // on that account. Built-in and this-device codes are for development only: they lived in the
  // app (and its comments), could be stacked, and could not be revoked (security audit 2026-11-11).
  if (!DEV_TOOLS && !maySignedIn()) return { ok: false, reason: REDEEM_REASONS.signIn };
  const server = await redeemOnServer(code);
  if ("grant" in server) return { ok: true, code, grant: server.grant, source: "server", onAccount: server.onAccount };
  if ("tooMany" in server) return { ok: false, reason: REDEEM_REASONS.tooMany };
  if (!DEV_TOOLS) return { ok: false, reason: REDEEM_REASONS.unknown };

  if (builtInCodesAccepted()) {
    const builtIn = BUILT_IN[await sha256Hex(code)];
    if (builtIn) return { ok: true, code, grant: builtIn, source: "offline", onAccount: false };
  }

  const local = readLocalCodes();
  const hit = local.find((c) => c.code === code && c.active && c.uses < c.maxUses);
  if (hit) {
    writeLocalCodes(local.map((c) => (c === hit ? { ...c, uses: c.uses + 1 } : c)));
    return { ok: true, code, grant: hit.grant, source: "local", onAccount: false };
  }
  return { ok: false, reason: REDEEM_REASONS.unknown };
}
