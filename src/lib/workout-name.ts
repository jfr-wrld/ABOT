import type { Exercise, MuscleGroup, WorkoutSession } from "@/types/workout";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import type { T } from "@/i18n";
import { muscleText } from "@/lib/home";

/** The names a workout gets when it starts empty, keyed by the time of day. */
export const TIME_OF_DAY_NAMES = ["Morning Workout", "Afternoon Workout", "Evening Workout"] as const;

/** True while the lifter has kept the time-of-day name, in English or their language. */
export function isTimeOfDayName(name: string, t: T): boolean {
  const n = name.trim();
  return TIME_OF_DAY_NAMES.some((x) => n === x || n === t(x));
}

/**
 * "Chest & Triceps": the one or two muscles with the most finished working sets. A list of
 * workouts all called "Evening Workout" says nothing; the muscles say what the day was.
 * Null when no working set is done.
 */
export function muscleWorkoutName(session: WorkoutSession, byId: Record<string, Exercise>, t: T): string | null {
  const count = new Map<MuscleGroup, number>();
  for (const ex of session.exercises) {
    const e = byId[ex.exerciseId];
    const muscle = e?.primaryMuscles[0];
    if (!muscle) continue;
    const sets = ex.sets.filter((s) => s.completed && s.type !== "warmup").length;
    if (sets) count.set(muscle, (count.get(muscle) ?? 0) + sets);
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (!top.length) return null;
  return top.map(([m]) => muscleText(MUSCLE_GROUP_LABELS[m], t)).join(" & ");
}
