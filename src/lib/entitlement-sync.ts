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

/**
 * The account's licence laid over this device's: lifetime wins, pro time only moves forward, a
 * founder pass from the account fills an empty one here. Returns `local` itself when nothing changes.
 */
export function mergeAccountEntitlement(local: EntitlementState, data: AccountEntitlement, now = Date.now()): EntitlementState {
  let next = local;
  if (data.tier === "lifetime") next = applyGrant(next, { tier: "lifetime", days: null, founder: false }, "account", now);
  else if (data.tier === "pro" && data.pro_expires_at && Date.parse(data.pro_expires_at) > now) {
    const mine = next.tier === "pro" && next.proExpiresAt ? Date.parse(next.proExpiresAt) : 0;
    if (next.tier !== "lifetime" && Date.parse(data.pro_expires_at) > mine) next = { ...next, tier: "pro", proExpiresAt: data.pro_expires_at };
  }
  if (data.is_founder && !next.isFounder && typeof data.founder_unit_code === "string") {
    next = { ...next, isFounder: true, founderUnitCode: data.founder_unit_code, founderJoinedAt: next.founderJoinedAt ?? new Date(now).toISOString() };
  }
  return next.tier === local.tier && next.proExpiresAt === local.proExpiresAt && next.isFounder === local.isFounder && next.devOverrideMode === local.devOverrideMode
    ? local
    : next;
}

export type RestoreResult =
  /** No Supabase in this build: there is no account to restore from. */
  | { kind: "unavailable" }
  | { kind: "signed-out" }
  | { kind: "restored"; next: EntitlementState }
  /** The account holds nothing this phone does not already have. */
  | { kind: "up-to-date" }
  | { kind: "none" }
  | { kind: "error" };

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
    if (!data) return { kind: "none" };
    const next = mergeAccountEntitlement(local, data as AccountEntitlement);
    return next === local ? { kind: "up-to-date" } : { kind: "restored", next };
  } catch {
    return { kind: "error" };
  }
}

/**
 * When signed in: the account's licence (user_entitlements, written by redeem_code and
 * admin_grant) comes down to this device, and a founder pass stamped here during the beta goes up
 * through claim_founder. Signed out, or without Supabase, nothing happens.
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
  return r.kind === "restored" ? r.next : null;
}
