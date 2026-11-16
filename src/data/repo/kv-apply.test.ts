import { describe, expect, it } from "vitest";
import { kvApply } from "./types";

describe("kvApply settings", () => {
  const rec = (payload: unknown) => ({ kind: "settings" as const, id: "settings", payload, updatedAt: 1, deleted: false });

  it("never takes PRO from a synced settings row; this device's entitlement stays", () => {
    const local = { entitlement: { tier: "free", licenseSource: "device" }, weightUnit: "kg" };
    const remote = { weightUnit: "lbs", entitlement: { tier: "lifetime", licenseSource: "account" } };
    const { key, value } = kvApply(rec(remote) as never, { settings: local });
    expect(key).toBe("settings");
    expect(value).toEqual({ weightUnit: "lbs", entitlement: local.entitlement });
  });

  it("drops a remote entitlement when this device has none yet", () => {
    const { value } = kvApply(rec({ weightUnit: "lbs", entitlement: { tier: "lifetime" } }) as never, {});
    expect(value).toEqual({ weightUnit: "lbs" });
  });
});
