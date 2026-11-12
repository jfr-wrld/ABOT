import type { Equipment, Exercise, ExerciseCategory, MuscleGroup } from "@/types/workout";
import { normalizeExercise } from "./normalize";
import { cleanSteps } from "./cleanSteps.mjs";
import { FEDB_COMMIT } from "./fedb-commit";
import { tidyName } from "./exerciseName.mjs";

/**
 * free-exercise-db (public domain, Unlicense) rows as an ABOT exercise. The rows ship with the
 * app (scripts/build-fedb-library.mjs); their photos load from the same pinned commit, so a later
 * change to that repository reaches the app only when ABOT moves the pin.
 */
export const FEDB_IMAGE_BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FEDB_COMMIT}/exercises/`;

const EQUIPMENT: Record<string, Equipment> = {
  barbell: "barbell",
  "e-z curl bar": "barbell",
  dumbbell: "dumbbell",
  cable: "cable",
  machine: "machine",
  kettlebells: "kettlebell",
  bands: "band",
  "body only": "bodyweight",
};

const MUSCLES: Record<string, MuscleGroup> = {
  abdominals: "abs",
  abductors: "abductors",
  adductors: "adductors",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  "lower back": "lower_back",
  "middle back": "back",
  neck: "neck",
  quadriceps: "quads",
  shoulders: "shoulders",
  traps: "traps",
  triceps: "triceps",
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const toMuscles = (v: unknown): MuscleGroup[] =>
  Array.isArray(v) ? [...new Set(v.map((m) => MUSCLES[String(m)]).filter((m): m is MuscleGroup => !!m))] : [];

/**
 * One dataset row to an ABOT exercise, or null when it is already a seed exercise or has no
 * name or recognisable primary muscle. Stretches without equipment count as bodyweight.
 */
export function mapCatalogEntry(raw: unknown, seedSourceIds: Set<string>): Exercise | null {
  if (!isObj(raw)) return null;
  const sourceId = typeof raw.id === "string" ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!sourceId || !name || seedSourceIds.has(sourceId)) return null;
  const primaryMuscles = toMuscles(raw.primaryMuscles);
  if (primaryMuscles.length === 0) return null;
  const equipment: Equipment =
    raw.equipment === null || raw.equipment === undefined ? "bodyweight" : (EQUIPMENT[String(raw.equipment)] ?? "other");
  const category: ExerciseCategory =
    raw.category === "cardio"
      ? "cardio"
      : raw.category === "stretching"
        ? "mobility"
        : raw.mechanic === "isolation"
          ? "isolation"
          : "compound";
  const images = Array.isArray(raw.images) ? raw.images.filter((i): i is string => typeof i === "string") : [];
  return {
    ...normalizeExercise({
      id: `fedb-${sourceId}`,
      // The dataset says "Barbell Bench Press - Medium Grip"; the library reads "Bench Press, Medium Grip (Barbell)".
      name: tidyName(name, equipment, category),
      equipment,
      primaryMuscles,
      secondaryMuscles: toMuscles(raw.secondaryMuscles).filter((m) => !primaryMuscles.includes(m)),
      isBodyweight: equipment === "bodyweight" ? true : undefined,
      category,
      instructions: cleanSteps(raw.instructions),
      formCues: [],
      media: images.length ? { motionUrls: images.slice(0, 2).map((i) => FEDB_IMAGE_BASE + i) } : {},
      sourceId,
    }),
    isCatalog: true,
  };
}
