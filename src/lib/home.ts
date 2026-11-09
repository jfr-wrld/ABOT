/**
 * Everything the Home dashboard shows, as pure functions over the stores' data, so each figure
 * can be tested and none is invented: a week strip, the next routine, weekly volume and
 * frequency, muscle recovery, and the per-session tags on recent workouts.
 */
import type { Exercise, Routine, WorkoutSession } from "@/types/workout";
import type { WorkoutSchedule, Weekday } from "@/lib/notifications/schedule";
import { detectSessionPRs, sessionVolume } from "./calc";
import { startOfDay, startOfWeek } from "./analytics";
import type { T } from "@/i18n";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const completed = (sessions: WorkoutSession[]) => sessions.filter((s) => s.status === "completed");

/* ---------------------------------------------------------------- week strip */

export interface StripDay {
  start: number;
  trained: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/** The seven days of the current week, in the lifter's week order. */
export function weekStrip(sessions: WorkoutSession[], now: number, firstDay: 0 | 1 = 1): StripDay[] {
  const week = startOfWeek(now, firstDay);
  const today = startOfDay(now);
  const trainedDays = new Set(completed(sessions).map((s) => startOfDay(s.startedAt)));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week);
    d.setDate(d.getDate() + i);
    const start = d.getTime();
    return { start, trained: trainedDays.has(start), isToday: start === today, isFuture: start > today };
  });
}

/* ---------------------------------------------------------------- weekly figures */

export interface WeeklyVolume {
  kg: number;
  /** Change against last week up to the same moment, or null when last week had nothing. */
  changePct: number | null;
}

/** This week's volume so far, compared with last week at the same point, so Monday is not "-90%". */
export function weeklyVolume(
  sessions: WorkoutSession[],
  now: number,
  firstDay: 0 | 1 = 1,
  byId?: Record<string, Exercise>,
): WeeklyVolume {
  const week = startOfWeek(now, firstDay);
  const lastWeek = startOfWeek(week - DAY, firstDay);
  const elapsed = now - week;
  let kg = 0;
  let before = 0;
  for (const s of completed(sessions)) {
    if (s.startedAt >= week && s.startedAt <= now) kg += sessionVolume(s, byId);
    else if (s.startedAt >= lastWeek && s.startedAt <= lastWeek + elapsed) before += sessionVolume(s, byId);
  }
  return { kg, changePct: before > 0 ? Math.round(((kg - before) / before) * 100) : null };
}

export interface Frequency {
  done: number;
  /** Planned sessions this week from the schedule, or null when no schedule is set. */
  target: number | null;
  lastWeek: number;
}

export function weeklyFrequency(
  sessions: WorkoutSession[],
  schedule: WorkoutSchedule,
  now: number,
  firstDay: 0 | 1 = 1,
): Frequency {
  const week = startOfWeek(now, firstDay);
  const lastWeek = startOfWeek(week - DAY, firstDay);
  const done = new Set<number>();
  const prev = new Set<number>();
  for (const s of completed(sessions)) {
    if (s.startedAt >= week) done.add(startOfDay(s.startedAt));
    else if (s.startedAt >= lastWeek) prev.add(startOfDay(s.startedAt));
  }
  const planned = Object.values(schedule.days).filter((d) => d.on).length;
  return { done: done.size, target: schedule.enabled && planned > 0 ? planned : null, lastWeek: prev.size };
}

/* ---------------------------------------------------------------- next routine */

export interface NextProtocol {
  routine: Routine;
  /** Why this one: "Scheduled today", "Scheduled Thu", "After Pull Day", "Your routine". */
  reason: string;
}

const WEEKDAY_SHORT = (wd: Weekday) =>
  new Date(2026, 0, 4 + wd).toLocaleDateString(undefined, { weekday: "short" }); // 4 Jan 2026 was a Sunday

/**
 * The schedule wins when it names a routine; otherwise the routine after the last one trained,
 * in the order the Routines page lists them.
 */
