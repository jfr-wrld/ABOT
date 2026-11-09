import { describe, expect, it } from "vitest";
import { billingStatus } from "./billing-status";
import { DEFAULT_ENTITLEMENT } from "./entitlements";
import { mergeAccountEntitlement } from "./entitlement-sync";

const now = Date.parse("2026-11-09T12:00:00Z");

describe("billingStatus", () => {
  it("a paid licence shows before the beta", () => {
    expect(billingStatus({ tier: "lifetime", isBetaUnlocked: true }, null, now)).toEqual({ plan: "lifetime", expiresAt: null, daysLeft: null });
    expect(billingStatus({ tier: "pro", isBetaUnlocked: true }, "2026-11-19T12:00:00Z", now)).toMatchObject({ plan: "pro", daysLeft: 10 });
  });

  it("counts calendar days, so a fresh 30-day code reads 30 all day, and never below zero", () => {
    expect(billingStatus({ tier: "pro", isBetaUnlocked: false }, "2026-12-09T12:00:30Z", now).daysLeft).toBe(30);
    expect(billingStatus({ tier: "pro", isBetaUnlocked: false }, "2026-11-09T13:00:00Z", now).daysLeft).toBe(0);
    expect(billingStatus({ tier: "pro", isBetaUnlocked: false }, "2026-11-01T00:00:00Z", now).daysLeft).toBe(0);
  });

  it("a simulated PRO has no end date", () => {
    expect(billingStatus({ tier: "pro", isBetaUnlocked: false }, null, now)).toEqual({ plan: "pro", expiresAt: null, daysLeft: null });
  });

  it("free is the beta while it runs, core after", () => {
    expect(billingStatus({ tier: "free", isBetaUnlocked: true }, null, now).plan).toBe("beta");
    expect(billingStatus({ tier: "free", isBetaUnlocked: false }, null, now).plan).toBe("core");
  });
});

describe("mergeAccountEntitlement", () => {
  const row = { tier: "free", pro_expires_at: null, is_founder: false, founder_unit_code: null };

  it("returns the device's own state when the account adds nothing", () => {
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, row, now)).toBe(DEFAULT_ENTITLEMENT);
    const life = { ...DEFAULT_ENTITLEMENT, tier: "lifetime" as const };
    expect(mergeAccountEntitlement(life, { ...row, tier: "lifetime" }, now)).toBe(life);
  });

  it("brings down lifetime, later pro time and the founder pass", () => {
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, { ...row, tier: "lifetime" }, now)).toMatchObject({ tier: "lifetime", proExpiresAt: null });
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, { ...row, tier: "pro", pro_expires_at: "2027-01-01T00:00:00Z" }, now)).toMatchObject({
      tier: "pro",
      proExpiresAt: "2027-01-01T00:00:00Z",
    });
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, { ...row, is_founder: true, founder_unit_code: "FOUNDER // #0042" }, now)).toMatchObject({
      isFounder: true,
      founderUnitCode: "FOUNDER // #0042",
    });
  });

  it("ignores expired or shorter pro time", () => {
    const mine = { ...DEFAULT_ENTITLEMENT, tier: "pro" as const, proExpiresAt: "2027-06-01T00:00:00.000Z" };
    expect(mergeAccountEntitlement(mine, { ...row, tier: "pro", pro_expires_at: "2027-01-01T00:00:00Z" }, now)).toBe(mine);
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, { ...row, tier: "pro", pro_expires_at: "2026-01-01T00:00:00Z" }, now)).toBe(DEFAULT_ENTITLEMENT);
  });
});
