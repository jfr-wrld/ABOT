import type { Exercise, MuscleGroup, PersonalRecord, WorkoutSession } from "@/types/workout";
import { isWorkingSet, recordsBeaten } from "./calc";
import { AXES, AXIS_MUSCLES, type Axis } from "./symmetry-analyzer";

/** Primary muscles by working sets, and secondary ones that were not also primary. */
export function workedMuscles(s: WorkoutSession, byId: Record<string, Exercise>): { primary: MuscleGroup[]; secondary: MuscleGroup[] } {
  const prim = new Map<MuscleGroup, number>();
  const sec = new Set<MuscleGroup>();
  for (const ex of s.exercises) {
    const n = ex.sets.filter(isWorkingSet).length;
    const def = byId[ex.exerciseId];
    if (!n || !def) continue;
    for (const m of def.primaryMuscles) prim.set(m, (prim.get(m) ?? 0) + n);
    for (const m of def.secondaryMuscles) sec.add(m);
  }
  const primary = [...prim.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  return { primary, secondary: [...sec].filter((m) => !prim.has(m)) };
}

export interface MuscleWork {
  /** Every muscle the working sets reached, most worked first; `primary` when it was a main muscle of any of them. */
  muscles: { muscle: MuscleGroup; sets: number; primary: boolean }[];
  /** Sets per balance axis; each set counts once per axis, at its strongest muscle there. */
  axes: Record<Axis, number>;
  dominant: Axis | null;
}

/**
 * How much each muscle has worked in one session, by the balance radar's rule
 * (lib/symmetry-analyzer): a working set counts 1 for its main muscles and 0.5 for its helpers.
 * Unlike that radar it reads a workout still running, so the live sheet can show it.
 */
export function muscleWork(s: WorkoutSession, byId: Record<string, Exercise>): MuscleWork {
  const sets = new Map<MuscleGroup, number>();
  const main = new Set<MuscleGroup>();
  const axes = Object.fromEntries(AXES.map((a) => [a, 0])) as Record<Axis, number>;
  for (const ex of s.exercises) {
    const def = byId[ex.exerciseId];
    const n = ex.sets.filter(isWorkingSet).length;
    if (!def || !n) continue;
    const weight = new Map<MuscleGroup, number>();
    for (const m of def.secondaryMuscles) weight.set(m, 0.5);
    for (const m of def.primaryMuscles) {
      weight.set(m, 1);
      main.add(m);
    }
    for (const [m, w] of weight) sets.set(m, (sets.get(m) ?? 0) + w * n);
    const full = weight.has("full_body");
    for (const a of AXES) axes[a] += n * Math.max(full ? 0.5 : 0, ...AXIS_MUSCLES[a].map((m) => weight.get(m) ?? 0));
  }
  const muscles = [...sets.entries()]
    .map(([muscle, n]) => ({ muscle, sets: n, primary: main.has(muscle) }))
    .sort((a, b) => b.sets - a.sets || Number(b.primary) - Number(a.primary));
  const top = Math.max(0, ...AXES.map((a) => axes[a]));
  const dominant = top > 0 ? AXES.find((a) => axes[a] === top)! : null;
  return { muscles, axes, dominant };
}

/**
 * The records a session set, split honestly: `records` beat an earlier best of a lift logged
 * before; `newLifts` are lifts logged for the first time, which beat nothing yet.
 */
export function sessionRecords(
  session: WorkoutSession,
  all: WorkoutSession[],
  byId?: Record<string, Exercise>,
): { records: PersonalRecord[]; newLifts: string[] } {
  const before = new Set(
    all
      .filter((o) => o.status === "completed" && o.id !== session.id && o.startedAt < session.startedAt)
      .flatMap((o) => o.exercises.map((e) => e.exerciseId)),
  );
  const records = recordsBeaten(session, all, byId);
  const newLifts = [
    ...new Set(session.exercises.filter((e) => e.sets.some(isWorkingSet) && !before.has(e.exerciseId)).map((e) => e.exerciseId)),
  ];
  return { records, newLifts };
}

/** The last finished session before this one from the same routine (or, without one, the same name). */
export function previousComparable(session: WorkoutSession, all: WorkoutSession[]): WorkoutSession | null {
  const same = (o: WorkoutSession) => (session.routineId ? o.routineId === session.routineId : o.name === session.name);
  return (
    all
      .filter((o) => o.status === "completed" && o.id !== session.id && o.startedAt < session.startedAt && same(o))
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  );
}
