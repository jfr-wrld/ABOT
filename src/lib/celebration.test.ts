import { describe, expect, it } from "vitest";
import { celebrationCase } from "./celebration";

const now = Date.parse("2026-11-10T12:00:00Z");
const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString();

describe("celebrationCase", () => {
  it("a first purchase unlocks pro or lifetime", () => {
    expect(celebrationCase({ tier: "free", proExpiresAt: null }, { tier: "pro", proExpiresAt: inDays(365) }, now)).toEqual({ kind: "new", tier: "pro", until: inDays(365) });
    expect(celebrationCase({ tier: "free", proExpiresAt: null }, { tier: "lifetime", proExpiresAt: null }, now)).toEqual({ kind: "new", tier: "lifetime" });
  });

  it("another year on running pro is an extension, with the old and new end and the days added", () => {
    expect(celebrationCase({ tier: "pro", proExpiresAt: inDays(200) }, { tier: "pro", proExpiresAt: inDays(565) }, now)).toEqual({
      kind: "extended",
      tier: "pro",
      from: inDays(200),
      until: inDays(565),
      days: 365,
    });
  });

  it("lifetime bought while pro runs is an upgrade", () => {
    expect(celebrationCase({ tier: "pro", proExpiresAt: inDays(30) }, { tier: "lifetime", proExpiresAt: null }, now)).toEqual({ kind: "upgraded", tier: "lifetime" });
  });

  it("pro that had already ended counts as a fresh unlock", () => {
    expect(celebrationCase({ tier: "pro", proExpiresAt: inDays(-5) }, { tier: "pro", proExpiresAt: inDays(365) }, now).kind).toBe("new");
    expect(celebrationCase({ tier: "pro", proExpiresAt: inDays(-5) }, { tier: "lifetime", proExpiresAt: null }, now).kind).toBe("new");
  });
});
