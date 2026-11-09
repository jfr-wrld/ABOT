import type { Exercise, WorkoutSession } from "@/types/workout";
import { isWorkingSet, sessionDurationSec, sessionVolume } from "./calc";
import { tunables } from "./tunables";

/**
 * Calories for a lifting session, from the MET method health apps use:
 *
 *   kcal = MET x 3.5 x (body weight kg / 200) x minutes
 *
 * Weight training sits between MET 3.5 (light, long rests) and 6 (heavy and dense). The MET
 * here is read from how much was lifted per minute and, when logged, how hard the sets felt:
 * - density = volume (kg) / minutes: 40 kg/min or less gives 3.5, 300 or more gives 6.0, linear
 *   in between;
 * - average RPE adds 0.25 per point above 7 and takes 0.25 per point below;
 * - the result is kept between 3.5 and 6.5.
 * It is an estimate: no heart rate goes into it.
 */

export const MET_MIN = 3.5;
export const MET_MAX = 6.5;
/** Used when no body weight is known yet, and reported as such. */
export const FALLBACK_BODYWEIGHT_KG = 75;


export interface CalorieEstimate {
  kcal: number;
  met: number;
  minutes: number;
  /** kg lifted per minute. */
  density: number;
  /** Mean RPE of working sets that have one, or null. */
  avgRpe: number | null;
  bodyweightKg: number;
  /** False when the fallback weight was used. */
  bodyweightKnown: boolean;
}

export function metFor(density: number, avgRpe: number | null): number {
  const c = tunables().calories;
  const t = Math.min(1, Math.max(0, (density - c.densityLow) / (c.densityHigh - c.densityLow)));
  const base = c.metMin + t * (Math.max(6, c.metMin) - c.metMin);
  const rpe = avgRpe === null ? 0 : (avgRpe - 7) * 0.25;
  return Math.min(c.metMax, Math.max(c.metMin, base + rpe));
}

export function kcalFrom(met: number, bodyweightKg: number, minutes: number): number {
  return met * 3.5 * (bodyweightKg / 200) * minutes;
}

export function estimateCalories(
  session: WorkoutSession,
  opts: { bodyweightKg: number | null; byId?: Record<string, Exercise>; now?: number },
): CalorieEstimate {
  const minutes = sessionDurationSec(session, opts.now) / 60;
  const volume = sessionVolume(session, opts.byId);
  const density = minutes > 0 ? volume / minutes : 0;
  const rpes = session.exercises.flatMap((e) => e.sets.filter((s) => isWorkingSet(s) && s.rpe !== null).map((s) => s.rpe!));
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
  const met = metFor(density, avgRpe);
  const known = opts.bodyweightKg !== null && opts.bodyweightKg > 0;
  const bodyweightKg = known ? opts.bodyweightKg! : tunables().calories.fallbackKg;
  return {
    kcal: Math.round(kcalFrom(met, bodyweightKg, minutes)),
    met: Math.round(met * 10) / 10,
    minutes,
    density,
    avgRpe,
    bodyweightKg,
    bodyweightKnown: known,
  };
}
