// ABOT // midtrans-checkout: a signed-in lifter asks to buy a plan; this creates the order and a
// Midtrans Snap payment page, and returns its URL. Prices come from app_remote_config, never from
// the app, so a modified client cannot pay less.
//
// Secrets (supabase secrets set ...):
//   MIDTRANS_SERVER_KEY      the Server Key from the Midtrans dashboard (Sandbox: SB-Mid-server-...)
//   MIDTRANS_IS_PRODUCTION   "true" for real money; anything else uses the Sandbox
//   ABOT_RETURN_URL          where Midtrans sends the buyer after paying, e.g. https://<site>/settings/
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { PLAN_LABEL, basicAuth, isWebPlan, makeOrderId, priceIdr, snapUrl } from "../_shared/midtrans.ts";

const SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
const PRODUCTION = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
const RETURN_URL = Deno.env.get("ABOT_RETURN_URL") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Any origin may call this: it is authorised by the user's bearer token, not by cookies, so a
// page on another site cannot act for the user. (An origin allowlist only broke real setups.)
function respond(req: Request, status: number, body: unknown): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    // Echo what the browser asks to send: supabase-js adds headers over time (x-region, ...).
    "access-control-allow-headers": req.headers.get("access-control-request-headers") ?? "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
  };
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

/** A refusal the app shows as is. `code` lets it pick a translated message; `detail` helps debugging. */
const refuse = (req: Request, status: number, code: string, detail?: string) => respond(req, status, { error: code, ...(detail ? { detail } : {}) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return respond(req, 204, null);
  if (req.method !== "POST") return refuse(req, 405, "method");
  if (!SERVER_KEY) return refuse(req, 503, "gateway", "MIDTRANS_SERVER_KEY secret is not set");

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return refuse(req, 401, "sign_in");

  let body: { plan?: unknown; platform?: unknown };
  try {
    body = await req.json();
  } catch {
    return refuse(req, 400, "bad_request");
  }
  if (!isWebPlan(body.plan)) return refuse(req, 400, "bad_plan");
  const plan = body.plan;
  const android = body.platform === "android";

  const { data: config } = await db
    .from("app_remote_config")
    .select("annual_price_idr, lifetime_price_idr, checkout_enabled, checkout_on_android")
    .eq("id", "global")
    .single();
  if (!config?.checkout_enabled || (android && !config.checkout_on_android)) return refuse(req, 403, "checkout_off");

  const { data: ent } = await db.from("user_entitlements").select("tier, is_founder").eq("user_id", user.id).maybeSingle();
  if (plan !== "annual" && ent?.tier === "lifetime") return refuse(req, 409, "already_lifetime");
  if (plan === "founders") {
    if (!ent?.is_founder) return refuse(req, 403, "not_founder");
    const { data: left } = await db.rpc("founder_seats_left");
    if (typeof left !== "number" || left <= 0) return refuse(req, 409, "seats_gone");
  }

  const amount = priceIdr(plan, config);
  const orderId = makeOrderId(plan, Date.now());
  const { error: insertError } = await db.from("payment_orders").insert({ order_id: orderId, user_id: user.id, plan, amount_idr: amount });
  if (insertError) {
    console.error("order insert failed", insertError.message);
    return refuse(req, 500, "gateway", `order insert: ${insertError.message.slice(0, 160)}`);
  }

  const snap = await fetch(snapUrl(PRODUCTION), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", authorization: basicAuth(SERVER_KEY) },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: plan, price: amount, quantity: 1, name: PLAN_LABEL[plan] }],
      customer_details: { email: user.email },
      ...(RETURN_URL ? { callbacks: { finish: RETURN_URL } } : {}),
    }),
  }).catch(() => null);
  const answer = snap ? await snap.json().catch(() => null) : null;
  if (!snap?.ok || !answer?.redirect_url) {
    await db.rpc("abot_order_closed", { p_order_id: orderId, p_status: "failed" });
    // Midtrans says why (wrong key, sandbox vs production, bad field); never the key itself.
    const why = snap ? `midtrans ${snap.status}: ${(answer?.error_messages ?? []).join("; ").slice(0, 200)}` : "midtrans unreachable";
    console.error("snap failed", why);
    return refuse(req, 502, "gateway", why);
  }
  return respond(req, 200, { order_id: orderId, redirect_url: answer.redirect_url, amount_idr: amount });
});
