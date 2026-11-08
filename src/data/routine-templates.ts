import type { Routine, RoutineExercise } from "@/types/workout";
import { newId } from "@/lib/id";

/**
 * Starter routines built from the seed library: common training splits with target sets and
 * reps, no weights (those are the lifter's own). Adding one copies it into the user's routines,
 * filed under the program name, where it can be edited like any other.
 */
export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
}

export interface RoutineTemplate {
  id: string;
  program: string;
  name: string;
  /** One line on what the day trains. */
  focus: string;
  exercises: TemplateExercise[];
}

export interface TemplateProgram {
  name: string;
  /** How the days are meant to be used across a week. */
  schedule: string;
}

export const TEMPLATE_PROGRAMS: TemplateProgram[] = [
  { name: "Push / Pull / Legs", schedule: "3 days, or 6 with each day twice" },
  { name: "Upper / Lower", schedule: "4 days: upper, lower, rest, upper, lower" },
  { name: "Full Body", schedule: "3 days, alternating A and B" },
  { name: "Dumbbells only", schedule: "2 to 3 days, for a home or hotel gym" },
];

const compound = (exerciseId: string, sets: number, reps: number): TemplateExercise => ({ exerciseId, sets, reps, restSeconds: 150 });
const accessory = (exerciseId: string, sets: number, reps: number): TemplateExercise => ({ exerciseId, sets, reps, restSeconds: 90 });

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: "ppl-push",
    program: "Push / Pull / Legs",
    name: "Push",
    focus: "Chest, shoulders, triceps",
    exercises: [
      compound("bench-press-barbell", 4, 6),
      compound("overhead-press-barbell", 3, 8),
      accessory("incline-bench-press-dumbbell", 3, 10),
      accessory("lateral-raise-dumbbell", 3, 12),
      accessory("triceps-pushdown-cable", 3, 12),
    ],
  },
  {
    id: "ppl-pull",
    program: "Push / Pull / Legs",
    name: "Pull",
    focus: "Back, rear delts, biceps",
    exercises: [
      compound("deadlift-barbell", 3, 5),
      compound("pull-up", 3, 8),
      compound("bent-over-row-barbell", 3, 8),
      accessory("face-pull-cable", 3, 15),
      accessory("bicep-curl-dumbbell", 3, 12),
    ],
  },
  {
    id: "ppl-legs",
    program: "Push / Pull / Legs",
    name: "Legs",
    focus: "Quads, hamstrings, glutes, calves",
    exercises: [
      compound("squat-barbell", 4, 6),
      compound("romanian-deadlift-barbell", 3, 8),
      accessory("leg-press-machine", 3, 10),
      accessory("leg-curl-machine", 3, 12),
      accessory("standing-calf-raise-machine", 4, 12),
    ],
  },
  {
    id: "ul-upper",
    program: "Upper / Lower",
    name: "Upper",
    focus: "Press and pull for the whole upper body",
    exercises: [
      compound("bench-press-barbell", 4, 6),
      compound("bent-over-row-barbell", 4, 8),
      compound("shoulder-press-dumbbell", 3, 10),
      accessory("lat-pulldown-cable", 3, 10),
      accessory("ez-bar-curl", 2, 12),
      accessory("triceps-rope-pushdown-cable", 2, 12),
    ],
  },
  {
    id: "ul-lower",
    program: "Upper / Lower",
    name: "Lower",
    focus: "Squat, hinge, single leg, core",
    exercises: [
      compound("squat-barbell", 4, 6),
      compound("romanian-deadlift-barbell", 3, 8),
      accessory("bulgarian-split-squat", 3, 10),
      accessory("seated-leg-curl-machine", 3, 12),
      accessory("hanging-leg-raise", 3, 12),
    ],
  },
  {
    id: "fb-a",
    program: "Full Body",
    name: "Full Body A",
    focus: "Squat, bench, row",
    exercises: [
      compound("squat-barbell", 3, 5),
      compound("bench-press-barbell", 3, 5),
      compound("bent-over-row-barbell", 3, 8),
      accessory("ab-wheel-rollout", 3, 10),
    ],
  },
  {
    id: "fb-b",
    program: "Full Body",
    name: "Full Body B",
    focus: "Deadlift, overhead press, pull-up",
    exercises: [
      compound("deadlift-barbell", 3, 5),
      compound("overhead-press-barbell", 3, 6),
      compound("pull-up", 3, 8),
      accessory("walking-lunge-dumbbell", 3, 10),
    ],
  },
  {
    id: "db-full",
    program: "Dumbbells only",
    name: "Dumbbell Full Body",
    focus: "Every major muscle with one pair of dumbbells",
    exercises: [
      compound("goblet-squat", 3, 10),
      compound("bench-press-dumbbell", 3, 10),
      compound("one-arm-row-dumbbell", 3, 10),
      accessory("shoulder-press-dumbbell", 3, 10),
      accessory("walking-lunge-dumbbell", 3, 12),
      accessory("hammer-curl-dumbbell", 2, 12),
    ],
  },
];

export function templateSetCount(t: RoutineTemplate): number {
  return t.exercises.reduce((n, e) => n + e.sets, 0);
}

/** The template as routine exercises with fresh ids: target reps set, weights left empty. */
export function templateExercises(t: RoutineTemplate): RoutineExercise[] {
  return t.exercises.map((e) => ({
    id: newId(),
    exerciseId: e.exerciseId,
    restSeconds: e.restSeconds,
    sets: Array.from({ length: e.sets }, () => ({ id: newId(), type: "normal" as const, targetWeightKg: null, targetReps: e.reps })),
  }));
}

/** True when the user already has a routine made from this template (same name in the program's folder). */
export function hasTemplate(routines: Routine[], t: RoutineTemplate): boolean {
  return routines.some((r) => r.name === t.name && (r.folder ?? "") === t.program);
}
