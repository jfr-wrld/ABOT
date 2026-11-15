/**
 * ABOT's own web visit counter (owner-approved 2026-11-15, web build only). Each page view calls
 * track_visit() in Supabase with the page and whether this browser is new today; the database keeps
 * only daily totals per page (supabase/migrations/20261116_admin_customers_visits.sql). "New today"
 * is a date this browser remembers about itself; nothing that identifies it is sent.
 */

type DayStore = Pick<Storage, "getItem" | "setItem">;
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<unknown>;

const KEY = "abot.visit-day";

export function jakartaDay(now: Date): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** True the first time this browser asks on a given day. Blocked storage counts as first. */
export function firstVisitToday(storage: DayStore | null, today: string): boolean {
  try {
    if (!storage || storage.getItem(KEY) === today) return !storage;
    storage.setItem(KEY, today);
    return true;
  } catch {
    return true;
  }
}

export async function reportVisit(pathname: string, rpc: Rpc, storage: DayStore | null, now = new Date()): Promise<void> {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
  try {
    await rpc("track_visit", { p_path: pathname, p_first_today: firstVisitToday(storage, jakartaDay(now)) });
  } catch {
    // A missed count is not worth bothering anyone about.
  }
}
