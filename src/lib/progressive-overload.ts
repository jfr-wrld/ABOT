import type { Exercise, MuscleGroup, WeightUnit, WorkoutSession, WorkoutSet } from "@/types/workout";
import { isWorkingSet, kgToLbs, lbsToKg, matchesVariant, setVolume, type VariantOptions } from "./calc";

/**
 * The Coach Pill: next session's target for one exercise, from its last three sessions.
 *
 * - Load: the last session was clean (every top set reached the same reps, no failure set,
 *   average RPE 8.5 or less when logged). Lower-body compounds on a barbell, Smith machine or
 *   machine (quads, hamstrings, glutes, back) add 2.5 kg, or 5 kg when it felt easy (RPE 7
 *   or less). Everything else follows double progression: add reps (1, or 2 when easy) until
 *   12, then add the smallest jump (2.5 kg, 1 kg on light dumbbells) and drop back to 8.
 * - Deload: volume fell in each of the last three sessions, or the last two averaged RPE 9.5
 *   or more with missed reps, or three sessions at the same weight never came out clean.
 *   Take 10% off, rounded down to a loadable step.
 * - Nothing: no history, a timed or distance exercise, or a session that was neither.
 * Pounds users get 5 lb and 10 lb jumps instead of 2.5 kg and 5 kg.
 */

export type OverloadKind = "load" | "reps" | "deload";

/** Pill titles and the reasons behind a call (English; the UI translates them). */
export const KIND_LABEL: Record<OverloadKind, string> = { load: "Overload target", reps: "Volume target", deload: "CNS fatigue: deload" };
export const WHY = {
  clean: "Every set reached its reps",
  top: "Top of the rep range: add weight, start again at 8",
  falling: "Volume fell three sessions in a row",
  grinding: "Two sessions at RPE 9.5 or more with missed reps",
  stuck: "Three sessions at this weight without a clean one",
} as const;

export interface OverloadSuggestion {
  kind: OverloadKind;
  /** Target per set, kg (per hand for dumbbells), or null for bodyweight work. */
  weightKg: number | null;
  reps: number;
  /** Change against the last top set, in kg. */
  deltaKg: number;
  deltaReps: number;
  /** Sessions the call was based on. */
  basedOn: number;
  /** One line on why, for the pill's accessible label. */
  why: string;
}

export interface SessionSummary {
  startedAt: number;
  /** Heaviest working weight, kg (0 for bodyweight). */
  topKg: number;
  /** Reps of each working set at the top weight, in order. */
  topReps: number[];
  avgRpe: number | null;
  volume: number;
  failed: boolean;
}

const LOWER: ReadonlySet<MuscleGroup> = new Set(["quads", "hamstrings", "glutes", "back", "lower_back"]);
const REP_CEILING = 12;
const REP_FLOOR = 8;

const counted = (s: WorkoutSet) => isWorkingSet(s) && s.type !== "dropset";

export function summarize(session: WorkoutSession, exerciseId: string, ex?: Exercise): SessionSummary | null {
  const sets = session.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(counted));
  if (sets.length === 0) return null;
  const topKg = Math.max(...sets.map((s) => s.weightKg ?? 0));
  const top = sets.filter((s) => (s.weightKg ?? 0) === topKg);
  const rpes = sets.filter((s) => s.rpe !== null).map((s) => s.rpe!);
  return {
    startedAt: session.startedAt,
    topKg,
    topReps: top.map((s) => s.reps ?? 0),
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    volume: sets.reduce((v, s) => v + setVolume(s, ex?.loadMode), 0),
    failed: sets.some((s) => s.type === "failure"),
  };
}

/** Every top set reached the reps of the best one, nothing failed, effort in hand. */
function clean(s: SessionSummary): boolean {
  const target = Math.max(...s.topReps);
  return !s.failed && s.topReps.every((r) => r >= target) && (s.avgRpe === null || s.avgRpe <= 8.5);
}

