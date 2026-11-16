/**
 * The notifications page, built on the phone from what ABOT already knows: no server, nothing
 * sent. Only what no other screen says (owner, 2026-11-16): a planned workout that was missed,
 * the admin's announcement, a newer Android build, and backup or sync trouble. Today's plan,
 * records and the streak have their own places (Home, the summary, the week rail).
 * Titles are English keys with their values, translated where they are shown.
 */
import type { Routine, WorkoutSession } from "@/types/workout";
import { type WorkoutSchedule, type Weekday } from "@/lib/notifications/schedule";
import { historyEditPath } from "@/lib/routes";

export type InboxKind = "schedule" | "update" | "backup";

export interface InboxItem {
  /** Stable, so a seen item stays seen. */
  id: string;
  kind: InboxKind;
  at: number;
  title: string;
  params?: Record<string, string | number>;
  href?: string;
  /** Shown as written: the admin's announcement is not an English key. */
  plain?: true;
}

export interface InboxInput {
  now: number;
  sessions: WorkoutSession[];
  routines: Routine[];
  schedule: WorkoutSchedule;
  announcement: string | null;
  sync: { phase: string; pendingCount: number };
  /** A newer Android build than the one installed, as the update check last found it. */
  appUpdate?: { build: number; version: string; publishedAt: string | null } | null;
}

const DAY = 86_400_000;
const dayStart = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();
/** A short, stable id for a piece of text (an announcement). */
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7).toString(36);

export function buildInbox(x: InboxInput): InboxItem[] {
  const out: InboxItem[] = [];
  const done = x.sessions.filter((s) => s.status === "completed");
  const trainedOn = (day: number) => done.some((s) => s.startedAt >= day && s.startedAt < day + DAY);
  const name = (id: string | null) => (id && x.routines.find((r) => r.id === id)?.name) || "Free session";
  const today = dayStart(x.now);

  // Yesterday's planned session, if it did not happen: trained without the app, it can be logged.
  const yesterday = today - DAY;
  const yDay = x.schedule.days[new Date(yesterday).getDay() as Weekday];
  if (x.schedule.enabled && yDay?.on && !trainedOn(yesterday)) {
    out.push({ id: `missed:${yesterday}`, kind: "schedule", at: yesterday, title: "Missed yesterday: {name}", params: { name: name(yDay.routineId) }, href: historyEditPath(undefined, yesterday + 18 * 3_600_000) });
  }

  if (x.announcement) out.push({ id: `ann:${hash(x.announcement)}`, kind: "update", at: x.now, title: x.announcement, plain: true });
  if (x.appUpdate) {
    const published = x.appUpdate.publishedAt ? Date.parse(x.appUpdate.publishedAt) : NaN;
    out.push({
      id: `app-update:${x.appUpdate.build}`,
      kind: "update",
      at: Number.isFinite(published) ? Math.min(published, x.now) : x.now,
      title: "ABOT {version} is out. Tap to update.",
      params: { version: x.appUpdate.version },
      href: "/settings?section=about",
    });
  }

  // Backup: trouble with sync, or a growing log with no copy anywhere.
  if (x.sync.phase === "error") out.push({ id: `sync-error:${today}`, kind: "backup", at: x.now, title: "Backup failed. Tap to try again.", href: "/settings?section=data" });
  else if (x.sync.phase === "signed_out" && done.length >= 3) {
    const week = Math.floor(today / (7 * DAY));
    out.push({ id: `nobackup:${week}`, kind: "backup", at: today, title: "{n} workouts are not backed up", params: { n: done.length }, href: "/settings?section=data" });
  }

  return out.sort((a, b) => b.at - a.at);
}

/** Items not seen yet. */
export function unread(items: InboxItem[], seen: ReadonlySet<string>): number {
  return items.filter((i) => !seen.has(i.id)).length;
}
