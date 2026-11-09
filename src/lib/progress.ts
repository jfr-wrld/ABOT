import type { Exercise, WorkoutSession } from "@/types/workout";
import { countSets, sessionDurationSec, sessionVolume } from "./calc";
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