export function nextProtocol(
  routines: Routine[],
  sessions: WorkoutSession[],
  schedule: WorkoutSchedule,
  now: number,
): NextProtocol | null {
  const startable = routines.filter((r) => r.exercises.length > 0);
  if (startable.length === 0) return null;
  const byId = new Map(startable.map((r) => [r.id, r]));

  if (schedule.enabled) {
    const trainedToday = completed(sessions).some((s) => startOfDay(s.startedAt) === startOfDay(now));
    for (let i = trainedToday ? 1 : 0; i < 7; i++) {
      const wd = new Date(now + i * DAY).getDay() as Weekday;
      const day = schedule.days[wd];
      if (!day?.on || !day.routineId) continue;
      const routine = byId.get(day.routineId);
      if (routine) return { routine, reason: i === 0 ? "Scheduled today" : i === 1 ? "Scheduled tomorrow" : `Scheduled ${WEEKDAY_SHORT(wd)}` };
    }
  }

  const last = [...completed(sessions)]
    .sort((a, b) => b.startedAt - a.startedAt)
    .find((s) => s.routineId && byId.has(s.routineId));
  if (last) {
    const i = startable.findIndex((r) => r.id === last.routineId);
    const routine = startable[(i + 1) % startable.length];
    return { routine, reason: routine.id === last.routineId ? "Your routine" : `After ${startable[i].name}` };
  }
  return { routine: startable[0], reason: "Your routine" };
}

/* ---------------------------------------------------------------- recent cards */

/**
 * Lifts that beat an earlier record in each session (one per lift, not one per record kind). A
 * lift done for the first time sets no record worth a badge: there was nothing to beat.
 */
export function prCounts(
  recent: WorkoutSession[],
  all: WorkoutSession[],
  byId?: Record<string, Exercise>,
): Record<string, number> {
  const done = completed(all);
  const out: Record<string, number> = {};
  for (const s of recent) {
    if (s.status !== "completed") continue;
    const before = new Set(
      done.filter((o) => o.id !== s.id && o.startedAt < s.startedAt).flatMap((o) => o.exercises.map((e) => e.exerciseId)),
    );
    out[s.id] = new Set(
      detectSessionPRs(s, all, byId)
        .map((p) => p.exerciseId)
        .filter((id) => before.has(id)),
    ).size;
  }
  return out;
}

/* ---------------------------------------------------------------- visual helpers */

/** Volume per day of the current week, in the lifter's week order (7 numbers, kg). */
export function weekDayVolumes(
  sessions: WorkoutSession[],
  now: number,
  firstDay: 0 | 1 = 1,
  byId?: Record<string, Exercise>,
): number[] {
  const days = weekStrip([], now, firstDay).map((d) => d.start);
  const out = days.map(() => 0);
  for (const s of completed(sessions)) {
    const i = days.indexOf(startOfDay(s.startedAt));
    if (i >= 0) out[i] += sessionVolume(s, byId);
  }
  return out;
}

/**
 * "Today", "Yesterday", a weekday within the week, else a short date. Pass `t` for the chosen
 * language; without it the words are English and dates follow the system locale.
 */
export function relativeDay(ts: number, now: number, t?: T): string {
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (days === 0) return t ? t("Today") : "Today";
  if (days === 1) return t ? t("Yesterday") : "Yesterday";
  if (days < 7) return new Date(ts).toLocaleDateString(t?.locale, { weekday: "short" });
  return new Date(ts).toLocaleDateString(t?.locale, { day: "numeric", month: "short" });
}

/**
 * A muscle's display name in the chosen language. "Back" the muscle and "Back" the navigation
 * link are different words in Indonesian, so the muscle goes through its own key.
 */
export function muscleText(label: string, t: T): string {
  if (t.lang === "en") return label;
  return label === "Back" ? t("Back (muscle)") : t(label);
}
