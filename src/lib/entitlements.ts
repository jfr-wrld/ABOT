/**
 * ABOT // BLACK PRO entitlements. Everything is decided on the device: no server, no network.
 *
 * - The app runs in one monetization mode, set at build time (NEXT_PUBLIC_ABOT_MONETIZATION):
 *   FOUNDERS_BETA (now): every PRO feature is open to everyone, marked "PRO // BETA", and every
 *   install made during the beta is stamped a Founder with a permanent unit code.
 *   COMMERCIAL_LIVE: PRO features need tier "pro" (not expired) or "lifetime"; free users see a
 *   soft-locked preview and the paywall.
 * - The simulator (devOverrideMode) lets anyone switch between Beta, Free (locked) and Pro to
 *   try both sides without a rebuild. AUTO follows the build.
 */

export type MonetizationMode = "FOUNDERS_BETA" | "COMMERCIAL_LIVE";
export type Tier = "free" | "pro" | "lifetime";
export type DevOverride = "AUTO" | "FORCE_FREE" | "FORCE_PRO" | "FORCE_BETA";

export interface EntitlementState {
  tier: Tier;
  isFounder: boolean;
  /** "FOUNDER // #0421", fixed at the founder claim. */
  founderUnitCode: string | null;
  /** ISO date of the claim. */
  founderJoinedAt: string | null;
  proExpiresAt: string | null;
  /**
   * Where the paid licence on this device comes from. "account": the signed-in account's
   * user_entitlements row, which is the source of truth, so a refund or revocation there removes it
   * here. "device": a code checked on this device only (built-in or a local Mission Control code),
   * which the account cannot take away. null: free, or a licence from before this field existed
   * (kept, never downgraded).
   */
  licenseSource: "account" | "device" | null;
  devOverrideMode: DevOverride;
}

export const DEFAULT_ENTITLEMENT: EntitlementState = {
  tier: "free",
  isFounder: false,
  founderUnitCode: null,
  founderJoinedAt: null,
  proExpiresAt: null,
  licenseSource: null,
  devOverrideMode: "AUTO",
};

export const APP_MONETIZATION_MODE: MonetizationMode =
  process.env.NEXT_PUBLIC_ABOT_MONETIZATION === "COMMERCIAL_LIVE" ? "COMMERCIAL_LIVE" : "FOUNDERS_BETA";

export type ProFeatureKey =
  | "progressive_overload_coach"
  | "symmetry_radar_telemetry"
  | "thermal_recovery_inspector"
  | "voice_handsfree_logger"
  | "smart_exercise_swap"
  | "story_studio_pro_presets"
  | "remove_story_watermark"
  | "body_phase_protocols";

/** Names shown on the paywall's "Unlock feature" banner. */
export const PRO_FEATURE_LABEL: Record<ProFeatureKey, string> = {
  progressive_overload_coach: "Auto-overload coach",
  symmetry_radar_telemetry: "Hexagon symmetry radar",
  thermal_recovery_inspector: "72h thermal recovery inspector",
  voice_handsfree_logger: "Hands-free voice logger",
  smart_exercise_swap: "Smart exercise swap",
  story_studio_pro_presets: "Story Studio pro presets",
  remove_story_watermark: "Story without watermark",
  body_phase_protocols: "Body phase protocols",
};

export interface Resolved {
  mode: MonetizationMode;
  tier: Tier;
  /** Every PRO feature is open because of the beta, not a purchase. */
  isBetaUnlocked: boolean;
  /** PRO features are open, for whatever reason. */
  proActive: boolean;
}

/** What the rules say for this state at `now`, after the simulator override. */
export function resolveEntitlement(e: EntitlementState, appMode: MonetizationMode = APP_MONETIZATION_MODE, now = Date.now()): Resolved {
  const mode: MonetizationMode =
    e.devOverrideMode === "FORCE_BETA" ? "FOUNDERS_BETA" : e.devOverrideMode === "FORCE_FREE" || e.devOverrideMode === "FORCE_PRO" ? "COMMERCIAL_LIVE" : appMode;
  const tier: Tier = e.devOverrideMode === "FORCE_FREE" ? "free" : e.devOverrideMode === "FORCE_PRO" ? (e.tier === "lifetime" ? "lifetime" : "pro") : e.tier;
  const expired = tier === "pro" && e.devOverrideMode !== "FORCE_PRO" && e.proExpiresAt !== null && Date.parse(e.proExpiresAt) <= now;
  const paid = tier === "lifetime" || (tier === "pro" && !expired);
  const isBetaUnlocked = mode === "FOUNDERS_BETA";
  return { mode, tier: expired ? "free" : tier, isBetaUnlocked, proActive: isBetaUnlocked || paid };
}

/** Four digits from an id, the same digits for the same id: 0001 to 9999. */
export function founderNumber(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return String(((h >>> 0) % 9999) + 1).padStart(4, "0");
}

/**
 * The founder stamp for an install during the beta. `seed` is any id unique to the install
 * (the first claim's random id plus time); the code never changes after it is saved.
 */
export function claimFounder(e: EntitlementState, seed: string, now = new Date()): EntitlementState {
  if (e.isFounder) return e;
  return { ...e, isFounder: true, founderUnitCode: `FOUNDER // #${founderNumber(seed)}`, founderJoinedAt: now.toISOString() };
}

/**
 * Free against PRO on the paywall, row by row. `true` included, `false` not, text a limit.
 * Routines and cloud/Health Connect sync stay free: they are core logging, and ProFeatureKey has no
 * key for them, so this table and the gates say the same thing.
 */
