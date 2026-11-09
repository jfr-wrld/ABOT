import { describe, expect, it } from "vitest";
import { DEFAULT_ENTITLEMENT, applyGrant, type EntitlementState } from "./entitlements";
import { mergeAccountEntitlement, type AccountEntitlement } from "./entitlement-sync";

const now = Date.parse("2026-11-09T12:00:00Z");
const day = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const row = (tier: string, endsInDays: number | null = null, founder = false): AccountEntitlement => ({
  tier,
  pro_expires_at: endsInDays === null ? null : iso(now + endsInDays * day),
  is_founder: founder,
  founder_unit_code: founder ? "FOUNDER // #0421" : null,
});
const accountPro = (days: number): EntitlementState => ({ ...DEFAULT_ENTITLEMENT, tier: "pro", proExpiresAt: iso(now + days * day), licenseSource: "account" });

describe("mergeAccountEntitlement", () => {
  it("restores the account's licence onto a free phone and marks it as the account's", () => {
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, row("lifetime"), now)).toMatchObject({ tier: "lifetime", proExpiresAt: null, licenseSource: "account" });
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, row("pro", 30), now)).toMatchObject({ tier: "pro", licenseSource: "account" });
  });

  it("a refund or revocation on the account removes a licence that came from it", () => {
    expect(mergeAccountEntitlement(accountPro(300), row("free"), now)).toMatchObject({ tier: "free", proExpiresAt: null, licenseSource: null });
    expect(mergeAccountEntitlement(accountPro(300), null, now)).toMatchObject({ tier: "free", licenseSource: null });
    const lifetime: EntitlementState = { ...DEFAULT_ENTITLEMENT, tier: "lifetime", licenseSource: "account" };
    expect(mergeAccountEntitlement(lifetime, row("pro", 10), now)).toMatchObject({ tier: "pro", proExpiresAt: iso(now + 10 * day) });
  });

  it("a shorter end date on the account shortens an account licence; an expired one ends it", () => {
    expect(mergeAccountEntitlement(accountPro(300), row("pro", 20), now).proExpiresAt).toBe(iso(now + 20 * day));
    expect(mergeAccountEntitlement(accountPro(300), row("pro", -1), now).tier).toBe("free");
  });

  it("never takes away a licence held on this device only, or one from before the field existed", () => {
    const device = applyGrant(DEFAULT_ENTITLEMENT, { tier: "pro", days: 30, founder: false }, "seed", now, "device");
    expect(device.licenseSource).toBe("device");
    expect(mergeAccountEntitlement(device, null, now)).toBe(device);
    expect(mergeAccountEntitlement(device, row("free"), now)).toBe(device);
    const legacy = { ...DEFAULT_ENTITLEMENT, tier: "lifetime" as const, licenseSource: undefined } as unknown as EntitlementState;
    expect(mergeAccountEntitlement(legacy, null, now)).toBe(legacy);
  });

  it("the account can still raise a device licence, which then becomes the account's", () => {
    const device = applyGrant(DEFAULT_ENTITLEMENT, { tier: "pro", days: 30, founder: false }, "seed", now, "device");
    expect(mergeAccountEntitlement(device, row("pro", 90), now)).toMatchObject({ proExpiresAt: iso(now + 90 * day), licenseSource: "account" });
    expect(mergeAccountEntitlement(device, row("pro", 10), now)).toBe(device);
  });

  it("returns the same object when nothing changes, and never removes a founder pass", () => {
    const local = accountPro(30);
    expect(mergeAccountEntitlement(local, row("pro", 30), now)).toBe(local);
    const founder = { ...accountPro(30), isFounder: true, founderUnitCode: "FOUNDER // #0001" };
    expect(mergeAccountEntitlement(founder, null, now)).toMatchObject({ tier: "free", isFounder: true, founderUnitCode: "FOUNDER // #0001" });
    expect(mergeAccountEntitlement(DEFAULT_ENTITLEMENT, row("free", null, true), now)).toMatchObject({ isFounder: true, founderUnitCode: "FOUNDER // #0421" });
  });

  it("a device code added on top of an account licence makes it device-held", () => {
    const mixed = applyGrant(accountPro(30), { tier: "pro", days: 30, founder: false }, "seed", now, "device");
    expect(mixed.licenseSource).toBe("device");
    expect(mergeAccountEntitlement(mixed, null, now)).toBe(mixed);
  });
});
