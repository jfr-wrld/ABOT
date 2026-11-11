import { getSupabase } from "@/data/sync/client";
import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { getActivePersistence, getActiveRepository } from "@/store/persistence";
import { stopReminderLoop } from "@/lib/notifications/reminder-service";
import { DEFAULT_SCHEDULE } from "@/lib/notifications/schedule";
import { isNativeApp } from "@/lib/native/files";

/**
 * Delete my data (Settings > Data & backup). Two depths: this device only, or this device and
 * the ABOT account. The account goes through the delete-account Edge Function, which removes the
 * sign-in itself; every cloud row (workouts, settings, licence, payment orders) cascades with it.
 */

export type DeleteAccountFailure = "not_connected" | "sign_in" | "network" | "failed";

export const DELETE_ACCOUNT_MESSAGE: Record<DeleteAccountFailure, string> = {
  not_connected: "Cloud accounts are not set up in this version of ABOT.",
  sign_in: "Sign in again first, so ABOT knows the account is yours.",
  network: "Could not reach the server. Check the connection and try again. Nothing was deleted.",
  failed: "The account could not be deleted. Try again later. Nothing on this phone was deleted.",
};

/** Deletes the signed-in account on the server. The device is left as it was. */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; reason: DeleteAccountFailure }> {
  if (!isCloudSyncConfigured()) return { ok: false, reason: "not_connected" };
  try {
    const supabase = await getSupabase();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { ok: false, reason: "sign_in" };
    const { error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
    if (error) {
      const status = (error as { context?: Response }).context?.status;
      if (status === 401) return { ok: false, reason: "sign_in" };
      return { ok: false, reason: status ? "failed" : "network" };
    }
    // The session belongs to an account that no longer exists; drop it without a server call.
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/**
 * Deletes everything ABOT keeps on this device: the database (workouts, photos, settings, the
 * catalog), local preferences and the sign-in, and cancels scheduled reminders. Ends by
 * reloading into a fresh start.
 */
export async function wipeDevice(): Promise<void> {
  stopReminderLoop();
  if (isNativeApp()) {
    const notify = await import("@/lib/native/notify");
    await notify.syncNativeReminders({ ...DEFAULT_SCHEDULE, enabled: false }, () => null).catch(() => {});
    await notify.clearNativeLive().catch(() => {});
  }
  const persistence = getActivePersistence();
  await persistence?.flush().catch(() => {});
  persistence?.detach();
  await getActiveRepository()?.wipe();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Storage blocked: there is nothing in it to clear.
  }
  window.location.replace("/");
}
