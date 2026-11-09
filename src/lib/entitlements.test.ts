import { describe, expect, it } from "vitest";
import { DEFAULT_ENTITLEMENT, PLANS, annualSaving, claimFounder, founderNumber, planPrice, resolveEntitlement, rupiah } from "./entitlements";

const now = Date.parse("2026-11-09T00:00:00Z");

describe("resolveEntitlement", () => {
  it("founders beta opens every PRO feature for a free user", () => {
    expect(resolveEntitlement(DEFAULT_ENTITLEMENT, "FOUNDERS_BETA", now)).toEqual({ mode: "FOUNDERS_BETA", tier: "free", isBetaUnlocked: true, proActive: true });
  });

  it("commercial mode locks free users and opens pro and lifetime", () => {
    expect(resolveEntitlement(DEFAULT_ENTITLEMENT, "COMMERCIAL_LIVE", now).proActive).toBe(false);
    expect(resolveEntitlement({ ...DEFAULT_ENTITLEMENT, tier: "lifetime" }, "COMMERCIAL_LIVE", now).proActive).toBe(true);
    expect(resolveEntitlement({ ...DEFAULT_ENTITLEMENT, tier: "pro", proExpiresAt: "2026-12-01T00:00:00Z" }, "COMMERCIAL_LIVE", now).proActive).toBe(true);
  });

  it("an expired pro subscription is free again", () => {
    const r = resolveEntitlement({ ...DEFAULT_ENTITLEMENT, tier: "pro", proExpiresAt: "2026-11-01T00:00:00Z" }, "COMMERCIAL_LIVE", now);
    expect(r).toMatchObject({ tier: "free", proActive: false });
  });

  it("the simulator overrides the build: free locked, pro active, beta", () => {
    const e = { ...DEFAULT_ENTITLEMENT, isFounder: true };
    expect(resolveEntitlement({ ...e, devOverrideMode: "FORCE_FREE" }, "FOUNDERS_BETA", now)).toMatchObject({ mode: "COMMERCIAL_LIVE", tier: "free", proActive: false, isBetaUnlocked: false });
    expect(resolveEntitlement({ ...e, devOverrideMode: "FORCE_PRO" }, "FOUNDERS_BETA", now)).toMatchObject({ mode: "COMMERCIAL_LIVE", tier: "pro", proActive: true, isBetaUnlocked: false });
    expect(resolveEntitlement({ ...e, devOverrideMode: "FORCE_BETA" }, "COMMERCIAL_LIVE", now)).toMatchObject({ isBetaUnlocked: true, proActive: true });
  });
});

describe("founder pass", () => {
  it("stamps a fixed four-digit unit code once, and keeps it", () => {
    const a = claimFounder(DEFAULT_ENTITLEMENT, "install-1", new Date(now));
    expect(a.founderUnitCode).toMatch(/^FOUNDER \/\/ #\d{4}$/);
    expect(a.founderJoinedAt).toBe("2026-11-09T00:00:00.000Z");
    expect(claimFounder(a, "another-seed")).toBe(a);
    expect(founderNumber("install-1")).toBe(founderNumber("install-1"));
    expect(founderNumber("x")).not.toBe("0000");
  });
});

describe("plans", () => {
  it("prices: Rp 29.000 a month, Rp 199.000 a year (43% saving), lifetime half price for founders", () => {
    expect(PLANS.map((p) => rupiah(p.idr))).toEqual(["Rp 29.000", "Rp 199.000", "Rp 798.000"]);
    expect(annualSaving()).toBe(43);
    const life = PLANS.find((p) => p.id === "lifetime")!;
    expect(planPrice(life, true)).toEqual({ idr: 399_000, usd: 39.99, was: { idr: 798_000, usd: 79.98 } });
    expect(planPrice(life, false).was).toBeNull();
  });
});
