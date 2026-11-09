import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { getSupabase, maySignedIn } from "@/data/sync/client";
import { applyGrant, type EntitlementState } from "./entitlements";

/** The account's user_entitlements row, as the app reads it. */
export interface AccountEntitlement {
  tier: string;
  pro_expires_at: string | null;
  is_founder: boolean;
  founder_unit_code: string | null;
}

/** True when this licence state means the same thing as another (what a sync compares). */
function sameLicense(a: EntitlementState, b: EntitlementState): boolean {
  return (
    a.tier === b.tier &&
    a.proExpiresAt === b.proExpiresAt &&
    a.licenseSource === b.licenseSource &&
    a.isFounder === b.isFounder &&
    a.devOverrideMode === b.devOverrideMode
  );
}

/** The account's tier and end date as this device stores them; free when the row grants nothing. */
function accountLicense(data: AccountEntitlement | null, now: number): Pick<EntitlementState, "tier" | "proExpiresAt"> {
  if (data?.tier === "lifetime") return { tier: "lifetime", proExpiresAt: null };
  if (data?.tier === "pro" && data.pro_expires_at && Date.parse(data.pro_expires_at) > now) return { tier: "pro", proExpiresAt: data.pro_expires_at };
  return { tier: "free", proExpiresAt: null };
}

/**
 * The account's licence laid over this device's. `data` is the account's user_entitlements row,
 * or null when the account has none.
 *
 * - A licence that came from the account (licenseSource "account") follows the account exactly,
 *   so a refund, revocation or shorter end date there reaches this device, down to free.
 * - A licence held on this device only ("device", or one from before licenseSource existed) is
 *   never taken away: the account can only raise it (lifetime wins, pro time moves forward), and
 *   when it does, the licence becomes the account's.
 * - A founder pass from the account fills an empty one here; a pass is never removed.
 *
 * Returns `local` itself when nothing changes.
 */
export function mergeAccountEntitlement(local: EntitlementState, data: AccountEntitlement | null, now = Date.now()): EntitlementState {
  const acc = accountLicense(data, now);
  let next = local;
  if (local.licenseSource === "account") {
    next = { ...local, ...acc, licenseSource: acc.tier === "free" ? null : "account" };
  } else if (acc.tier === "lifetime" && local.tier !== "lifetime") {
    next = { ...applyGrant(local, { tier: "lifetime", days: null, founder: false }, "account", now, "account"), licenseSource: "account" };
  } else if (acc.tier === "pro" && local.tier !== "lifetime") {
    const mine = local.tier === "pro" && local.proExpiresAt ? Date.parse(local.proExpiresAt) : 0;
    if (Date.parse(acc.proExpiresAt!) > mine) next = { ...local, tier: "pro", proExpiresAt: acc.proExpiresAt, licenseSource: "account" };
  }
  if (data?.is_founder && !next.isFounder && typeof data.founder_unit_code === "string") {
    next = { ...next, isFounder: true, founderUnitCode: data.founder_unit_code, founderJoinedAt: next.founderJoinedAt ?? new Date(now).toISOString() };
  }
  return sameLicense(next, local) ? local : next;
}

export type RestoreResult =
  /** No Supabase in this build: there is no account to restore from. */
  | { kind: "unavailable" }
  | { kind: "signed-out" }
  | { kind: "restored"; next: EntitlementState }
  /** The account no longer holds the licence this phone had from it (refund or revocation). */
  | { kind: "revoked"; next: EntitlementState }
  /** The account holds nothing this phone does not already have. */
  | { kind: "up-to-date" }
  | { kind: "none" }
  | { kind: "error" };

/** The change takes paid time away: lifetime lost, or pro ending sooner or gone. */
function isLoss(before: EntitlementState, after: EntitlementState): boolean {
  if (before.tier === "lifetime") return after.tier !== "lifetime";
  if (before.tier !== "pro") return false;
  if (after.tier === "lifetime") return false;
  if (after.tier === "free") return true;
  return Date.parse(after.proExpiresAt ?? "0") < Date.parse(before.proExpiresAt ?? "0");
}

/** Reads the signed-in account's licence and says what it would change here. */
export async function restoreEntitlementFromAccount(local: EntitlementState): Promise<RestoreResult> {
  if (!isCloudSyncConfigured()) return { kind: "unavailable" };
  if (!maySignedIn()) return { kind: "signed-out" };
  try {
    const supabase = await getSupabase();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { kind: "signed-out" };
    const { data, error } = await supabase.from("user_entitlements").select("tier, pro_expires_at, is_founder, founder_unit_code").maybeSingle();
    if (error) return { kind: "error" };
    const next = mergeAccountEntitlement(local, (data as AccountEntitlement | null) ?? null);
    if (next !== local) return { kind: isLoss(local, next) ? "revoked" : "restored", next };
    return data ? { kind: "up-to-date" } : { kind: "none" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * When signed in: the account's licence (user_entitlements, written by redeem_code and
 * admin_grant) comes down to this device, including a refund or revocation of one it gave, and
 * a founder pass stamped here during the beta goes up through claim_founder. Signed out, or without Supabase, nothing happens.
 */
export async function syncEntitlementWithAccount(local: EntitlementState): Promise<EntitlementState | null> {
  if (!isCloudSyncConfigured() || !maySignedIn()) return null;
  try {
    const supabase = await getSupabase();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    if (local.isFounder && local.founderUnitCode) {
      await supabase.rpc("claim_founder", { p_unit_code: local.founderUnitCode });
    }
  } catch {
    return null;
  }
  const r = await restoreEntitlementFromAccount(local);
  return r.kind === "restored" || r.kind === "revoked" ? r.next : null;
}
