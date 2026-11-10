/**
 * Midtrans rules shared by the midtrans-checkout and midtrans-notify Edge Functions. Plain
 * TypeScript with no imports, so the app's vitest suite can test it and Deno can run it.
 */

export type WebPlan = "annual" | "lifetime" | "founders";
export const WEB_PLANS: readonly WebPlan[] = ["annual", "lifetime", "founders"];

export function isWebPlan(v: unknown): v is WebPlan {
  return typeof v === "string" && (WEB_PLANS as readonly string[]).includes(v);
}

export const snapUrl = (production: boolean) =>
  production ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";

export const statusUrl = (production: boolean, orderId: string) =>
  `${production ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com"}/v2/${encodeURIComponent(orderId)}/status`;

/** HTTP Basic auth Midtrans expects: the server key as user name, empty password. */
export const basicAuth = (serverKey: string) => `Basic ${btoa(`${serverKey}:`)}`;

/** Prices as the remote config row stores them; founders pay half the lifetime price. */
export interface PriceRow {
  annual_price_idr: number;
  lifetime_price_idr: number;
}

export function priceIdr(plan: WebPlan, row: PriceRow): number {
  if (plan === "annual") return row.annual_price_idr;
  if (plan === "lifetime") return row.lifetime_price_idr;
  return Math.round(row.lifetime_price_idr / 2);
}

export const PLAN_LABEL: Record<WebPlan, string> = {
  annual: "ABOT BLACK PRO 1 year",
  lifetime: "ABOT BLACK PRO lifetime",
  founders: "ABOT BLACK PRO lifetime (founder)",
};

/** Cryptographic random in [0, 1): order ids are not guessable from Math.random's state. */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

/** ABOT-<PLAN>-<base36 time>-<8 random>, uppercase, under Midtrans' 50-character limit. */
export function makeOrderId(plan: WebPlan, now: number, random: () => number = secureRandom): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 8; i++) tail += alphabet[Math.floor(random() * alphabet.length)];
  return `ABOT-${plan.toUpperCase()}-${now.toString(36).toUpperCase()}-${tail}`;
}

/** SHA-512 hex of order_id + status_code + gross_amount + server key, as Midtrans signs a notification. */
export async function midtransSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string): Promise<string> {
  const data = new TextEncoder().encode(orderId + statusCode + grossAmount + serverKey);
  const digest = await crypto.subtle.digest("SHA-512", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares in time independent of where the strings first differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** "199000.00" against 199000. */
export function amountMatches(grossAmount: string | undefined, amountIdr: number): boolean {
  const n = Number(grossAmount);
  return Number.isFinite(n) && Math.round(n) === amountIdr;
}

export type Outcome = "paid" | "pending" | "failed" | "expired" | "reversed" | "ignore";

/**
 * What a Midtrans status means for the order. Card captures count only when the fraud check
 * accepted them; a challenged capture waits for the merchant's decision. A partial refund is
 * logged but changes nothing: only a full refund or chargeback takes the licence away.
 */
export function outcomeOf(transactionStatus: string, fraudStatus?: string | null): Outcome {
  switch (transactionStatus) {
    case "settlement":
      return "paid";
    case "capture":
      return fraudStatus === "accept" || !fraudStatus ? "paid" : "pending";
    case "pending":
    case "authorize":
      return "pending";
    case "deny":
    case "cancel":
    case "failure":
      return "failed";
    case "expire":
      return "expired";
    case "refund":
    case "chargeback":
      return "reversed";
    default:
      return "ignore";
  }
}

/** The CORS origin to echo back: one of the allowed list, else none. */
export function allowedOrigin(origin: string | null, allowed: string[]): string | null {
  if (!origin) return null;
  return allowed.includes(origin) ? origin : null;
}
