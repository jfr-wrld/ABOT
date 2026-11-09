import type { Exercise, MuscleGroup, Routine, RoutineSet } from "@/types/workout";

/** A planned set that counts as work: anything but a warm-up. */
const planned = (s: RoutineSet) => s.type !== "warmup";
import { focusOf, type Focus } from "./training-focus";

export interface RoutineLine {
  exerciseId: string;
  /** Working sets planned (warm-ups left out). */
  sets: number;
  /** "8", "8-12", or null when no target reps are set. */
  reps: string | null;
  superset: boolean;
}

export interface RoutineSummary {
  focus: Focus | null;
  /** Rough length in minutes, rounded to 5, by the same rule as the Template Vault. */
  minutes: number;
  /** Most worked muscles by planned sets, most first, at most three. */
  muscles: MuscleGroup[];
  sets: number;
  lines: RoutineLine[];
}

/**
 * What a saved routine holds, read the way a Template Vault card reads a template: its focus,
 * its rough length, the muscles it works and each lift as sets x reps.
 */
export function routineSummary(r: Routine, byId: Record<string, Exercise>): RoutineSummary {
  const perMuscle = new Map<MuscleGroup, number>();
  let sec = 5 * 60;
  let sets = 0;
  const lines: RoutineLine[] = r.exercises.map((e) => {
    const working = e.sets.filter(planned);
    const n = working.length;
    sets += e.sets.length;
    sec += e.sets.length * (45 + e.restSeconds) + 60;
    for (const m of byId[e.exerciseId]?.primaryMuscles ?? []) perMuscle.set(m, (perMuscle.get(m) ?? 0) + n);
    const reps = working.map((s) => s.targetReps).filter((x): x is number => x !== null && x > 0);
    const lo = Math.min(...reps);
    const hi = Math.max(...reps);
    return { exerciseId: e.exerciseId, sets: n, reps: reps.length === 0 ? null : lo === hi ? String(lo) : `${lo}-${hi}`, superset: Boolean(e.supersetId) };
  });
  return {
    focus: focusOf(r.exercises.map((e) => ({ muscles: byId[e.exerciseId]?.primaryMuscles ?? [], sets: e.sets.filter(planned).length }))),
    minutes: r.exercises.length === 0 ? 0 : Math.max(5, Math.round(sec / 60 / 5) * 5),
    muscles: [...perMuscle.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m),
    sets,
    lines,
  };
}
