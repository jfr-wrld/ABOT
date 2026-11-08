/**
 * Sync status and errors in plain words, shared by Profile, Login and Settings so they never
 * disagree about whether the training is backed up.
 */

export type SyncTone = "ok" | "busy" | "pending" | "offline" | "error" | "never";
export type ErrorStage = "sign_in" | "sync";

export interface SyncStatusInput {
  phase: string;
  pendingCount: number;
  lastSyncedAt: number | null;
}

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;

export function ago(t: number, now: number): string {
  const s = Math.round((t - now) / 1000);
  if (Math.abs(s) < 45) return "just now";
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf?.format(m, "minute") ?? `${-m} min ago`;
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf?.format(h, "hour") ?? `${-h} h ago`;
  return rtf?.format(Math.round(h / 24), "day") ?? `${-Math.round(h / 24)} days ago`;
}

/** One line for a signed-in device. Only "ok" means everything on this phone is in the backup. */
export function syncStatus(s: SyncStatusInput, now: number): { tone: SyncTone; text: string } {
  if (s.phase === "error") return { tone: "error", text: "Last backup failed" };
  if (s.phase === "syncing") return { tone: "busy", text: "Backing up" };
  if (s.phase === "offline") return { tone: "offline", text: "Offline, will back up when back online" };
  if (s.pendingCount > 0)
    return { tone: "pending", text: `${s.pendingCount} ${s.pendingCount === 1 ? "change" : "changes"} waiting to back up` };
  if (s.lastSyncedAt) return { tone: "ok", text: `Backed up ${ago(s.lastSyncedAt, now)}` };
  return { tone: "never", text: "Not backed up yet" };
}

/**
 * What went wrong, for the lifter. The raw message (a Postgres or OAuth error) is kept for the
 * Details disclosure; it is no help on its own.
 */
export function friendlyError(stage: ErrorStage, raw: string): string {
  const m = raw.toLowerCase();
  if (stage === "sign_in") {
    if (/denied|cancel|access_denied/.test(m)) return "Google sign-in was cancelled. Nothing changed on this phone.";
    if (/fetch|network|offline/.test(m)) return "Couldn't reach Google. Check your connection and try again.";
    return "Google sign-in didn't finish. Your training is still on this phone; try again in a moment.";
  }
  if (/fetch|network|offline|timeout/.test(m)) return "Couldn't reach your backup. ABOT tries again when the connection is back.";
  if (/jwt|expired|refresh token|401|not authenticated/.test(m))
    return "Your sign-in has expired. Sign out and sign in again to keep backing up.";
  if (/does not exist|relation|function|schema|pgrst|404/.test(m))
    return "Your backup space isn't set up yet, so nothing was copied. Your training is safe on this phone.";
  return "This backup didn't go through. Your training is safe on this phone.";
}
