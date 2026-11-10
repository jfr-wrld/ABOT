import type { Routine, RoutineExercise, WorkoutSession } from "@/types/workout";
import { routineExercisesFrom } from "./session-routine";
import { newId } from "./id";

export interface RoutineChanges {
  /** Exercises done in the workout but not in the routine (a swap or an addition). */
  added: string[];
  /** Routine exercises that were not done. */
  removed: string[];
  /** Exercises kept whose weights, reps or number of sets changed. */
  retargeted: string[];
}

/**
 * The routine as the workout left it: its exercises, order, rest and sets, with what was lifted
 * as the new targets. A rep range the routine planned stays (the Coach progresses inside it);
 * only the weight moves. Exercise ids are kept where the same lift is still there.
 */
export function updatedRoutineExercises(routine: Routine, session: WorkoutSession, ids: () => string = newId): RoutineExercise[] {
  const unused = [...routine.exercises];
  return routineExercisesFrom(session, ids).map((ex) => {
    const i = unused.findIndex((r) => r.exerciseId === ex.exerciseId);
    const before = i >= 0 ? unused.splice(i, 1)[0] : undefined;
    if (!before) return ex;
    return {
      ...ex,
      id: before.id,
      sets: ex.sets.map((s, j) => {
        const planned = before.sets[j];
        return planned?.targetRepsMax
          ? { ...s, targetReps: planned.targetReps, targetRepsMax: planned.targetRepsMax }
          : s;
      }),
    };
  });
}

/** What updating the routine would change; all empty when the workout matched it. */
export function routineChanges(routine: Routine, session: WorkoutSession): RoutineChanges {
  const next = updatedRoutineExercises(routine, session, () => "");
  const left = [...routine.exercises];
  const added: string[] = [];
  const retargeted: string[] = [];
  for (const ex of next) {
    const i = left.findIndex((r) => r.exerciseId === ex.exerciseId);
    if (i < 0) {
      added.push(ex.exerciseId);
      continue;
    }
    const before = left.splice(i, 1)[0]!;
    const same =
      before.sets.length === ex.sets.length &&
      before.sets.every((s, j) => s.targetWeightKg === ex.sets[j]!.targetWeightKg && s.targetReps === ex.sets[j]!.targetReps);
    if (!same) retargeted.push(ex.exerciseId);
  }
  return { added, removed: left.map((r) => r.exerciseId), retargeted };
}

export function hasChanges(c: RoutineChanges): boolean {
  return c.added.length + c.removed.length + c.retargeted.length > 0;
}
