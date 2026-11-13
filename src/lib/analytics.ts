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

/** Trained weeks that earn one rest week, and the most rest weeks held at once. */
export const REST_WEEK_EVERY = 4;

/**
 * Weeks in a row with at least one workout. The current week keeps the streak alive before
 * its workout. Every REST_WEEK_EVERY trained weeks earn one rest week (one held at a time): a
 * week off after that does not break the streak, it just does not add to it. Lifters take
 * planned weeks off, and a streak shown broken makes people quit (Silverman and Barasch 2023;
 * one missed week does not undo a habit, Lally et al. 2010).
 */
export function weekStreak(sessions: WorkoutSession[], now = Date.now(), firstDay: 0 | 1 = 1): number {
  return streakWeeks(sessions, now, firstDay).streak;
}

export function streakWeeks(
  sessions: WorkoutSession[],
  now = Date.now(),
  firstDay: 0 | 1 = 1,
): { streak: number; restWeeks: Set<number>; restReady: boolean } {
  const trained = new Set(sessions.filter((s) => s.status === "completed").map((s) => startOfWeek(s.startedAt, firstDay)));
  const restWeeks = new Set<number>();
  if (trained.size === 0) return { streak: 0, restWeeks, restReady: false };
  const current = startOfWeek(now, firstDay);
  // Trained weeks in order: after a break the walk jumps to the next one instead of stepping
  // through every empty week, so an old date cannot make this loop run for millions of weeks.
  const ordered = [...trained].sort((a, b) => a - b);
  let next = 0;
  const cursor = new Date(ordered[0]!);
  let streak = 0;
  let sinceCredit = 0;
  let credit = 0;
  let used: number[] = [];
  while (cursor.getTime() <= current) {
    const week = cursor.getTime();
    if (trained.has(week)) {
      streak++;
      if (++sinceCredit === REST_WEEK_EVERY) {
        credit = 1;
        sinceCredit = 0;
      }
    } else if (week !== current) {
      if (credit > 0 && streak > 0) {
        credit--;
        used.push(week);
      } else {
        streak = 0;
        sinceCredit = 0;
        credit = 0;
        used = [];
        while (next < ordered.length && ordered[next]! <= week) next++;
        if (next >= ordered.length || ordered[next]! > current) break;
        cursor.setTime(ordered[next]!);
        continue;
      }
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  for (const w of used) restWeeks.add(w);
  return { streak, restWeeks, restReady: credit > 0 };
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
