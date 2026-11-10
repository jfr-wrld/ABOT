import type { SessionExercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { setNumbers } from "./sets";

export interface LiveSet {
  exercise: SessionExercise;
  set: WorkoutSet;
  /** 1, 2, 3 for working sets; null for a warm-up. */
  number: number | null;
  /** Working sets in this exercise (warm-ups left out), for "Set 2 of 4". */
  of: number;
  /** The nearest earlier set of this exercise with a weight or reps, to show while this one is empty. */
  last: WorkoutSet | null;
}

/**
 * The set the lifter is on: the first set not ticked off, in the order the workout lists them.
 * Null when every set is done (or nothing has been added yet).
 */
export function liveSet(session: WorkoutSession): LiveSet | null {
  for (const exercise of session.exercises) {
    const i = exercise.sets.findIndex((s) => !s.completed);
    if (i === -1) continue;
    const numbers = setNumbers(exercise.sets);
    return {
      exercise,
      set: exercise.sets[i]!,
      number: numbers[i] ?? null,
      of: numbers.filter((n) => n !== null).length,
      last: exercise.sets.slice(0, i).reverse().find((s) => s.weightKg !== null || s.reps !== null || !!s.durationSec) ?? null,
    };
  }
  return null;
}

/** Sets ticked off and sets in the workout, warm-ups included: the bar along the capsule's edge. */
export function setProgress(session: WorkoutSession): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const e of session.exercises)
    for (const s of e.sets) {
      total++;
      if (s.completed) done++;
    }
  return { done, total };
}
