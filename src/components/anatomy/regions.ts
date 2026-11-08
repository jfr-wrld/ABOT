import type { MuscleGroup } from "@/types/workout";

/** Muscle regions of the vendored anatomical body (react-muscle-highlighter slugs). */
export const REGIONS = [
  "chest", "deltoids", "biceps", "triceps", "forearm", "abs", "obliques", "trapezius", "upper-back",
  "lower-back", "gluteal", "quadriceps", "hamstring", "adductors", "calves", "tibialis", "neck",
] as const;
export type Region = (typeof REGIONS)[number];

/**
 * The drawing has one deltoid per side and no separate lats (they are part of upper-back),
 * so shoulders and lats light those shapes. Abductors have no own shape and use the glutes.
 */
const MAP: Record<MuscleGroup, readonly Region[]> = {
  chest: ["chest"],
  back: ["upper-back"],
  lats: ["upper-back"],
  traps: ["trapezius"],
  shoulders: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  abs: ["abs", "obliques"],
  quads: ["quadriceps"],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves", "tibialis"],
  lower_back: ["lower-back"],
  adductors: ["adductors"],
  abductors: ["gluteal"],
  neck: ["neck"],
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
