import type { MuscleGroup } from "@/types/workout";

/** The 16 drawable regions of the front/back body map. */
export const REGIONS = [
  "chest", "front_delts", "side_delts", "rear_delts", "biceps", "triceps", "forearms", "abs",
  "obliques", "lats", "traps", "lower_back", "glutes", "quads", "hamstrings", "calves",
] as const;
export type Region = (typeof REGIONS)[number];

/**
 * Muscle groups in the data model are coarser or different from what is drawn: "back" (mid
 * back) has no own region and lights traps and lats; inner/outer thigh map to quads/glutes.
 */
const MAP: Record<MuscleGroup, readonly Region[]> = {
  chest: ["chest"],
  back: ["traps", "lats"],
  lats: ["lats"],
  traps: ["traps"],
  shoulders: ["front_delts", "side_delts", "rear_delts"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearms"],
  abs: ["abs", "obliques"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes"],
  calves: ["calves"],
  lower_back: ["lower_back"],
  adductors: ["quads"],
  abductors: ["glutes"],
  neck: ["traps"],
  full_body: REGIONS,
  cardio: [],
};

export function regionsFor(m: MuscleGroup): Region[] {
  return [...MAP[m]];
}

export type Level = "primary" | "secondary";

export function regionLevels(primary: MuscleGroup[], secondary: MuscleGroup[]): Partial<Record<Region, Level>> {
  const out: Partial<Record<Region, Level>> = {};
  for (const m of secondary) for (const r of MAP[m]) out[r] = "secondary";
  for (const m of primary) for (const r of MAP[m]) out[r] = "primary";
  return out;
}