/** The loadable step for this equipment, in kg. */
function step(ex: Exercise, unit: WeightUnit, kg: number): number {
  if (unit === "lbs") return lbsToKg(5);
  if ((ex.equipment === "dumbbell" || ex.equipment === "kettlebell") && kg < 20) return 1;
  return 2.5;
}

/** Rounds kg to the nearest loadable weight in the lifter's unit. */
function roundLoad(kg: number, ex: Exercise, unit: WeightUnit, dir: "near" | "down" = "near"): number {
  const f = dir === "down" ? Math.floor : Math.round;
  if (unit === "lbs") {
    const inc = 5;
    return lbsToKg(f(kgToLbs(kg) / inc + (dir === "down" ? 1e-9 : 0)) * inc);
  }
  const inc = step(ex, unit, kg);
  return Math.round(f(kg / inc + (dir === "down" ? 1e-9 : 0)) * inc * 1000) / 1000;
}

export function suggestOverload(
  ex: Exercise | undefined,
  sessions: WorkoutSession[],
  opts: { unit: WeightUnit; excludeSessionId?: string; variant?: VariantOptions },
): OverloadSuggestion | null {
  if (!ex || ex.logType === "duration" || ex.logType === "distance_duration") return null;
  const history = sessions
    .filter((s) => s.status === "completed" && s.id !== opts.excludeSessionId && matchesVariant(ex.id, s, opts.variant))
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((s) => summarize(s, ex.id, ex))
    .filter((s): s is SessionSummary => s !== null)
    .slice(0, 3);
  const last = history[0];
  if (!last) return null;
  const reps = Math.max(...last.topReps);
  const loaded = last.topKg > 0;
  const basedOn = history.length;

  // Fatigue first: a lifter grinding down should not be told to add weight.
  const falling = history.length >= 3 && history[0]!.volume < history[1]!.volume && history[1]!.volume < history[2]!.volume;
  const grinding =
    history.length >= 2 && history.slice(0, 2).every((s) => s.avgRpe !== null && s.avgRpe >= 9.5 && !clean({ ...s, avgRpe: null }));
  const stuck = history.length >= 3 && history.every((s) => s.topKg === last.topKg) && !history.some(clean);
  if (loaded && (falling || grinding || stuck)) {
    const weightKg = roundLoad(last.topKg * 0.9, ex, opts.unit, "down");
    return {
      kind: "deload",
      weightKg,
      reps,
      deltaKg: weightKg - last.topKg,
      deltaReps: 0,
      basedOn,
      why: falling ? WHY.falling : grinding ? WHY.grinding : WHY.stuck,
    };
  }

  if (!clean(last)) return null;
  const easy = last.avgRpe !== null && last.avgRpe <= 7;

  if (!loaded || ex.logType === "reps_only") {
    const add = easy ? 2 : 1;
    return { kind: "reps", weightKg: loaded ? last.topKg : null, reps: reps + add, deltaKg: 0, deltaReps: add, basedOn, why: WHY.clean };
  }

  const lowerCompound =
    (ex.equipment === "barbell" || ex.equipment === "smith_machine" || ex.equipment === "machine") &&
    ex.primaryMuscles.some((m) => LOWER.has(m));
  if (lowerCompound) {
    const jump = opts.unit === "lbs" ? lbsToKg(easy ? 10 : 5) : easy ? 5 : 2.5;
    const weightKg = roundLoad(last.topKg + jump, ex, opts.unit);
    return { kind: "load", weightKg, reps, deltaKg: weightKg - last.topKg, deltaReps: 0, basedOn, why: WHY.clean };
  }

  if (reps < REP_CEILING) {
    const add = Math.min(easy ? 2 : 1, REP_CEILING - reps);
    return { kind: "reps", weightKg: last.topKg, reps: reps + add, deltaKg: 0, deltaReps: add, basedOn, why: WHY.clean };
  }
  const weightKg = roundLoad(last.topKg + step(ex, opts.unit, last.topKg), ex, opts.unit);
  return {
    kind: "load",
    weightKg,
    reps: REP_FLOOR,
    deltaKg: weightKg - last.topKg,
    deltaReps: REP_FLOOR - reps,
    basedOn,
    why: WHY.top,
  };
}
