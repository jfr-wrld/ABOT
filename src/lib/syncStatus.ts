/**
 * Sync status and errors in plain words, shared by Profile, Login and Settings so they never
 * disagree about whether the training is backed up. Texts are English keys run through `t`;
 * without one they stay English.
 */

import { makeT, type T } from "@/i18n";

export type SyncTone = "ok" | "busy" | "pending" | "offline" | "error" | "never";
export type ErrorStage = "sign_in" | "sync";

export interface SyncStatusInput {
  phase: string;
  pendingCount: number;
  lastSyncedAt: number | null;
}

const EN = makeT("en");

export function ago(at: number, now: number, t: T = EN): string {
  const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(t.locale, { numeric: "auto" }) : null;
  const s = Math.round((at - now) / 1000);
  if (Math.abs(s) < 45) return t("just now");
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf?.format(m, "minute") ?? t("{n} min ago", { n: -m });
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf?.format(h, "hour") ?? t("{n} h ago", { n: -h });
  const d = Math.round(h / 24);
  return rtf?.format(d, "day") ?? t("{n} days ago", { n: -d });
}

/** One line for a signed-in device. Only "ok" means everything on this phone is in the backup. */
export function syncStatus(s: SyncStatusInput, now: number, t: T = EN): { tone: SyncTone; text: string } {
  if (s.phase === "error") return { tone: "error", text: t("Last backup failed") };
  if (s.phase === "syncing") return { tone: "busy", text: t("Backing up") };
  if (s.phase === "offline") return { tone: "offline", text: t("Offline, will back up when back online") };
  if (s.pendingCount > 0)
    return { tone: "pending", text: t.n(s.pendingCount, "{n} change waiting to back up", "{n} changes waiting to back up") };
  if (s.lastSyncedAt) return { tone: "ok", text: t("Backed up {when}", { when: ago(s.lastSyncedAt, now, t) }) };
  return { tone: "never", text: t("Not backed up yet") };
}

/**
 * What went wrong, for the lifter. The raw message (a Postgres or OAuth error) is kept for the
 * Details disclosure; it is no help on its own.
 */
export function friendlyError(stage: ErrorStage, raw: string, t: T = EN): string {
  const m = raw.toLowerCase();
  if (stage === "sign_in") {
    if (/denied|cancel|access_denied/.test(m)) return t("Google sign-in was cancelled. Nothing changed on this phone.");
    if (/fetch|network|offline/.test(m)) return t("Couldn't reach Google. Check your connection and try again.");
    return t("Google sign-in didn't finish. Your training is still on this phone; try again in a moment.");
  }
  if (/fetch|network|offline|timeout/.test(m)) return t("Couldn't reach your backup. ABOT tries again when the connection is back.");
  if (/jwt|expired|refresh token|401|not authenticated/.test(m))
    return t("Your sign-in has expired. Sign out and sign in again to keep backing up.");
  if (/does not exist|relation|function|schema|pgrst|404/.test(m))
    return t("Your backup space isn't set up yet, so nothing was copied. Your training is safe on this phone.");
  return t("This backup didn't go through. Your training is safe on this phone.");
}
