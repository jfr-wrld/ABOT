// ABOT // midtrans-notify: Midtrans' Payment Notification URL. Deploy with --no-verify-jwt (Midtrans
// sends no Supabase token); the request is trusted only after its SHA-512 signature checks out
// with the Server Key, and the status is then read again from Midtrans itself before anything is
// granted or taken away.
//
// Secrets: MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION (see midtrans-checkout).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { amountMatches, basicAuth, midtransSignature, outcomeOf, safeEqual, statusUrl } from "../_shared/midtrans.ts";

const SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
const PRODUCTION = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const reply = (status: number, text: string) => new Response(text, { status, headers: { "content-type": "text/plain" } });

interface Notice {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  transaction_id?: string;
  fraud_status?: string;
  payment_type?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, "method");
  if (!SERVER_KEY) return reply(503, "not configured");
  let n: Notice;
  try {
    n = await req.json();
  } catch {
    return reply(400, "bad json");
  }
  if (typeof n.order_id === "string" && !n.order_id.startsWith("ABOT-")) return reply(200, "not an ABOT order, ignored");
  if (!n.order_id || !n.status_code || !n.gross_amount || !n.signature_key) return reply(400, "missing fields");

  // Orders ABOT did not create (the dashboard's "Test notification URL" button, other apps on the
  // same merchant account) change nothing here, so they get 200 before the signature check and
  // Midtrans stops retrying. Only orders found in payment_orders go further.
  if (!/^ABOT-[A-Z]+-[A-Z0-9]+-[A-Z0-9]+$/.test(n.order_id)) return reply(200, "not an ABOT order, ignored");
  const { data: order } = await db.from("payment_orders").select("order_id, amount_idr, status").eq("order_id", n.order_id).maybeSingle();
  if (!order) return reply(200, "unknown order, ignored");

  const want = await midtransSignature(n.order_id, n.status_code, n.gross_amount, SERVER_KEY);
  if (!safeEqual(want, n.signature_key.toLowerCase())) return reply(401, "bad signature");

  // The notification says something changed; Midtrans' status API says what is true now.
  const res = await fetch(statusUrl(PRODUCTION, n.order_id), { headers: { accept: "application/json", authorization: basicAuth(SERVER_KEY) } }).catch(() => null);
  const s: Notice | null = res?.ok ? await res.json().catch(() => null) : null;
  // Midtrans retries on anything but 2xx, so a failed status read asks for another try.
  if (!s?.transaction_status) return reply(502, "status read failed");

  await db.from("payment_events").upsert(
    {
      order_id: n.order_id,
      transaction_status: s.transaction_status,
      transaction_id: s.transaction_id ?? "",
      fraud_status: s.fraud_status ?? null,
      gross_amount: s.gross_amount ?? null,
      payload: s,
    },
    { onConflict: "order_id,transaction_id,transaction_status", ignoreDuplicates: true },
  );

  const outcome = outcomeOf(s.transaction_status, s.fraud_status);
  if (outcome === "paid") {
    if (!amountMatches(s.gross_amount, order.amount_idr)) return reply(200, "amount mismatch, logged, not granted");
    const { error } = await db.rpc("abot_order_paid", { p_order_id: n.order_id, p_payment_type: s.payment_type ?? null, p_transaction_id: s.transaction_id ?? null });
    if (error) return reply(500, "grant failed");
  } else if (outcome === "reversed") {
    const { error } = await db.rpc("abot_order_reversed", { p_order_id: n.order_id });
    if (error) return reply(500, "revoke failed");
  } else if (outcome === "failed" || outcome === "expired") {
    await db.rpc("abot_order_closed", { p_order_id: n.order_id, p_status: outcome });
  }
  return reply(200, outcome);
});