export const PRO_MATRIX: { feature: string; core: boolean | string; pro: boolean | string }[] = [
  { feature: "Workout logging, routines, records", core: true, pro: true },
  { feature: "Auto-overload coach", core: false, pro: true },
  { feature: "72h thermal recovery inspector", core: "Map only", pro: true },
  { feature: "Hexagon symmetry radar diagnostics", core: "Radar only", pro: true },
  { feature: "Story presets", core: "2", pro: "11 + no watermark" },
  { feature: "Voice logger", core: false, pro: true },
  { feature: "Body phases: cut, bulk, recomp, peak", core: false, pro: true },
  { feature: "Cloud backup and Health Connect sync", core: true, pro: true },
];

/** The simulator's three positions. */
export const SIMULATOR: { mode: DevOverride; label: string }[] = [
  { mode: "AUTO", label: "Beta mode" },
  { mode: "FORCE_FREE", label: "Free locked" },
  { mode: "FORCE_PRO", label: "Pro active" },
];

/**
 * A redeemed code or a manual grant: lifetime beats everything; pro days add onto pro time not
 * used yet; a founder grant stamps the pass if there is none. A simulator stuck on "Free locked"
 * is released, so the lifter sees what they just unlocked.
 */
export function applyGrant(
  e: EntitlementState,
  grant: { tier: "pro" | "lifetime"; days: number | null; founder: boolean },
  seed: string,
  now = Date.now(),
  source: "account" | "device" = "device",
): EntitlementState {
  // A device-only grant on top of an account licence makes the result device-held: the account
  // can no longer take back days it never gave.
  const licenseSource = source === "device" || e.licenseSource === "device" ? "device" : "account";
  let next: EntitlementState = { ...e, licenseSource, devOverrideMode: e.devOverrideMode === "FORCE_FREE" ? "AUTO" : e.devOverrideMode };
  if (grant.tier === "lifetime" || e.tier === "lifetime") {
    next = { ...next, tier: "lifetime", proExpiresAt: null };
  } else {
    const from = e.tier === "pro" && e.proExpiresAt && Date.parse(e.proExpiresAt) > now ? Date.parse(e.proExpiresAt) : now;
    next = { ...next, tier: "pro", proExpiresAt: new Date(from + (grant.days ?? 30) * 86_400_000).toISOString() };
  }
  return grant.founder ? claimFounder(next, seed, new Date(now)) : next;
}

/* ---------------------------------------------------------------- plans */

export type PlanId = "monthly" | "annual" | "lifetime";

export interface Plan {
  id: PlanId;
  name: string;
  /** IDR, whole rupiah. */
  idr: number;
  usd: number;
  per: "month" | "year" | "once";
  note: string;
}

export const PLANS: Plan[] = [
  { id: "monthly", name: "Monthly protocol", idr: 29_000, usd: 2.99, per: "month", note: "Flexible, cancel any time" },
  { id: "annual", name: "Annual telemetry", idr: 199_000, usd: 19.99, per: "year", note: "Best value" },
  { id: "lifetime", name: "Founders lifetime license", idr: 798_000, usd: 79.98, per: "once", note: "Pay once, keep it for life" },
];

export interface PlanPrices {
  monthlyIdr: number;
  annualIdr: number;
  lifetimeIdr: number;
  monthlyUsd: number;
  annualUsd: number;
  lifetimeUsd: number;
}

/** The plans at the prices Mission Control set (remote config), names and notes unchanged. */
export function plansFor(p: PlanPrices): Plan[] {
  const by: Record<PlanId, [number, number]> = {
    monthly: [p.monthlyIdr, p.monthlyUsd],
    annual: [p.annualIdr, p.annualUsd],
    lifetime: [p.lifetimeIdr, p.lifetimeUsd],
  };
  return PLANS.map((plan) => ({ ...plan, idr: by[plan.id][0], usd: by[plan.id][1] }));
}

/** Founders pay half for the lifetime license. */
export const FOUNDER_LIFETIME_DISCOUNT = 0.5;

/** What this lifter pays for a plan, with the founder discount on lifetime. */
export function planPrice(plan: Plan, isFounder: boolean): { idr: number; usd: number; was: { idr: number; usd: number } | null } {
  if (plan.id === "lifetime" && isFounder) {
    return {
      idr: Math.round(plan.idr * (1 - FOUNDER_LIFETIME_DISCOUNT)),
      usd: Math.round(plan.usd * (1 - FOUNDER_LIFETIME_DISCOUNT) * 100) / 100,
      was: { idr: plan.idr, usd: plan.usd },
    };
  }
  return { idr: plan.idr, usd: plan.usd, was: null };
}

/** Annual against twelve months: 43% for Rp 199.000 against 12 x Rp 29.000. */
export function annualSaving(plans: Plan[] = PLANS): number {
  const m = plans.find((p) => p.id === "monthly")!;
  const y = plans.find((p) => p.id === "annual")!;
  return Math.round((1 - y.idr / (m.idr * 12)) * 100);
}

/** "Rp 29.000" */
export function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/* ---------------------------------------------------------------- checkout */

export const CHECKOUT_NOT_CONNECTED = "Payments are not connected yet. During the beta every PRO feature is free.";

export type CheckoutResult = { ok: true } | { ok: false; reason: string };

/**
 * Where a real purchase plugs in: RevenueCat (Google Play Billing) in the app, or a QRIS /
 * LemonSqueezy checkout URL on the web. Nothing is connected yet, and ABOT makes no network
 * calls, so this answers honestly instead of pretending to charge.
 */
export async function startCheckout(plan: PlanId): Promise<CheckoutResult> {
  void plan; // The provider will take the plan id; none is wired yet.
  return { ok: false, reason: CHECKOUT_NOT_CONNECTED };
}
