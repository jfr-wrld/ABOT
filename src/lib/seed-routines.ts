import type { Routine } from "@/types/workout";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/types/workout";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";
import { newId } from "@/lib/id";

/**
 * Ready-made programs built only from seed exercises, so they work offline with no catalog.
 * They ship with the app (like the seed exercises) instead of being written into the user's
 * routines table: they never sync or fill backups, and a fix here reaches everyone. "Save to My
 * Routines" makes an ordinary, editable copy.
 */

export type Split = "ppl" | "upper_lower" | "full_body" | "calisthenics" | "core" | "specialized";

export const SPLITS: { value: Split; label: string; folder: string }[] = [
  { value: "ppl", label: "PPL", folder: "Push / Pull / Legs" },
  { value: "upper_lower", label: "Upper/Lower", folder: "Upper / Lower" },
  { value: "full_body", label: "Full Body", folder: "Full Body" },
  { value: "calisthenics", label: "Calisthenics", folder: "Calisthenics" },
  { value: "core", label: "Core", folder: "Core" },
  { value: "specialized", label: "Specialized", folder: "Specialized days" },
];

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  /** Target reps per set. */
  reps?: number;
  /** Timed exercises (plank): seconds per set instead of reps. */
  holdSec?: number;
  /** Rest after each set, seconds. */
  rest: number;
  /** Same letter = done back to back as a superset. */
  superset?: string;
}

export interface RoutineTemplate {
  id: string;
  split: Split;
  /** Terminal-style card title, e.g. "FULL BODY // DAY 01 [FOUNDATION]". */
  code: string;
  /** Plain name used when saved to My Routines. */
  name: string;
  focus: string;
  exercises: TemplateExercise[];
}

// Rest by job: heavy compounds need the longest, isolations the shortest.
const HEAVY = 180;
const MAIN = 120;
const ACC = 90;
const ISO = 60;

