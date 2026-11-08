import type { Exercise, WorkoutSession } from "@/types/workout";
import { countSets, sessionDurationSec, sessionVolume } from "./calc";

const DAY = 86_400_000;

/** Local-midnight timestamp for the start of the week containing `t`. */
export function startOfWeek(t: number, firstDay: 0 | 1 = 1): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - firstDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface WeekBucket {
  weekStart: number;
  workouts: number;
  volumeKg: number;
  durationSec: number;
  sets: number;
}

/** The last `n` weeks ending with the current one, oldest first, zero-filled. */
export function weeklyBuckets(
  sessions: WorkoutSession[],
  n: number,
  now = Date.now(),
  firstDay: 0 | 1 = 1,
  byId?: Record<string, Exercise>,
): WeekBucket[] {
  const thisWeek = startOfWeek(now, firstDay);
  const buckets: WeekBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - i * 7);
    buckets.push({ weekStart: d.getTime(), workouts: 0, volumeKg: 0, durationSec: 0, sets: 0 });
  }
  const byStart = new Map(buckets.map((b) => [b.weekStart, b]));
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const b = byStart.get(startOfWeek(s.startedAt, firstDay));
    if (!b) continue;
    b.workouts++;
    b.volumeKg += sessionVolume(s, byId);
    b.durationSec += sessionDurationSec(s);
    b.sets += countSets(s).completed;
  }
  return buckets;
}

/**
 * Consecutive weeks (ending this week or last week) with at least one workout.
 * A streak is kept alive through the current week even if it has no workout yet.
 */
export function weekStreak(sessions: WorkoutSession[], now = Date.now(), firstDay: 0 | 1 = 1): number {
  const weeks = new Set(
    sessions.filter((s) => s.status === "completed").map((s) => startOfWeek(s.startedAt, firstDay)),
  );
  if (weeks.size === 0) return 0;
  let cursor = startOfWeek(now, firstDay);
  if (!weeks.has(cursor)) {
    const prev = new Date(cursor);
    prev.setDate(prev.getDate() - 7);
    cursor = prev.getTime();
    if (!weeks.has(cursor)) return 0;
  }
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    const prev = new Date(cursor);
    prev.setDate(prev.getDate() - 7);
    cursor = prev.getTime();
  }
  return streak;
}

/** Sessions grouped by local calendar day. */
export function sessionsByDay(sessions: WorkoutSession[]): Map<number, WorkoutSession[]> {
  const m = new Map<number, WorkoutSession[]>();
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const k = startOfDay(s.startedAt);
    m.set(k, [...(m.get(k) ?? []), s]);
  }
  return m;
}

export interface CalendarCell {
  date: number;
  inMonth: boolean;
  isToday: boolean;
}

/** 6 x 7 grid of days covering the month of `monthStart`. */
export function monthGrid(year: number, month: number, firstDay: 0 | 1 = 1, now = Date.now()): CalendarCell[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - firstDay + 7) % 7;
  const start = new Date(year, month, 1 - lead);
  const today = startOfDay(now);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: d.getTime(), inMonth: d.getMonth() === month, isToday: d.getTime() === today });
  }
  return cells;
}

export function daysAgo(t: number, now = Date.now()): number {
  return Math.floor((startOfDay(now) - startOfDay(t)) / DAY);
}
