import { describe, expect, it } from "vitest";
import { missingFunctionMessage, parseCustomers, parseTotals, proStatus, sourceLabel, type Customer } from "./customers";

const row = {
  user_id: "u1", email: "sari@example.com", tier: "pro", pro_expires_at: "2027-11-13T02:40:00Z", is_founder: false,
  founder_unit_code: null, source: "midtrans:ABOT-ANNUAL-X-1", paid_orders: "1", paid_total_idr: "249000",
  last_plan: "annual", last_status: "paid", last_amount_idr: 249000, last_payment_type: "gopay",
  last_at: "2026-11-13T02:40:00Z", founder_seat: null, over_cap: false,
};
const now = Date.parse("2026-11-15T00:00:00Z");
const base = parseCustomers([row])[0]!;
const as = (patch: Partial<Customer>): Customer => ({ ...base, ...patch });

describe("customers", () => {
  it("reads bigint strings and nulls", () => {
    expect(base).toMatchObject({ email: "sari@example.com", paidOrders: 1, paidTotalIdr: 249000, lastPaymentType: "gopay", founderSeat: null, overCap: false });
    expect(parseCustomers(null)).toEqual([]);
    expect(parseCustomers([{ user_id: "u2" }])[0]).toMatchObject({ email: "", tier: "free", paidOrders: 0 });
  });

  it("totals", () => {
    expect(parseTotals([{ revenue_idr: "648000", paid: "2", pending: "1", failed: "3", refunded: "0" }])).toEqual({ revenueIdr: 648000, paid: 2, pending: 1, failed: 3, refunded: 0 });
    expect(parseTotals(undefined)).toEqual({ revenueIdr: 0, paid: 0, pending: 0, failed: 0, refunded: 0 });
  });

  it("PRO status", () => {
    expect(proStatus(as({ tier: "lifetime" }), now)).toEqual({ label: "Lifetime", tone: "volt" });
    expect(proStatus(base, now)).toEqual({ label: "Active until 13 Nov 2027", tone: "volt" });
    expect(proStatus(as({ proExpiresAt: "2026-11-01T00:00:00Z" }), now)).toEqual({ label: "Expired 1 Nov 2026", tone: "amber" });
    expect(proStatus(as({ tier: "free", proExpiresAt: null }), now)).toEqual({ label: "Free", tone: undefined });
  });

  it("source labels", () => {
    expect(sourceLabel("midtrans:ABOT-X")).toBe("Midtrans");
    expect(sourceLabel("midtrans-refund:ABOT-X")).toBe("Refunded");
    expect(sourceLabel("code:INFLU-RINA")).toBe("Code INFLU-RINA");
    expect(sourceLabel("admin")).toBe("Manual");
    expect(sourceLabel("founders-beta")).toBe("Founder claim");
    expect(sourceLabel(null)).toBe("-");
  });

  it("explains a missing migration", () => {
    const e = new Error("Could not find the function public.admin_customers without parameters in the schema cache");
    expect(missingFunctionMessage(e, "admin_customers", "20261116_admin_customers_visits.sql")).toBe("admin_customers() is missing: apply supabase/migrations/20261116_admin_customers_visits.sql.");
    expect(missingFunctionMessage(new Error("admins only"), "admin_customers", "x.sql")).toBe("admins only");
  });
});