const x = (exerciseId: string, sets: number, reps: number, rest: number, superset?: string): TemplateExercise => ({
  exerciseId,
  sets,
  reps,
  rest,
  ...(superset ? { superset } : {}),
});
const hold = (exerciseId: string, sets: number, holdSec: number, rest: number): TemplateExercise => ({ exerciseId, sets, holdSec, rest });

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  // Push / Pull / Legs
  {
    id: "tpl-push-a",
    split: "ppl",
    code: "PUSH // A [STRENGTH]",
    name: "Push A: Strength",
    focus: "Heavy presses first, then volume for chest, shoulders and triceps.",
    exercises: [
      x("bench-press-barbell", 4, 5, HEAVY),
      x("overhead-press-barbell", 3, 6, MAIN),
      x("incline-bench-press-dumbbell", 3, 8, ACC),
      x("chest-dip", 3, 8, ACC),
      x("triceps-rope-pushdown-cable", 3, 12, ISO),
      x("lateral-raise-dumbbell", 3, 15, ISO),
    ],
  },
  {
    id: "tpl-push-b",
    split: "ppl",
    code: "PUSH // B [HYPERTROPHY]",
    name: "Push B: Hypertrophy",
    focus: "Cable and dumbbell work in the 10 to 15 rep range.",
    exercises: [
      x("incline-bench-press-dumbbell", 4, 10, ACC),
      x("cable-fly", 3, 12, ISO),
      x("shoulder-press-dumbbell", 3, 10, ACC),
      x("lateral-raise-cable", 3, 15, ISO),
      x("skullcrusher-barbell", 3, 12, ISO),
    ],
  },
  {
    id: "tpl-pull-a",
    split: "ppl",
    code: "PULL // A [WIDTH & LATS]",
    name: "Pull A: Width",
    focus: "Vertical pulls for the lats, rows and face pulls for the upper back.",
    exercises: [
      x("lat-pulldown-cable", 4, 8, MAIN),
      x("bent-over-row-barbell", 3, 8, MAIN),
      x("seated-row-cable", 3, 10, ACC),
      x("face-pull-cable", 3, 15, ISO),
      x("incline-curl-dumbbell", 3, 10, ISO),
      x("hammer-curl-dumbbell", 3, 12, ISO),
    ],
  },
  {
    id: "tpl-pull-b",
    split: "ppl",
    code: "PULL // B [THICKNESS]",
    name: "Pull B: Thickness",
    focus: "Deadlift and supported rows for back thickness and the lower back.",
    exercises: [
      x("deadlift-barbell", 4, 5, HEAVY),
      x("one-arm-row-dumbbell", 3, 10, ACC),
      x("chest-supported-row-dumbbell", 3, 10, ACC),
      x("rear-delt-fly-machine", 3, 15, ISO),
      x("preacher-curl-machine", 3, 12, ISO),
    ],
  },
  {
    id: "tpl-legs-a",
    split: "ppl",
    code: "LEGS // A [QUAD DOMINANT]",
    name: "Legs A: Quads",
    focus: "Squat-led session with a hinge and single-leg work.",
    exercises: [
      x("squat-barbell", 4, 5, HEAVY),
      x("romanian-deadlift-barbell", 3, 8, MAIN),
      x("leg-press-machine", 3, 10, ACC),
      x("bulgarian-split-squat", 3, 10, ACC),
      x("standing-calf-raise-machine", 4, 12, ISO),
    ],
  },
  {
    id: "tpl-legs-b",
    split: "ppl",
    code: "LEGS // B [POSTERIOR CHAIN]",
    name: "Legs B: Posterior chain",
    focus: "Hinges, hip thrusts and curls for hamstrings and glutes.",
    exercises: [
      x("romanian-deadlift-barbell", 4, 8, MAIN),
      x("hip-thrust-barbell", 3, 10, ACC),
      x("leg-curl-machine", 3, 12, ISO),
      x("walking-lunge-dumbbell", 3, 12, ACC),
      x("seated-calf-raise-machine", 4, 15, ISO),
    ],
  },

  // Upper / Lower
  {
    id: "tpl-upper",
    split: "upper_lower",
    code: "UPPER // DAY [BALANCED]",
    name: "Upper day",
    focus: "One horizontal and one vertical push and pull, then arms.",
    exercises: [
      x("bench-press-barbell", 4, 6, MAIN),
      x("bent-over-row-barbell", 4, 8, MAIN),
      x("overhead-press-barbell", 3, 8, ACC),
      x("lat-pulldown-cable", 3, 10, ACC),
      x("bicep-curl-barbell", 3, 10, ISO),
      x("overhead-triceps-extension-dumbbell", 3, 12, ISO),
    ],
  },
  {
    id: "tpl-lower",
    split: "upper_lower",
    code: "LOWER // DAY [BALANCED]",
    name: "Lower day",
    focus: "Squat and hinge, isolation for each side of the thigh, calves and core.",
    exercises: [
      x("squat-barbell", 4, 6, HEAVY),
      x("romanian-deadlift-barbell", 3, 8, MAIN),
      x("leg-extension-machine", 3, 12, ISO),
      x("leg-curl-machine", 3, 12, ISO),
      x("standing-calf-raise-machine", 4, 12, ISO),
      x("hanging-leg-raise", 3, 12, ISO),
    ],
  },

  // Full Body 3-day foundation
  {
    id: "tpl-fb-1",
    split: "full_body",
    code: "FULL BODY // DAY 01 [FOUNDATION]",
    name: "Full Body Day 1",
    focus: "Push and quad bias. Good for beginners and busy weeks.",
    exercises: [
      x("squat-barbell", 4, 6, HEAVY),
      x("bench-press-dumbbell", 3, 10, ACC),
      x("lat-pulldown-cable", 3, 10, ACC),
      x("shoulder-press-dumbbell", 3, 10, ACC),
      x("hanging-leg-raise", 3, 10, ISO),
    ],
  },
  {
    id: "tpl-fb-2",
    split: "full_body",
    code: "FULL BODY // DAY 02 [FOUNDATION]",
    name: "Full Body Day 2",
    focus: "Hinge and pull bias.",
    exercises: [
      x("romanian-deadlift-barbell", 4, 8, MAIN),
      x("bent-over-row-barbell", 3, 8, MAIN),
      x("incline-bench-press-dumbbell", 3, 10, ACC),
      x("lateral-raise-dumbbell", 3, 15, ISO),
      x("bicep-curl-dumbbell", 3, 12, ISO),
    ],
  },
  {
    id: "tpl-fb-3",
    split: "full_body",
    code: "FULL BODY // DAY 03 [FOUNDATION]",
    name: "Full Body Day 3",
    focus: "Dynamic and accessory bias: machines, bodyweight pulls and dips.",
    exercises: [
      x("leg-press-machine", 3, 10, ACC),
      x("pull-up", 3, 8, ACC),
      x("chest-dip", 3, 10, ACC),
      x("bulgarian-split-squat", 3, 10, ACC),
      x("face-pull-cable", 3, 15, ISO),
      x("triceps-pushdown-cable", 3, 12, ISO),
    ],
  },

  // Calisthenics
  {
    id: "tpl-cali-upper",
    split: "calisthenics",
    code: "CALISTHENICS // UPPER [FLOW]",
    name: "Bodyweight upper",
    focus: "A bar and two handles or a dip station. Nothing else.",
    exercises: [
      x("push-up", 3, 15, ISO),
      x("pull-up", 3, 8, ACC),
      x("triceps-dip", 3, 10, ACC),
      x("pike-push-up", 3, 8, ACC),
      x("diamond-push-up", 3, 10, ISO),
      x("chin-up", 3, 8, ACC),
    ],
  },
  {
    id: "tpl-cali-lower",
    split: "calisthenics",
    code: "CALISTHENICS // LOWER & CORE",
    name: "Bodyweight lower and core",
    focus: "Legs and trunk at home: a step and a bar are enough.",
    exercises: [
      x("bodyweight-squat", 3, 20, ISO),
      x("walking-lunge-dumbbell", 3, 12, ISO),
      x("single-leg-calf-raise", 3, 15, ISO),
      x("hanging-leg-raise", 3, 10, ISO),
      hold("plank", 3, 45, ISO),
      x("mountain-climber", 3, 20, ISO),
    ],
  },

  // Core
  {
    id: "tpl-core",
    split: "core",
    code: "CORE // ABS [ANTI-ROTATION]",
    name: "Core and abs",
    focus: "Flexion, rotation and bracing in four movements.",
    exercises: [
      x("hanging-leg-raise", 3, 12, ISO),
      x("cable-woodchopper", 3, 12, ISO),
      x("ab-wheel-rollout", 3, 10, ISO),
      hold("plank", 3, 45, ISO),
    ],
  },

  // Specialized days
  {
    id: "tpl-chest-tri",
    split: "specialized",
    code: "CHEST & TRICEPS // LOCKOUT",
    name: "Chest and triceps",
    focus: "Chest isolation after the press, then lockout strength.",
    exercises: [
      x("bench-press-barbell", 4, 6, MAIN),
      x("incline-bench-press-dumbbell", 3, 10, ACC),
      x("pec-deck-machine", 3, 12, ISO),
      x("close-grip-bench-press-barbell", 3, 8, ACC),
      x("triceps-rope-pushdown-cable", 3, 12, ISO),
      x("overhead-triceps-extension-dumbbell", 3, 12, ISO),
    ],
  },
  {
    id: "tpl-back-bi",
    split: "specialized",
    code: "BACK & BICEPS // SWEEP",
    name: "Back and biceps",
    focus: "Every angle of the back, then the biceps peak.",
    exercises: [
      x("pull-up", 4, 8, MAIN),
      x("bent-over-row-barbell", 3, 8, MAIN),
      x("seated-row-cable", 3, 10, ACC),
      x("straight-arm-pulldown-cable", 3, 12, ISO),
      x("bicep-curl-barbell", 3, 10, ISO),
      x("incline-curl-dumbbell", 3, 12, ISO),
    ],
  },
  {
    id: "tpl-shoulders-arms",
    split: "specialized",
    code: "SHOULDERS & ARMS // PUMP",
    name: "Shoulders and arms",
    focus: "Press, raise and pull for the delts; biceps and triceps finish as a superset.",
    exercises: [
      x("overhead-press-barbell", 4, 6, MAIN),
      x("lateral-raise-dumbbell", 4, 15, ISO),
      x("face-pull-cable", 3, 15, ISO),
      x("ez-bar-curl", 3, 12, ISO, "A"),
      x("triceps-pushdown-cable", 3, 12, ISO, "A"),
    ],
  },
];

