// ABOT // license: a signed-in lifter's licence as a signed token (supabase/functions/_shared/license.ts).
// The app verifies it offline with the public key built into it, so release builds open PRO only
// from what this function signed. Valid 30 days; the app asks again on every signed-in start.
//
// Secrets: LICENSE_PRIVATE_JWK (the private half from scripts/make-license-keys.mjs).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { licensePayload, signLicense } from "../_shared/license.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function respond(req: Request, status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": req.headers.get("access-control-request-headers") ?? "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

let privateKey: JsonWebKey | null | undefined;
function key(): JsonWebKey | null {
  if (privateKey === undefined) {
    try {
      privateKey = JSON.parse(Deno.env.get("LICENSE_PRIVATE_JWK") ?? "null") as JsonWebKey | null;
    } catch {
      privateKey = null;
    }
  }
  return privateKey;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return respond(req, 204, null);
  if (req.method !== "POST") return respond(req, 405, { error: "method" });
  const k = key();
  if (!k) return respond(req, 503, { error: "not_configured" });

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data } = await db.auth.getUser(jwt);
  const user = data?.user;
  if (!user) return respond(req, 401, { error: "sign_in" });

  const { data: row, error } = await db.from("user_entitlements").select("tier, pro_expires_at").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.error("entitlement read failed", error.message);
    return respond(req, 500, { error: "failed" });
  }
  const token = await signLicense(licensePayload(row, user.id, Date.now() / 1000), k);
  return respond(req, 200, { token });
});
