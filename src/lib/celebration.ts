import type { EntitlementState } from "./entitlements";

/**
 * What a purchase just changed, read from the licence before and after it, so the celebration
 * says the right thing: a first unlock, a year added to time already held, or pro made lifetime.
 */
export type Unlocked =
  | { kind: "new"; tier: "pro"; until: string | null }
  | { kind: "new"; tier: "lifetime" }
  | { kind: "extended"; tier: "pro"; from: string; until: string; days: number }
  | { kind: "upgraded"; tier: "lifetime" };

const DAY = 86_400_000;

export function celebrationCase(
  before: Pick<EntitlementState, "tier" | "proExpiresAt">,
  after: Pick<EntitlementState, "tier" | "proExpiresAt">,
  now = Date.now(),
): Unlocked {
  const heldPro = before.tier === "pro" && before.proExpiresAt !== null && Date.parse(before.proExpiresAt) > now;
  if (after.tier === "lifetime") return heldPro ? { kind: "upgraded", tier: "lifetime" } : { kind: "new", tier: "lifetime" };
  if (heldPro && after.proExpiresAt && Date.parse(after.proExpiresAt) > Date.parse(before.proExpiresAt!)) {
    return {
      kind: "extended",
      tier: "pro",
      from: before.proExpiresAt!,
      until: after.proExpiresAt,
      days: Math.round((Date.parse(after.proExpiresAt) - Date.parse(before.proExpiresAt!)) / DAY),
    };
  }
  return { kind: "new", tier: "pro", until: after.proExpiresAt };
}
