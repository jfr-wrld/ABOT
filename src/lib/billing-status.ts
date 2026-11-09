import type { Resolved } from "./entitlements";

export type PlanKind = "core" | "pro" | "lifetime" | "beta";

export interface BillingStatus {
  plan: PlanKind;
  /** ISO date PRO ends; null for lifetime, beta, core, or a simulated PRO with no end date. */
  expiresAt: string | null;
  /** Calendar days from today to the end date (0 on the last day); null when there is none. */
  daysLeft: number | null;
}

/** Names shown on the plan card; product names, not translated. */
export const PLAN_NAME: Record<PlanKind, string> = {
  core: "CORE",
  pro: "BLACK PRO",
  lifetime: "LIFETIME",
  beta: "FOUNDERS BETA",
};

const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/** What the lifter holds, in the order that matters to them: a paid licence before the beta. */
export function billingStatus(r: Pick<Resolved, "tier" | "isBetaUnlocked">, proExpiresAt: string | null, now = Date.now()): BillingStatus {
  if (r.tier === "lifetime") return { plan: "lifetime", expiresAt: null, daysLeft: null };
  if (r.tier === "pro") {
    const end = proExpiresAt ? Date.parse(proExpiresAt) : NaN;
    if (Number.isNaN(end)) return { plan: "pro", expiresAt: null, daysLeft: null };
    // Calendar days, so the figure matches the date shown beside it and does not tick over mid-day.
    // Rounded, because a day across a DST change is not 24 hours.
    return { plan: "pro", expiresAt: proExpiresAt, daysLeft: Math.max(0, Math.round((startOfDay(end) - startOfDay(now)) / 86_400_000)) };
  }
  return { plan: r.isBetaUnlocked ? "beta" : "core", expiresAt: null, daysLeft: null };
}
