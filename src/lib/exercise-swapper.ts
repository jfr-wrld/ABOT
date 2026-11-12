import type { Equipment, Exercise, MuscleGroup, WeightUnit, RoutineExercise, WorkoutSession } from "@/types/workout";
import { isWorkingSet, kgToLbs, lbsToKg } from "./calc";

/**
 * Smart swap: when the rack is taken or the hotel has two dumbbells, the closest alternatives
 * to an exercise, and the weight to start them with.
 *
 * Matching (out of 99): the movement pattern (horizontal or vertical push and pull, squat,
 * hinge, lunge, or the isolated muscle) 45, the same main muscle 25, shared primary muscles up
 * to 15, shared secondary muscles up to 8, and the same name apart from the equipment up to 6
 * (Bench Press (Dumbbell) for Bench Press (Barbell) beats Incline Bench Press). The equipment
 * profile filters what is on offer.
 *
 * Weight: if the lifter has done the new exercise, its last top working weight. Otherwise a
 * conversion through a barbell equivalent: dumbbells about 41% per hand, Smith machine 105%,
 * machines and cables 110%, kettlebells as dumbbells. Bodyweight and bands start empty.
 */

export type MovementPattern =
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "lunge"
  | "hinge"
  | "fly"
  | `isolation-${MuscleGroup}`;

const PATTERNS: [RegExp, MovementPattern][] = [
  [/overhead|shoulder press|military|arnold|pike push|push press/i, "vertical-push"],
  [/bench|chest press|push[ -]?up|\bdips?\b|floor press/i, "horizontal-push"],
  [/fly|flye|pec deck|crossover/i, "fly"],
  [/pull[ -]?up|chin[ -]?up|pulldown|pull[ -]?down/i, "vertical-pull"],
  [/\brows?\b|inverted row/i, "horizontal-pull"],
  [/lunge|split squat|step up|bulgarian/i, "lunge"],
  [/squat|leg press|hack/i, "squat"],
  [/deadlift|romanian|\brdl\b|good morning|hip thrust|glute bridge|swing|back extension|rack pull/i, "hinge"],
];

export function movementPattern(ex: Exercise): MovementPattern {
  const hit = PATTERNS.find(([re]) => re.test(ex.name));
  return hit ? hit[1] : `isolation-${ex.primaryMuscles[0] ?? "full_body"}`;
}

export type EquipmentFilter = "all" | "home" | "machine" | "bodyweight";

export const FILTER_LABEL: Record<EquipmentFilter, string> = {
  all: "Full gym",
  home: "Dumbbell / Home",
  machine: "Machine / Cable",
  bodyweight: "Bodyweight",
};

/** What each profile chip offers. */
export const FILTER_EQUIPMENT: Record<EquipmentFilter, readonly Equipment[] | null> = {
  all: null,
  home: ["dumbbell", "barbell", "kettlebell", "bodyweight", "band"],
  machine: ["machine", "cable", "smith_machine"],
  bodyweight: ["bodyweight", "band"],
};

export interface SwapCandidate {
  exercise: Exercise;
  /** 0 to 99. */
  match: number;
  /** The reason that counts most, for the row's subtitle. */
  reason: { kind: "pattern" | "muscle" | "related"; muscle?: MuscleGroup };
}

/** The words of a name without the equipment in brackets: "Bench Press (Dumbbell)" -> bench, press. */
const baseName = (name: string) =>
  name
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

const overlap = (a: readonly string[], b: readonly string[]) => {
  if (!a.length || !b.length) return 0;
  const s = new Set(b);
  return a.filter((x) => s.has(x)).length / new Set([...a, ...b]).size;
};

