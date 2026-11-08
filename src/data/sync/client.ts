import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ENV, isCloudSyncConfigured } from "./supabase";

let client: Promise<SupabaseClient> | null = null;

/**
 * The supabase-js client, loaded on first use only. A guest who never signs in never downloads
 * it and never contacts Supabase.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!isCloudSyncConfigured()) return Promise.reject(new Error("Cloud sync is not set up for this build"));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_ENV.url!, SUPABASE_ENV.anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    }),
  );
  return client;
}

/** supabase-js keeps the session under "sb-<project ref>-auth-token". */
function storageKey(): string | null {
  try {
    return `sb-${new URL(SUPABASE_ENV.url!).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * Whether this device may already be signed in, or is coming back from Google: only then is the
 * client loaded at start. Reading localStorage needs no network.
 */
export function maySignedIn(): boolean {
  if (!isCloudSyncConfigured()) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("error_description")) return true;
    const k = storageKey();
    return Boolean(k && window.localStorage.getItem(k));
  } catch {
    return false;
  }
}

/** Removes the OAuth code (or error) from the address bar once it has been used. */
export function cleanAuthParams(): string | null {
  const url = new URL(window.location.href);
  const error = url.searchParams.get("error_description");
  let changed = false;
  for (const p of ["code", "error", "error_code", "error_description", "state"]) {
    if (url.searchParams.has(p)) {
      url.searchParams.delete(p);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return error;
}
