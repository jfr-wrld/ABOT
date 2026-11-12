import type { WorkoutSession } from "@/types/workout";

/**
 * What the lifter has actually done, from finished workouts: how often each exercise came up,
 * when it was last done, and the most recent ones. Feeds the picker's Recent list and the
 * library's "Most used" and "Last done" orders.
 */

export interface ExerciseUsage {
  /** Finished workouts each exercise was in. */
  uses: Record<string, number>;
  /** When each exercise was last in a finished workout. */
  lastDone: Record<string, number>;
}

const finished = (s: WorkoutSession) => s.status === "completed";
const doneAt = (s: WorkoutSession) => s.finishedAt ?? s.startedAt;

export function exerciseUsage(sessions: WorkoutSession[]): ExerciseUsage {
  const uses: Record<string, number> = {};
  const lastDone: Record<string, number> = {};
  for (const s of sessions) {
    if (!finished(s)) continue;
    const at = doneAt(s);
    for (const id of new Set(s.exercises.map((x) => x.exerciseId))) {
      uses[id] = (uses[id] ?? 0) + 1;
      if (at > (lastDone[id] ?? 0)) lastDone[id] = at;
    }
  }
  return { uses, lastDone };
}

/** Up to `n` exercise ids, most recently done first, each once. */
export function recentExercises(sessions: WorkoutSession[], n: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of sessions.filter(finished).sort((a, b) => doneAt(b) - doneAt(a))) {
    for (const x of s.exercises) {
      if (seen.has(x.exerciseId)) continue;
      seen.add(x.exerciseId);
      out.push(x.exerciseId);
      if (out.length >= n) return out;
    }
  }
  return out;
}