export function swapCandidates(from: Exercise, library: Exercise[], filter: EquipmentFilter, limit = 5): SwapCandidate[] {
  const allowed = FILTER_EQUIPMENT[filter];
  const pattern = movementPattern(from);
  const main = from.primaryMuscles[0];
  const timed = from.logType === "duration" || from.logType === "distance_duration";
  const out: SwapCandidate[] = [];
  for (const e of library) {
    if (e.id === from.id || (allowed && !allowed.includes(e.equipment))) continue;
    // A plank is not a swap for a set of reps, nor the other way round.
    if (timed !== (e.logType === "duration" || e.logType === "distance_duration")) continue;
    const samePattern = movementPattern(e) === pattern;
    const sameMain = main !== undefined && e.primaryMuscles[0] === main;
    const primary = overlap(from.primaryMuscles, e.primaryMuscles);
    if (!samePattern && !sameMain && primary === 0) continue;
    const score =
      (samePattern ? 45 : 0) +
      (sameMain ? 25 : 0) +
      15 * primary +
      8 * overlap(from.secondaryMuscles, e.secondaryMuscles) +
      6 * overlap(baseName(from.name), baseName(e.name));
    out.push({
      exercise: e,
      match: Math.min(99, Math.round(score)),
      reason: samePattern && sameMain ? { kind: "pattern", muscle: main } : sameMain ? { kind: "muscle", muscle: main } : { kind: "related", muscle: e.primaryMuscles[0] },
    });
  }
  return out.sort((a, b) => b.match - a.match || a.exercise.name.localeCompare(b.exercise.name)).slice(0, limit);
}

/** Load against a barbell doing the same movement. Dumbbell and kettlebell are per hand. */
const BARBELL_EQUIVALENT: Partial<Record<Equipment, number>> = {
  barbell: 1,
  smith_machine: 1.05,
  machine: 1.1,
  cable: 1.1,
  dumbbell: 0.41,
  kettlebell: 0.41,
  other: 1,
};

/** Rounds to what can be loaded: 2.5 kg on bars and stacks, 1 kg on light dumbbells, 5 lb. */
function loadable(kg: number, equipment: Equipment, unit: WeightUnit): number {
  if (unit === "lbs") return lbsToKg(Math.max(5, Math.round(kgToLbs(kg) / 5) * 5));
  const inc = (equipment === "dumbbell" || equipment === "kettlebell") && kg < 20 ? 1 : 2.5;
  return Math.max(inc, Math.round(kg / inc) * inc);
}

/** The lifter's own last top working weight on this exercise, if any. */
export function lastTopWeight(exerciseId: string, sessions: WorkoutSession[], excludeSessionId?: string): number | null {
  const ordered = sessions.filter((s) => s.status === "completed" && s.id !== excludeSessionId).sort((a, b) => b.startedAt - a.startedAt);
  for (const s of ordered) {
    const w = s.exercises
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets.filter((x) => isWorkingSet(x) && (x.weightKg ?? 0) > 0).map((x) => x.weightKg!));
    if (w.length) return Math.max(...w);
  }
  return null;
}

export interface ConvertedLoad {
  weightKg: number | null;
  source: "history" | "ratio" | "none";
}

export function convertLoad(
  weightKg: number | null,
  from: Exercise,
  to: Exercise,
  opts: { sessions: WorkoutSession[]; unit: WeightUnit; excludeSessionId?: string },
): ConvertedLoad {
  const own = lastTopWeight(to.id, opts.sessions, opts.excludeSessionId);
  if (own !== null) return { weightKg: own, source: "history" };
  const toFactor = BARBELL_EQUIVALENT[to.equipment];
  const fromFactor = BARBELL_EQUIVALENT[from.equipment];
  if (weightKg === null || weightKg <= 0 || !toFactor || !fromFactor || to.equipment === "bodyweight" || to.isBodyweight) {
    return { weightKg: null, source: "none" };
  }
  return { weightKg: loadable((weightKg / fromFactor) * toFactor, to.equipment, opts.unit), source: "ratio" };
}

/**
 * The routine with `fromId` swapped for `toId` (its first place in the routine), for "Update
 * routine" after a swap. Working sets take the converted weight; warm-ups lose theirs, since
 * the old exercise's ramp does not fit the new one. Null when the routine does not have it.
 */
export function swapInRoutine(exercises: RoutineExercise[], fromId: string, toId: string, weightKg: number | null): RoutineExercise[] | null {
  const i = exercises.findIndex((e) => e.exerciseId === fromId);
  if (i < 0) return null;
  return exercises.map((e, j) => {
    if (j !== i) return e;
    const { variation: _variation, ...rest } = e;
    void _variation;
    return { ...rest, exerciseId: toId, sets: e.sets.map((x) => ({ ...x, targetWeightKg: x.type === "warmup" ? null : weightKg })) };
  });
}
