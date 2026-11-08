import type { Exercise, WorkoutSession } from "@/types/workout";
import { buildPRTable, countSets, exerciseHistory, sessionDurationSec, sessionVolume } from "./calc";
import { startOfWeek } from "./analytics";

export interface PeriodTotals {
  workouts: number;
  volumeKg: number;
  durationSec: number;
  sets: number;
}

/** First instant of the range that ends with the current week and spans `weeks` weeks. */
export function rangeStart(weeks: number, now: number, firstDay: 0 | 1): number {
  const d = new Date(startOfWeek(now, firstDay));
  d.setDate(d.getDate() - (weeks - 1) * 7);
  return d.getTime();
}

/** Totals of finished workouts that started in [from, to). */
export function periodTotals(
  sessions: WorkoutSession[],
  from: number,
  to: number,
  byId?: Record<string, Exercise>,
): PeriodTotals {
  const out: PeriodTotals = { workouts: 0, volumeKg: 0, durationSec: 0, sets: 0 };
  for (const s of sessions) {
    if (s.status !== "completed" || s.startedAt < from || s.startedAt >= to) continue;
    out.workouts++;
    out.volumeKg += sessionVolume(s, byId);
    out.durationSec += sessionDurationSec(s);
    out.sets += countSets(s).completed;
  }
  return out;
}

/**
 * Change against the previous period as a whole percent. Null when there is nothing to compare
 * with, so the UI says "first period on record" instead of an invented +100%.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface LiftTrend {
  exerciseId: string;
  name: string;
  /** Estimated 1RM per workout in the range, oldest first. */
  points: { date: number; e1rmKg: number }[];
  /** Records set in the range that still stand today. */
  records: number;
}

/**
 * The lifts trained in the most workouts of the range (ties: higher latest 1RM), each with its
 * estimated 1RM line. Bodyweight-only lifts have no line and are left out.
 */
export function liftTrends(
  sessions: WorkoutSession[],
  from: number,
  to: number,
  byId: Record<string, Exercise>,
  limit = 3,
): LiftTrend[] {
  const done = sessions.filter((s) => s.status === "completed");
  const inRange = done.filter((s) => s.startedAt >= from && s.startedAt < to);
  const ids = new Set(inRange.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
  const rangeIds = new Set(inRange.map((s) => s.id));
  const table = buildPRTable(done, byId, { allGyms: true });

  const trends: LiftTrend[] = [];
  for (const exerciseId of ids) {
    const points = exerciseHistory(exerciseId, inRange, { byId, allGyms: true }).map((p) => ({
      date: p.date,
      e1rmKg: p.estimated1RM,
    }));
    if (points.length === 0) continue;
    const records = Object.values(table[exerciseId] ?? {}).filter((pr) => pr && rangeIds.has(pr.sessionId)).length;
    trends.push({ exerciseId, name: byId[exerciseId]?.name ?? "Removed exercise", points, records });
  }
  return trends
    .sort(
      (a, b) =>
        b.points.length - a.points.length || b.points[b.points.length - 1].e1rmKg - a.points[a.points.length - 1].e1rmKg,
    )
    .slice(0, limit);
}
