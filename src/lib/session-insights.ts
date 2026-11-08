import type { Exercise, MuscleGroup, PersonalRecord, WorkoutSession } from "@/types/workout";
import { detectSessionPRs, isWorkingSet } from "./calc";

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
  const records = detectSessionPRs(session, all, byId).filter((p) => before.has(p.exerciseId));
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
