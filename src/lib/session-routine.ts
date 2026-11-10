import type { RoutineExercise, WorkoutSession } from "@/types/workout";
import { newId } from "./id";

/**
 * A finished workout as a routine's exercises: the same lifts, order, rest, notes, supersets and
 * variations, with what was lifted as the targets. Only the sets that were done count, unless
 * none were, so a half-logged exercise does not plant empty sets in the routine.
 */
export function routineExercisesFrom(session: WorkoutSession, ids: () => string = newId): RoutineExercise[] {
  return session.exercises.map((ex) => {
    const done = ex.sets.filter((s) => s.completed);
    return {
      id: ids(),
      exerciseId: ex.exerciseId,
      restSeconds: ex.restSeconds,
      ...(ex.notes ? { notes: ex.notes } : {}),
      ...(ex.supersetId ? { supersetId: ex.supersetId } : {}),
      ...(ex.variation ? { variation: ex.variation } : {}),
      sets: (done.length ? done : ex.sets).map((s) => ({ id: ids(), type: s.type, targetWeightKg: s.weightKg, targetReps: s.reps })),
    };
  });
}
