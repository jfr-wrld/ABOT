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

/** The muscle a tap on a drawn region means. Shapes shared by two groups take the main one. */
const REGION_MUSCLE: Record<Region, MuscleGroup> = {
  chest: "chest",
  deltoids: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearm: "forearms",
  abs: "abs",
  obliques: "abs",
  trapezius: "traps",
  "upper-back": "back",
  "lower-back": "lower_back",
  gluteal: "glutes",
  quadriceps: "quads",
  hamstring: "hamstrings",
  adductors: "adductors",
  calves: "calves",
  tibialis: "calves",
  neck: "neck",
};

export function muscleForRegion(r: Region): MuscleGroup {
  return REGION_MUSCLE[r];
}

/**
 * Whether an exercise works the area of `muscle` on the body drawing. Groups drawn as one shape
 * count together (back and lats share the upper back; glutes and abductors the gluteal shape).
 * Full-body exercises match only "full body", not every muscle.
 */
export function worksArea(exerciseMuscles: MuscleGroup[], muscle: MuscleGroup): boolean {
  if (exerciseMuscles.includes(muscle)) return true;
  if (muscle === "full_body" || muscle === "cardio") return false;
  const area = new Set(MAP[muscle]);
  return exerciseMuscles.some((m) => m !== "full_body" && MAP[m].some((r) => area.has(r)));
}
