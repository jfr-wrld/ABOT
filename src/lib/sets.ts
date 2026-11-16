import type { Exercise, SetType } from "@/types/workout";

/** Display numbers for a list of sets: warm-ups get none, every other set counts 1, 2, 3. */
export function setNumbers(sets: { type: SetType }[]): (number | null)[] {
  let n = 0;
  return sets.map((s) => (s.type === "warmup" ? null : ++n));
}

/**
 * The built-in library (`seed`, see useExerciseStore.loadSeed), then exercises the user owns (custom and adopted catalog copies), then catalog
 * entries not already owned. An owned copy wins over the catalog row with the same id.
 */
export function buildExerciseIndex(
  seed: Exercise[],
  custom: Exercise[],
  catalog: Exercise[] = [],
): { list: Exercise[]; byId: Record<string, Exercise> } {
  const owned = new Set(custom.map((e) => e.id));
  const list = [...seed, ...custom, ...catalog.filter((e) => !owned.has(e.id))].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const byId: Record<string, Exercise> = {};
  for (const e of list) byId[e.id] = e;
  return { list, byId };
}
