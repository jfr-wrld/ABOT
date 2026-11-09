import type { Exercise, Routine, WorkoutSession } from "@/types/workout";
import type { RepoSnapshot } from "@/data/repo/types";

/**
 * Mission Control's database health check over a snapshot of this device's data: references
 * that point nowhere and shapes the app would quietly ignore. It only reads; nothing is fixed
 * for you, because some of these (a deleted custom exercise in old workouts) are expected.
 */

export interface Finding {
  level: "ok" | "warn";
  code: "missing-exercise" | "routine-missing-exercise" | "lone-superset" | "missing-gym" | "empty-session" | "future-session" | "clean";
  text: string;
  count: number;
}

function loneSupersets(lists: { supersetId?: string }[][]): number {
  let n = 0;
  for (const list of lists) {
    const counts = new Map<string, number>();
    for (const e of list) if (e.supersetId) counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1);
    for (const c of counts.values()) if (c < 2) n++;
  }
  return n;
}

export function inspectSnapshot(snap: Pick<RepoSnapshot, "sessions" | "routines" | "locations">, known: Record<string, Exercise>, now = Date.now()): Finding[] {
  const out: Finding[] = [];
  const sessions: WorkoutSession[] = snap.sessions;
  const routines: Routine[] = snap.routines;
  const missing = new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)).filter((id) => !known[id]));
  if (missing.size) out.push({ level: "warn", code: "missing-exercise", count: missing.size, text: `Workouts use ${missing.size} exercise id(s) not in the library: ${[...missing].slice(0, 5).join(", ")}` });
  const rMissing = new Set(routines.flatMap((r) => r.exercises.map((e) => e.exerciseId)).filter((id) => !known[id]));
  if (rMissing.size) out.push({ level: "warn", code: "routine-missing-exercise", count: rMissing.size, text: `Routines use ${rMissing.size} exercise id(s) not in the library: ${[...rMissing].slice(0, 5).join(", ")}` });
  const lone = loneSupersets([...sessions.map((s) => s.exercises), ...routines.map((r) => r.exercises)]);
  if (lone) out.push({ level: "warn", code: "lone-superset", count: lone, text: `${lone} superset id(s) on a single exercise (shown as no superset)` });
  const gyms = new Set(snap.locations.map((l) => l.id));
  const noGym = sessions.filter((s) => s.locationId && !gyms.has(s.locationId)).length;
  if (noGym) out.push({ level: "warn", code: "missing-gym", count: noGym, text: `${noGym} workout(s) point to a gym that was removed` });
  const empty = sessions.filter((s) => s.status === "completed" && !s.exercises.some((e) => e.sets.some((x) => x.completed))).length;
  if (empty) out.push({ level: "warn", code: "empty-session", count: empty, text: `${empty} finished workout(s) with no ticked set` });
  const future = sessions.filter((s) => s.startedAt > now + 86_400_000).length;
  if (future) out.push({ level: "warn", code: "future-session", count: future, text: `${future} workout(s) dated more than a day ahead (phone clock?)` });
  if (out.length === 0) out.push({ level: "ok", code: "clean", count: 0, text: "No problems found" });
  return out;
}