/** Work about 45 s a set, the set rest, a minute to set up each exercise, five minutes to warm up. */
export function estimateMinutes(t: RoutineTemplate): number {
  const sec = t.exercises.reduce((sum, e) => sum + e.sets * (45 + e.rest) + 60, 5 * 60);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** Primary muscles by working sets, most first. */
export function templateMuscles(t: RoutineTemplate): string[] {
  const sets = new Map<MuscleGroup, number>();
  for (const e of t.exercises) {
    for (const m of SEED_EXERCISES_BY_ID[e.exerciseId]?.primaryMuscles ?? []) sets.set(m, (sets.get(m) ?? 0) + e.sets);
  }
  return [...sets.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => MUSCLE_GROUP_LABELS[m]);
}

/** An ordinary routine (fresh ids) for My Routines or for starting a workout. */
export function templateToRoutine(t: RoutineTemplate, now = Date.now()): Routine {
  const groups = new Map<string, string>();
  return {
    id: newId(),
    name: t.name,
    folder: SPLITS.find((s) => s.value === t.split)?.folder,
    createdAt: now,
    updatedAt: now,
    exercises: t.exercises.map((e) => ({
      id: newId(),
      exerciseId: e.exerciseId,
      restSeconds: e.rest,
      ...(e.holdSec ? { notes: `Hold ${e.holdSec} s each set` } : {}),
      ...(e.superset ? { supersetId: groups.get(e.superset) ?? (groups.set(e.superset, newId()), groups.get(e.superset)!) } : {}),
      sets: Array.from({ length: e.sets }, () => ({ id: newId(), type: "normal" as const, targetWeightKg: null, targetReps: e.reps ?? null })),
    })),
  };
}
