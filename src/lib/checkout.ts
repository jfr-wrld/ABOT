import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { getSupabase, maySignedIn } from "@/data/sync/client";
import { isNativeApp } from "@/lib/native/files";
import { useRemoteConfig } from "./remote-config";

/**
 * Buying PRO through Midtrans (QRIS, e-wallets, virtual accounts, cards). The app asks the
 * midtrans-checkout Edge Function for a payment page, opens it, and afterwards reads the order
 * back until Midtrans has settled it; the licence itself arrives through the account
 * (user_entitlements), like a redeemed code. This is ABOT's one deliberate network exception
 * besides cloud sync (CLAUDE.md).
 */

export type WebPlan = "annual" | "lifetime" | "founders";

export type CheckoutFailure =
  | "not_connected"
  | "sign_in"
  | "checkout_off"
  | "not_founder"
  | "seats_gone"
  | "already_lifetime"
  | "gateway"
  | "network";

export const CHECKOUT_MESSAGE: Record<CheckoutFailure, string> = {
  not_connected: "Payments are not set up in this version of ABOT yet.",
  sign_in: "Sign in first, so the purchase is saved to your account and restores on any phone.",
  checkout_off: "Payments are paused right now. Try again later.",
  not_founder: "The founder price is for founders only. Choose lifetime or annual.",
  seats_gone: "The founder seats are all taken. Lifetime and annual are still open.",
  already_lifetime: "You already hold a lifetime license.",
  gateway: "The payment page could not be opened. Try again in a moment.",
  network: "Could not reach the payment service. Check the connection and try again.",
};

/**
 * Why payments are not offered on this device, or null when they are: "not_connected" when the
 * build has no Supabase, "checkout_off" when Mission Control has the checkout (or Android) off.
 */
export function checkoutBlock(): "not_connected" | "checkout_off" | null {
  if (!isCloudSyncConfigured()) return "not_connected";
  const c = useRemoteConfig.getState().config;
  return c.checkoutEnabled && (!isNativeApp() || c.checkoutOnAndroid) ? null : "checkout_off";
}

/** Payments are offered on this device: set up, switched on, and allowed on this platform. */
export function checkoutAvailable(): boolean {
  return checkoutBlock() === null;
}

const PENDING_KEY = "abot.pending-order";

export function rememberPendingOrder(orderId: string | null): void {
  try {
    if (orderId) localStorage.setItem(PENDING_KEY, orderId);
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked: the return URL still carries the order id on the web.
  }
}

export function pendingOrder(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

/** Creates the order and opens Midtrans' payment page (same tab on the web, browser on Android). */
/** Fired when a payment page opened in another tab, so the app can wait for the order. */
export const CHECKOUT_OPENED = "abot:checkout-opened";

/**
 * On the web, open the tab for the payment page straight from the tap (browsers block pop-ups
 * opened later, after the network round trip). Null in the Android app, or when blocked.
 */
export function openPaymentTab(): Window | null {
  if (isNativeApp() || typeof window === "undefined") return null;
  try {
    const w = window.open("", "_blank");
    if (w) w.document.title = "ABOT · Payment";
    return w;
  } catch {
    return null;
  }
}

export async function startMidtransCheckout(
  plan: WebPlan,
  tab: Window | null = null,
): Promise<{ ok: true; orderId: string } | { ok: false; reason: CheckoutFailure; detail?: string }> {
  const result = await createCheckout(plan, tab);
  // A pre-opened tab with nothing to show is closed again.
  if (!result.ok) tab?.close();
  return result;
}

async function createCheckout(
  plan: WebPlan,
  tab: Window | null,
): Promise<{ ok: true; orderId: string } | { ok: false; reason: CheckoutFailure; detail?: string }> {
  const blocked = checkoutBlock();
  if (blocked) return { ok: false, reason: blocked };
  if (!maySignedIn()) return { ok: false, reason: "sign_in" };
  try {
    const supabase = await getSupabase();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { ok: false, reason: "sign_in" };
    const { data, error } = await supabase.functions.invoke("midtrans-checkout", {
      body: { plan, platform: isNativeApp() ? "android" : "web" },
    });
    if (error) {
      // FunctionsHttpError carries the function's response in `context`; FunctionsFetchError
      // (no response: blocked by CORS, offline, wrong function name) does not.
      const res = (error as { context?: Response }).context;
      const answer = res && typeof res.json === "function" ? await res.json().catch(() => null) : null;
      const code = answer?.error as CheckoutFailure | undefined;
      const detail = res?.status ? `HTTP ${res.status}${answer?.detail ? `, ${answer.detail}` : answer?.message ? `, ${answer.message}` : ""}` : (error as Error).name;
      return { ok: false, reason: code && code in CHECKOUT_MESSAGE ? code : "gateway", detail };
    }
    const url = (data as { redirect_url?: string; order_id?: string } | null)?.redirect_url;
    const orderId = (data as { order_id?: string } | null)?.order_id;
    if (!url || !orderId) return { ok: false, reason: "gateway" };
    rememberPendingOrder(orderId);
    if (isNativeApp()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      window.dispatchEvent(new CustomEvent(CHECKOUT_OPENED, { detail: orderId }));
    } else if (tab && !tab.closed) {
      // ABOT stays open (and signed in) here, waiting for the order; Midtrans runs in the other tab.
      tab.location.href = url;
      window.dispatchEvent(new CustomEvent(CHECKOUT_OPENED, { detail: orderId }));
    } else {
      // Pop-ups blocked: leave for the payment page and come back through the return URL.
      window.location.assign(url);
    }
    return { ok: true, orderId };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

/** The order as the account sees it (its own row through RLS); null when it cannot be read. */
export async function readOrderStatus(orderId: string): Promise<OrderStatus | null> {
  if (!isCloudSyncConfigured() || !maySignedIn()) return null;
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from("payment_orders").select("status").eq("order_id", orderId).maybeSingle();
    return (data?.status as OrderStatus | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads the order until Midtrans has settled it or `tries` run out. QRIS and e-wallets settle in
 * seconds; a bank transfer can take until the buyer pays, so pending is a normal answer.
 */
export async function waitForOrder(
  orderId: string,
  { tries = 10, everyMs = 3000, read = readOrderStatus, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {},
): Promise<OrderStatus | null> {
  let last: OrderStatus | null = null;
  for (let i = 0; i < tries; i++) {
    last = await read(orderId);
    if (last && last !== "pending") return last;
    if (i < tries - 1) await sleep(everyMs);
  }
  return last;
}

/** What the payment banner can say after a checkout. */
export type PaymentShown = OrderStatus | "checking" | "unknown";

export const PAYMENT_STATUS_MESSAGE: Record<PaymentShown, string> = {
  checking: "Checking your payment...",
  paid: "Payment received. ABOT // BLACK PRO is active on your account.",
  pending: "Waiting for your payment. Finish it in the payment app or bank; PRO turns on by itself once it settles.",
  failed: "The payment did not go through. Nothing was charged; you can try again.",
  expired: "The payment window closed before it was paid. You can start a new one.",
  refunded: "This payment was refunded, so its license was removed.",
  unknown: "Could not check the payment yet. Open ABOT again in a moment.",
};
