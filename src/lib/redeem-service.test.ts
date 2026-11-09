import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ENTITLEMENT, applyGrant } from "./entitlements";
import { DEFAULT_REMOTE_CONFIG, normalizeRemoteConfig, useRemoteConfig } from "./remote-config";
import { generateCode, normalizeCode, redeemLicenseCode, sha256Hex, writeLocalCodes, readLocalCodes } from "./redeem-service";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  useRemoteConfig.setState({ config: DEFAULT_REMOTE_CONFIG, source: "default" });
});
afterEach(() => vi.unstubAllGlobals());

describe("codes", () => {
  it("normalizes what people type", () => {
    expect(normalizeCode("  abot vip  30d ")).toBe("ABOT-VIP-30D");
    expect(normalizeCode("abot--black_life")).toBe("ABOT-BLACK-LIFE");
  });

  it("generates ABOT-KIND-XXXX-XXXX-XXXX from an alphabet with no 0, O, 1 or I", () => {
    const code = generateCode("vip");
    expect(code).toMatch(/^ABOT-VIP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(generateCode("vip")).not.toBe(code);
  });

  it("hashes like the built-in table expects", async () => {
    expect(await sha256Hex("ABOT-BLACK-LIFE")).toBe("2a4ff8dc861586acbcbfd37782181b6112a3b2ae7e2d0f2b62f639ce1a6f3aa0");
  });
});

describe("redeemLicenseCode without Supabase", () => {
  it("built-in codes work offline", async () => {
    expect(await redeemLicenseCode("abot-black-life")).toMatchObject({ ok: true, source: "offline", grant: { tier: "lifetime", days: null } });
    expect(await redeemLicenseCode("ABOT VIP 30D")).toMatchObject({ ok: true, grant: { tier: "pro", days: 30 } });
    expect(await redeemLicenseCode("ABOT-FOUNDER-2026")).toMatchObject({ ok: true, grant: { founder: true } });
  });

  it("Mission Control can switch built-in codes off", async () => {
    useRemoteConfig.setState({ config: { ...DEFAULT_REMOTE_CONFIG, offlineCodesEnabled: false } });
    expect(await redeemLicenseCode("ABOT-BLACK-LIFE")).toMatchObject({ ok: false });
  });

  it("this device's own codes count their uses", async () => {
    writeLocalCodes([
      { code: "ABOT-VIP-AAAA-BBBB-CCCC", grant: { tier: "pro", days: 365, founder: false }, maxUses: 1, uses: 0, active: true, createdAt: "" },
    ]);
    expect(await redeemLicenseCode("abot-vip-aaaa-bbbb-cccc")).toMatchObject({ ok: true, source: "local", grant: { days: 365 } });
    expect(readLocalCodes()[0]!.uses).toBe(1);
    expect(await redeemLicenseCode("abot-vip-aaaa-bbbb-cccc")).toMatchObject({ ok: false });
  });

  it("refuses unknown and empty codes", async () => {
    expect(await redeemLicenseCode("ABOT-NOT-A-CODE")).toMatchObject({ ok: false, reason: "This code is not valid, or it has been used up." });
    expect(await redeemLicenseCode("  ")).toMatchObject({ ok: false, reason: "Enter a code." });
  });
});

describe("applyGrant", () => {
  const now = Date.parse("2026-11-09T00:00:00Z");
  it("pro adds days onto pro time not used yet; lifetime wins; founder stamps the pass", () => {
    const a = applyGrant(DEFAULT_ENTITLEMENT, { tier: "pro", days: 30, founder: false }, "s", now);
    expect(a).toMatchObject({ tier: "pro", proExpiresAt: "2026-12-09T00:00:00.000Z" });
    const b = applyGrant(a, { tier: "pro", days: 30, founder: false }, "s", now);
    expect(b.proExpiresAt).toBe("2027-01-08T00:00:00.000Z");
    const c = applyGrant(b, { tier: "lifetime", days: null, founder: true }, "s", now);
    expect(c).toMatchObject({ tier: "lifetime", proExpiresAt: null, isFounder: true });
    expect(applyGrant(c, { tier: "pro", days: 30, founder: false }, "s", now).tier).toBe("lifetime");
  });

  it("releases a simulator stuck on Free locked", () => {
    expect(applyGrant({ ...DEFAULT_ENTITLEMENT, devOverrideMode: "FORCE_FREE" }, { tier: "pro", days: 30, founder: false }, "s", now).devOverrideMode).toBe("AUTO");
  });
});

describe("remote config", () => {
  it("reads a Supabase row and ignores bad fields", () => {
    const c = normalizeRemoteConfig({
      monetization_mode: "COMMERCIAL_LIVE",
      monthly_price_idr: 35000,
      annual_price_idr: "249000",
      lifetime_price_idr: -1,
      announcement_banner: "  v1.2 is out  ",
      offline_codes_enabled: false,
    });
    expect(c).toMatchObject({ monetizationMode: "COMMERCIAL_LIVE", announcement: "v1.2 is out", offlineCodesEnabled: false });
    expect(c.prices).toMatchObject({ monthlyIdr: 35000, annualIdr: 249000, lifetimeIdr: 798000 });
    expect(normalizeRemoteConfig(null)).toEqual(DEFAULT_REMOTE_CONFIG);
  });

  it("a local override from Mission Control wins and can be cleared", () => {
    useRemoteConfig.getState().setLocalOverride({ ...DEFAULT_REMOTE_CONFIG, monetizationMode: "COMMERCIAL_LIVE" });
    expect(useRemoteConfig.getState()).toMatchObject({ source: "local", config: { monetizationMode: "COMMERCIAL_LIVE" } });
    useRemoteConfig.setState({ config: DEFAULT_REMOTE_CONFIG, source: "default" });
    useRemoteConfig.getState().load();
    expect(useRemoteConfig.getState().source).toBe("local");
    useRemoteConfig.getState().setLocalOverride(null);
    expect(useRemoteConfig.getState().config.monetizationMode).toBe("FOUNDERS_BETA");
  });
});
