/**
 * The notifications page, built on the phone from what ABOT already knows: no server, nothing
 * sent. Four kinds (owner, 2026-11-15): the day's plan and a missed session, new records and the
 * weekly streak, the admin's announcement, and backup or sync trouble. Titles are English keys
 * with their values, translated where they are shown.
 */
import type { Exercise, Routine, WorkoutSession } from "@/types/workout";
import { nextSession, type WorkoutSchedule, type Weekday } from "@/lib/notifications/schedule";
import { prCounts } from "@/lib/home";
import { historyPath } from "@/lib/routes";

export type InboxKind = "schedule" | "record" | "update" | "backup";

export interface InboxItem {
  /** Stable, so a seen item stays seen. */
  id: string;
  kind: InboxKind;
  at: number;
  title: string;
  params?: Record<string, string | number>;
  href?: string;
}

export interface InboxInput {
  now: number;
  sessions: WorkoutSession[];
  routines: Routine[];
  byId: Record<string, Exercise>;
  schedule: WorkoutSchedule;
  /** Whole weeks in a row with a workout, as on Home. */
  streak: number;
  announcement: string | null;
  sync: { phase: string; pendingCount: number };
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

  // The day's plan, until it is trained.
  const next = nextSession(x.schedule, today - 1);
  if (next && next.at < today + DAY && !trainedOn(today)) {
    const at = new Date(next.at);
    out.push({
      id: `plan:${today}`,
      kind: "schedule",
      at: today,
      title: "Today: {name} at {time}",
      params: { name: name(next.routineId), time: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}` },
      href: "/",
    });
  }
  // Yesterday's planned session, if it did not happen.
  const yesterday = today - DAY;
  const yDay = x.schedule.days[new Date(yesterday).getDay() as Weekday];
  if (x.schedule.enabled && yDay?.on && !trainedOn(yesterday)) {
    out.push({ id: `missed:${yesterday}`, kind: "schedule", at: yesterday, title: "Missed yesterday: {name}", params: { name: name(yDay.routineId) }, href: "/workout" });
  }

  // New records from the last two weeks, one item per workout.
  const recent = done.filter((s) => s.startedAt > x.now - 14 * DAY);
  const prs = prCounts(recent, x.sessions, x.byId);
  for (const s of recent) {
    const n = prs[s.id] ?? 0;
    if (n > 0) out.push({ id: `pr:${s.id}`, kind: "record", at: s.finishedAt ?? s.startedAt, title: "{n} new records in {name}", params: { n, name: s.name }, href: historyPath(s.id) });
  }
  // The streak, once it is two weeks or more; a new item each week it grows.
  if (x.streak >= 2) {
    const last = done.reduce((m, s) => Math.max(m, s.startedAt), 0);
    out.push({ id: `streak:${x.streak}`, kind: "record", at: last, title: "{n}-week streak", params: { n: x.streak } });
  }

  if (x.announcement) out.push({ id: `ann:${hash(x.announcement)}`, kind: "update", at: x.now, title: x.announcement });

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
