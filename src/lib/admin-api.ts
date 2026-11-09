import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { getSupabase, maySignedIn } from "@/data/sync/client";
import { normalizeRemoteConfig, useRemoteConfig, type RemoteConfig } from "./remote-config";
import { readLocalCodes, writeLocalCodes, type Grant, type LocalCode } from "./redeem-service";

/**
 * Mission Control's data, from Supabase when the build has it (every write is checked by row
 * level security against app_admins, see supabase/migrations/20261109_admin_and_redeem.sql), or
 * from this device when it does not ("local mode": a preview that changes nothing for others).
 */

export type AdminMode = { kind: "local" } | { kind: "server"; email: string | null; admin: boolean };

export async function adminMode(): Promise<AdminMode> {
  if (!isCloudSyncConfigured()) return { kind: "local" };
  if (!maySignedIn()) return { kind: "server", email: null, admin: false };
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email ?? null;
    if (!email) return { kind: "server", email: null, admin: false };
    const { data: admin } = await supabase.rpc("is_abot_admin");
    return { kind: "server", email, admin: admin === true };
  } catch {
    return { kind: "server", email: null, admin: false };
  }
}

export interface AdminCode extends LocalCode {
  note?: string | null;
}

export interface AdminStats {
  totalUsers: number | null;
  founders: number | null;
  activePro: number | null;
  activeCodes: number;
}

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export async function saveConfig(mode: AdminMode, c: RemoteConfig): Promise<void> {
  if (mode.kind === "local") {
    useRemoteConfig.getState().setLocalOverride(c);
    return;
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("app_remote_config")
    .update({
      monetization_mode: c.monetizationMode,
      monthly_price_idr: c.prices.monthlyIdr,
      annual_price_idr: c.prices.annualIdr,
      lifetime_price_idr: c.prices.lifetimeIdr,
      monthly_price_usd: c.prices.monthlyUsd,
      annual_price_usd: c.prices.annualUsd,
      lifetime_price_usd: c.prices.lifetimeUsd,
      announcement_banner: c.announcement,
      offline_codes_enabled: c.offlineCodesEnabled,
      checkout_enabled: c.checkoutEnabled,
      checkout_on_android: c.checkoutOnAndroid,
      tunables: c.tunables,
    })
    .eq("id", "global")
    .select()
    .maybeSingle();
  fail(error);
  // RLS turns a non-admin update into "no rows", not an error.
  if (!data) throw new Error("Not saved: this account is not an admin");
  useRemoteConfig.getState().setServer(normalizeRemoteConfig(data));
}

export async function listCodes(mode: AdminMode): Promise<AdminCode[]> {
  if (mode.kind === "local") return readLocalCodes();
  const { data, error } = await (await getSupabase()).from("redeem_codes").select("*").order("created_at", { ascending: false }).limit(200);
  fail(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    code: String(r.code),
    grant: { tier: r.grant_tier === "lifetime" ? "lifetime" : "pro", days: (r.duration_days as number | null) ?? null, founder: r.grants_founder_badge === true },
    maxUses: Number(r.max_uses),
    uses: Number(r.current_uses),
    active: r.is_active === true,
    createdAt: String(r.created_at),
    note: (r.note as string | null) ?? null,
  }));
}

export async function createCode(mode: AdminMode, code: string, grant: Grant, maxUses: number, note: string | null): Promise<void> {
  if (mode.kind === "local") {
    const all = readLocalCodes();
    if (all.some((c) => c.code === code)) throw new Error("This code already exists");
    writeLocalCodes([{ code, grant, maxUses, uses: 0, active: true, createdAt: new Date().toISOString() }, ...all]);
    return;
  }
  const { error } = await (await getSupabase()).from("redeem_codes").insert({
    code,
    grant_tier: grant.tier,
    duration_days: grant.tier === "lifetime" ? null : grant.days,
    grants_founder_badge: grant.founder,
    max_uses: maxUses,
    note,
  });
  fail(error);
}

export async function setCodeActive(mode: AdminMode, code: string, active: boolean): Promise<void> {
  if (mode.kind === "local") {
    writeLocalCodes(readLocalCodes().map((c) => (c.code === code ? { ...c, active } : c)));
    return;
  }
  const { error } = await (await getSupabase()).from("redeem_codes").update({ is_active: active }).eq("code", code);
  fail(error);
}

export async function stats(mode: AdminMode, codes: AdminCode[]): Promise<AdminStats> {
  const activeCodes = codes.filter((c) => c.active && c.uses < c.maxUses).length;
  if (mode.kind === "local") return { totalUsers: null, founders: null, activePro: null, activeCodes };
  const { data, error } = await (await getSupabase()).rpc("admin_stats");
  fail(error);
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
  return { totalUsers: Number(r?.total_users ?? 0), founders: Number(r?.founders ?? 0), activePro: Number(r?.active_pro ?? 0), activeCodes };
}

/** Manual upgrade by email. False: no ABOT account with that email (they sign in once first). */
export async function grantByEmail(email: string, tier: "pro" | "lifetime", days: number | null): Promise<boolean> {
  const { data, error } = await (await getSupabase()).rpc("admin_grant", { p_email: email, p_tier: tier, p_days: tier === "pro" ? days : null });
  fail(error);
  return data === true;
}

/* --------------------------------------------------------------- payments */

export interface AdminOrder {
  orderId: string;
  plan: string;
  amountIdr: number;
  status: string;
  paymentType: string | null;
  createdAt: string;
}

/** The latest Midtrans orders (admins read every row through RLS). */
export async function listOrders(): Promise<AdminOrder[]> {
  const { data, error } = await (await getSupabase())
    .from("payment_orders")
    .select("order_id, plan, amount_idr, status, payment_type, created_at")
    .order("created_at", { ascending: false })
    .limit(15);
  fail(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    orderId: String(r.order_id),
    plan: String(r.plan),
    amountIdr: Number(r.amount_idr),
    status: String(r.status),
    paymentType: (r.payment_type as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

export type SimulatedOutcome = "paid" | "failed" | "expired" | "refunded";

/**
 * Settles, fails, expires or refunds an order as if Midtrans had said so (admin_simulate_payment).
 * Works only while payments_sandbox is on. False: the order was already in a state that ignores it.
 */
export async function simulateOrder(orderId: string, outcome: SimulatedOutcome): Promise<boolean> {
  const { data, error } = await (await getSupabase()).rpc("admin_simulate_payment", { p_order_id: orderId, p_outcome: outcome });
  fail(error);
  return data === true;
}
