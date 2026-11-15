/**
 * Mission Control's Customers tab: rows from admin_customers() and admin_order_totals()
 * (supabase/migrations/20261116_admin_customers_visits.sql), turned into what the table shows.
 */

export interface Customer {
  userId: string;
  email: string;
  tier: "free" | "pro" | "lifetime";
  proExpiresAt: string | null;
  isFounder: boolean;
  founderUnitCode: string | null;
  source: string | null;
  paidOrders: number;
  paidTotalIdr: number;
  lastPlan: string | null;
  lastStatus: string | null;
  lastAmountIdr: number | null;
  lastPaymentType: string | null;
  lastAt: string | null;
  founderSeat: number | null;
  overCap: boolean;
}

export interface OrderTotals {
  revenueIdr: number;
  paid: number;
  pending: number;
  failed: number;
  refunded: number;
}

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const int = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function parseCustomers(raw: unknown): Customer[] {
  return (Array.isArray(raw) ? raw : []).map((r) => {
    const x = r as Record<string, unknown>;
    const tier = x.tier === "pro" || x.tier === "lifetime" ? x.tier : "free";
    return {
      userId: String(x.user_id ?? ""),
      email: str(x.email) ?? "",
      tier,
      proExpiresAt: str(x.pro_expires_at),
      isFounder: x.is_founder === true,
      founderUnitCode: str(x.founder_unit_code),
      source: str(x.source),
      paidOrders: int(x.paid_orders) ?? 0,
      paidTotalIdr: int(x.paid_total_idr) ?? 0,
      lastPlan: str(x.last_plan),
      lastStatus: str(x.last_status),
      lastAmountIdr: int(x.last_amount_idr),
      lastPaymentType: str(x.last_payment_type),
      lastAt: str(x.last_at),
      founderSeat: int(x.founder_seat),
      overCap: x.over_cap === true,
    };
  });
}

export function parseTotals(raw: unknown): OrderTotals {
  const x = ((Array.isArray(raw) ? raw[0] : raw) ?? {}) as Record<string, unknown>;
  return { revenueIdr: int(x.revenue_idr) ?? 0, paid: int(x.paid) ?? 0, pending: int(x.pending) ?? 0, failed: int(x.failed) ?? 0, refunded: int(x.refunded) ?? 0 };
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function proStatus(c: Customer, now: number): { label: string; tone: "volt" | "amber" | undefined } {
  if (c.tier === "lifetime") return { label: "Lifetime", tone: "volt" };
  if (c.tier === "pro" && c.proExpiresAt) {
    return Date.parse(c.proExpiresAt) > now ? { label: `Active until ${shortDate(c.proExpiresAt)}`, tone: "volt" } : { label: `Expired ${shortDate(c.proExpiresAt)}`, tone: "amber" };
  }
  if (c.tier === "pro") return { label: "Pro", tone: "volt" };
  return { label: "Free", tone: undefined };
}

/** The stored source is the last grant written to the account, not its whole history. */
export function sourceLabel(source: string | null): string {
  if (!source) return "-";
  if (source.startsWith("midtrans-refund:")) return "Refunded";
  if (source.startsWith("midtrans:")) return "Midtrans";
  if (source.startsWith("code:")) return `Code ${source.slice(5)}`;
  if (source === "admin") return "Manual";
  if (source.startsWith("founders")) return "Founder claim";
  return source;
}

/** Supabase's answer when a migration has not been applied yet, turned into the fix. */
export function missingFunctionMessage(e: unknown, fn: string, file: string): string {
  const text = e instanceof Error ? e.message : String(e);
  return text.includes(fn) ? `${fn}() is missing: apply supabase/migrations/${file}.` : text;
}
