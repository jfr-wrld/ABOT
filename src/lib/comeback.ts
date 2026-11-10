import type { Routine, WorkoutSession } from "@/types/workout";

/** Days without a workout after which Home welcomes the lifter back. */
export const WELCOME_BACK_DAYS = 10;
/**
 * Past this, "repeat your last workout" no longer fits: the history is old (often imported from
 * another app), and Home's usual start is the better offer.
 */
export const WELCOME_BACK_MAX_DAYS = 90;
const DAY = 86_400_000;

/** A finished workout as a routine, so "Repeat" starts the same lifts with the same numbers. */
export function asRoutine(s: WorkoutSession): Routine {
  return {
    id: s.routineId ?? "",
    name: s.name,
    createdAt: s.startedAt,
    updatedAt: s.startedAt,
    exercises: s.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      ...(ex.supersetId ? { supersetId: ex.supersetId } : {}),
      ...(ex.variation ? { variation: ex.variation } : {}),
      sets: ex.sets.map((set) => ({ id: set.id, type: set.type, targetWeightKg: set.weightKg, targetReps: set.reps })),
    })),
  };
}

/**
 * The last workout and how long ago it was, once the gap reaches WELCOME_BACK_DAYS; null before
 * that or with no workouts. Coming back after a miss is the moment a nudge helps most
 * (Milkman et al. 2021), so Home offers to repeat it, and the Coach Pill starts lighter.
 */
export function comeback(sessions: WorkoutSession[], now = Date.now()): { last: WorkoutSession; days: number } | null {
  let last: WorkoutSession | null = null;
  for (const s of sessions) if (s.status === "completed" && (!last || s.startedAt > last.startedAt)) last = s;
  if (!last) return null;
  const days = Math.floor((now - (last.finishedAt ?? last.startedAt)) / DAY);
  return days >= WELCOME_BACK_DAYS && days <= WELCOME_BACK_MAX_DAYS ? { last, days } : null;
}

/**
 * The first workout after a gap of WELCOME_BACK_DAYS to WELCOME_BACK_MAX_DAYS, for the summary:
 * how many days the break lasted, or null.
 */
export function returnAfter(sessions: WorkoutSession[], session: WorkoutSession): number | null {
  let before: WorkoutSession | null = null;
  for (const s of sessions) {
    if (s.id === session.id || s.status !== "completed" || s.startedAt >= session.startedAt) continue;
    if (!before || s.startedAt > before.startedAt) before = s;
  }
  if (!before) return null;
  const days = Math.floor((session.startedAt - (before.finishedAt ?? before.startedAt)) / DAY);
  return days >= WELCOME_BACK_DAYS && days <= WELCOME_BACK_MAX_DAYS ? days : null;
}

const DISMISSED = "abot.welcome-back-dismissed";

/** "Not now" hides the card until the next workout (keyed to the last one). */
export function welcomeBackDismissed(lastId: string): boolean {
  try {
    return localStorage.getItem(DISMISSED) === lastId;
  } catch {
    return false;
  }
}

export function dismissWelcomeBack(lastId: string): void {
  try {
    localStorage.setItem(DISMISSED, lastId);
  } catch {
    // Storage blocked: the card shows again next time Home opens.
  }
}
