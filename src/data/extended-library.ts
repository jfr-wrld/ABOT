import type { Exercise } from "@/types/workout";
import { normalizeExercise } from "./normalize";
import { mapCatalogEntry } from "./catalog";
import { SEED_EXERCISES } from "./exercises";

/**
 * The library beyond the seed exercises, shipped with the app and loaded in its own chunks after
 * start, so it works offline without slowing the first screen:
 * - free-exercise-db (scripts/build-fedb-library.mjs): the main part, each with start and end
 *   photos, the same look as the seed list;
 * - Open Exercise Atlas (scripts/build-atlas-catalog.mjs): only what free-exercise-db lacks, such
 *   as newer machines and cable variations, without pictures (the tool icon and muscle map stand in).
 * Rows count as catalog exercises: logging one copies it into the lifter's own list
 * (useExerciseStore.adopt), so history never depends on these files.
 */

export const isAtlas = (e: Pick<Exercise, "id">) => e.id.startsWith("atlas-");

export async function loadExtendedLibrary(): Promise<Exercise[]> {
  const [{ FEDB_ROWS }, { ATLAS_INPUTS }] = await Promise.all([import("./fedb-library.generated"), import("./atlas-catalog.generated")]);
  const seedSources = new Set(SEED_EXERCISES.map((e) => e.sourceId).filter((x): x is string => !!x));
  const fedb = FEDB_ROWS.map((r) => mapCatalogEntry(r, seedSources)).filter((x): x is Exercise => x !== null);
  const atlas = ATLAS_INPUTS.map((row) => ({ ...normalizeExercise(row), isCatalog: true }));
  return [...fedb, ...atlas];
}

/** Rows stored by the old "Load full exercise catalog" download that the built-in library already has. */
export function withoutBuiltIn(extended: Exercise[], downloaded: Exercise[]): Exercise[] {
  if (extended.length === 0) return downloaded;
  const ids = new Set(extended.map((e) => e.id));
  return [...extended, ...downloaded.filter((e) => !ids.has(e.id))];
}
