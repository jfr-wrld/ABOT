// ABOT // delete-account: a signed-in lifter deletes their ABOT account. Removing the auth user
// removes everything tied to it, since every table that holds their rows references auth.users
// with ON DELETE CASCADE: cloud workouts and settings (abot_records), the licence
// (user_entitlements), redeemed codes, redeem attempts and payment orders. Midtrans' own
// notifications (payment_events) carry no user id and stay as the payment record.
//
// Only the account's own token can ask, and only for itself. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function respond(req: Request, status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": req.headers.get("access-control-request-headers") ?? "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return respond(req, 204, null);
  if (req.method !== "POST") return respond(req, 405, { error: "method" });

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data } = await db.auth.getUser(jwt);
  const user = data?.user;
  if (!user) return respond(req, 401, { error: "sign_in" });

  // The app sends this so a stray or replayed call cannot delete an account by accident.
  let body: { confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return respond(req, 400, { error: "bad_request" });
  }
  if (body.confirm !== "DELETE") return respond(req, 400, { error: "bad_request" });

  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("delete failed", error.message);
    return respond(req, 500, { error: "failed" });
  }
  return respond(req, 200, { deleted: true });
});
