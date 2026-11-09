import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { getSupabase, maySignedIn } from "@/data/sync/client";
import { applyGrant, type EntitlementState } from "./entitlements";

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
    const { data } = await supabase.from("user_entitlements").select("tier, pro_expires_at, is_founder, founder_unit_code").maybeSingle();
    if (!data) return null;
    let next = local;
    if (data.tier === "lifetime") next = applyGrant(next, { tier: "lifetime", days: null, founder: false }, "account");
    else if (data.tier === "pro" && data.pro_expires_at && Date.parse(data.pro_expires_at) > Date.now()) {
      const mine = next.tier === "pro" && next.proExpiresAt ? Date.parse(next.proExpiresAt) : 0;
      if (next.tier !== "lifetime" && Date.parse(data.pro_expires_at) > mine) next = { ...next, tier: "pro", proExpiresAt: data.pro_expires_at };
    }
    if (data.is_founder && !next.isFounder && typeof data.founder_unit_code === "string") {
      next = { ...next, isFounder: true, founderUnitCode: data.founder_unit_code, founderJoinedAt: next.founderJoinedAt ?? new Date().toISOString() };
    }
    return next === local ? null : next;
  } catch {
    return null;
  }
}
