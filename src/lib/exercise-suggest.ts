import type { Exercise, MuscleGroup, Routine, WorkoutSession } from "@/types/workout";
import { nextProtocol } from "./home";
import type { WorkoutSchedule } from "@/lib/notifications/schedule";

/**
 * Today's target muscles: the main muscles of the routine this workout came from, or, for an
 * empty workout, of the routine due today (the schedule's, else the one after the last trained).
 * In the order the routine works them.
 */
export function todaysTargets(
  active: WorkoutSession,
  routines: Routine[],
  sessions: WorkoutSession[],
  schedule: WorkoutSchedule,
  byId: Record<string, Exercise>,
  now = Date.now(),
): { routine: Routine; muscles: MuscleGroup[] } | null {
  const routine = routines.find((r) => r.id === active.routineId) ?? nextProtocol(routines, sessions, schedule, now)?.routine;
  if (!routine) return null;
  const muscles: MuscleGroup[] = [];
  for (const re of routine.exercises) {
    const m = byId[re.exerciseId]?.primaryMuscles[0];
    if (m && !muscles.includes(m)) muscles.push(m);
  }
  return muscles.length ? { routine, muscles } : null;
}

export interface NextSuggestion {
  exercise: Exercise;
  /** The target muscle this exercise is for. */
  muscle: MuscleGroup;
}

/**
 * Exercises for the target muscles this workout has not reached yet: up to two per muscle, the
 * routine's own pick first, then the ones this lifter has done most, then the library's order.
 * Nothing once every target is in the workout.
 */
export function suggestNext(
  active: WorkoutSession,
  targets: { routine: Routine; muscles: MuscleGroup[] },
  library: Exercise[],
  sessions: WorkoutSession[],
  byId: Record<string, Exercise>,
  limit = 6,
): NextSuggestion[] {
  const inWorkout = new Set(active.exercises.map((e) => e.exerciseId));
  const covered = new Set(active.exercises.flatMap((e) => byId[e.exerciseId]?.primaryMuscles ?? []));
  const missing = targets.muscles.filter((m) => !covered.has(m));
  if (!missing.length) return [];

  const done = new Map<string, number>();
  for (const s of sessions) for (const e of s.exercises) done.set(e.exerciseId, (done.get(e.exerciseId) ?? 0) + 1);
  const inRoutine = new Set(targets.routine.exercises.map((e) => e.exerciseId));
  const order = new Map(library.map((e, i) => [e.id, i]));

  const out: NextSuggestion[] = [];
  for (const muscle of missing) {
    const picks = library
      .filter((e) => e.primaryMuscles[0] === muscle && !inWorkout.has(e.id) && e.category !== "mobility" && e.category !== "cardio")
      .sort(
        (a, b) =>
          Number(inRoutine.has(b.id)) - Number(inRoutine.has(a.id)) ||
          (done.get(b.id) ?? 0) - (done.get(a.id) ?? 0) ||
          (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      )
      .slice(0, 2);
    for (const exercise of picks) out.push({ exercise, muscle });
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
