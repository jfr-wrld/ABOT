import type { Exercise } from "@/types/workout";
import { normalizeExercise } from "./normalize";
import { exerciseKey } from "./exerciseKey.mjs";

/**
 * The extended library from Open Exercise Atlas (scripts/build-atlas-catalog.mjs): machines,
 * cables, variations and cardio the seed library does not have. It ships with the app, images
 * included, and loads in its own chunk after start, so it works offline and does not slow the
 * first screen. Rows count as catalog exercises: logging one copies it into the lifter's own list
 * (useExerciseStore.adopt), so history never depends on this file.
 */

export const isAtlas = (e: Pick<Exercise, "id">) => e.id.startsWith("atlas-");

export async function loadAtlas(): Promise<Exercise[]> {
  const { ATLAS_INPUTS } = await import("./atlas-catalog.generated");
  return ATLAS_INPUTS.map((row) => ({ ...normalizeExercise(row), isCatalog: true }));
}

/**
 * The Atlas plus the optional free-exercise-db download, without the download's copies of an
 * Atlas exercise (same equipment and name words): the Atlas row is the newer one.
 */
export function mergeCatalogs(atlas: Exercise[], downloaded: Exercise[]): Exercise[] {
  if (atlas.length === 0) return downloaded;
  const keys = new Set(atlas.map((e) => exerciseKey(e.name, e.equipment)));
  return [...atlas, ...downloaded.filter((e) => !keys.has(exerciseKey(e.name, e.equipment)))];
}
