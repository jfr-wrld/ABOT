import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allowedOrigin, amountMatches, isWebPlan, makeOrderId, midtransSignature, outcomeOf, priceIdr, safeEqual, statusUrl } from "./midtrans";

describe("midtrans rules", () => {
  it("signs a notification as SHA-512 of order + status code + amount + server key", async () => {
    const want = createHash("sha512").update("ABOT-ANNUAL-X-Y" + "200" + "199000.00" + "SB-Mid-server-test").digest("hex");
    expect(await midtransSignature("ABOT-ANNUAL-X-Y", "200", "199000.00", "SB-Mid-server-test")).toBe(want);
    expect(safeEqual(want, want)).toBe(true);
    expect(safeEqual(want, want.replace(/.$/, "0"))).toBe(want.endsWith("0"));
    expect(safeEqual("ab", "abc")).toBe(false);
  });

  it("prices plans from the config row; founders pay half of lifetime", () => {
    const row = { annual_price_idr: 199000, lifetime_price_idr: 798000 };
    expect([priceIdr("annual", row), priceIdr("lifetime", row), priceIdr("founders", row)]).toEqual([199000, 798000, 399000]);
    expect(isWebPlan("founders")).toBe(true);
    expect(isWebPlan("monthly")).toBe(false);
  });

  it("makes order ids the migration's check accepts, under 50 characters", () => {
    const id = makeOrderId("founders", Date.UTC(2026, 10, 11), () => 0.5);
    expect(id).toMatch(/^ABOT-[A-Z]+-[A-Z0-9]+-[A-Z0-9]+$/);
    expect(id.length).toBeLessThanOrEqual(50);
    expect(id.startsWith("ABOT-FOUNDERS-")).toBe(true);
  });

  it("reads Midtrans statuses: only settled or accepted captures pay, full refunds and chargebacks reverse", () => {
    expect(outcomeOf("settlement")).toBe("paid");
    expect(outcomeOf("capture", "accept")).toBe("paid");
    expect(outcomeOf("capture", "challenge")).toBe("pending");
    expect(outcomeOf("pending")).toBe("pending");
    expect(outcomeOf("deny")).toBe("failed");
    expect(outcomeOf("cancel")).toBe("failed");
    expect(outcomeOf("expire")).toBe("expired");
    expect(outcomeOf("refund")).toBe("reversed");
    expect(outcomeOf("chargeback")).toBe("reversed");
    expect(outcomeOf("partial_refund")).toBe("ignore");
  });

  it("matches amounts as Midtrans writes them and picks the right host", () => {
    expect(amountMatches("199000.00", 199000)).toBe(true);
    expect(amountMatches("1000.00", 199000)).toBe(false);
    expect(amountMatches(undefined, 199000)).toBe(false);
    expect(statusUrl(false, "ABOT-A-B-C")).toBe("https://api.sandbox.midtrans.com/v2/ABOT-A-B-C/status");
    expect(statusUrl(true, "ABOT-A-B-C")).toBe("https://api.midtrans.com/v2/ABOT-A-B-C/status");
  });

  it("echoes only allowed origins", () => {
    expect(allowedOrigin("https://abot.app", ["https://abot.app"])).toBe("https://abot.app");
    expect(allowedOrigin("https://evil.example", ["https://abot.app"])).toBeNull();
    expect(allowedOrigin(null, ["https://abot.app"])).toBeNull();
  });
});
