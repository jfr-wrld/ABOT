import type { Equipment, Exercise, ExerciseCategory, MuscleGroup } from "@/types/workout";
import { normalizeExercise } from "./normalize";
import { cleanSteps } from "./cleanSteps.mjs";
import type { Repository } from "./repo";
import { SEED_EXERCISES } from "./exercises";

/** free-exercise-db (public domain, Unlicense): about 870 exercises, roughly 1 MB of JSON. */
// Pinned to a commit: a later change to that repository reaches the app only when ABOT moves the pin.
const CATALOG_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
export const CATALOG_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${CATALOG_COMMIT}/dist/exercises.json`;
/** The catalog is about 1 MB; anything far larger is not it. */
const CATALOG_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

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
      name,
      equipment,
      primaryMuscles,
      secondaryMuscles: toMuscles(raw.secondaryMuscles).filter((m) => !primaryMuscles.includes(m)),
      isBodyweight: equipment === "bodyweight" ? true : undefined,
      category,
      instructions: cleanSteps(raw.instructions),
      formCues: [],
      media: images.length ? { motionUrls: images.slice(0, 2).map((i) => IMAGE_BASE + i) } : {},
      sourceId,
    }),
    isCatalog: true,
  };
}

/**
 * Downloads the catalog, maps it, and replaces the stored catalog in one transaction. On any
 * failure the stored catalog is left as it was and the error says what to do.
 */
export async function loadCatalog(
  fetchFn: (url: string) => Promise<Response>,
  repo: Repository,
  seedSourceIds: Set<string> = new Set(SEED_EXERCISES.map((e) => e.sourceId).filter((x): x is string => !!x)),
): Promise<Exercise[]> {
  let res: Response;
  try {
    res = await fetchFn(CATALOG_URL);
  } catch {
    throw new Error("Could not download the catalog. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`Could not download the catalog (HTTP ${res.status}). Check your connection and try again.`);
  if (Number(res.headers?.get("content-length") ?? 0) > CATALOG_MAX_BYTES) throw new Error("The catalog file was not in the expected format.");
  let data: unknown;
  try {
    const text = await res.text();
    if (text.length > CATALOG_MAX_BYTES) throw new Error("too large");
    data = JSON.parse(text);
  } catch {
    throw new Error("The catalog file was not in the expected format.");
  }
  if (!Array.isArray(data)) throw new Error("The catalog file was not in the expected format.");
  const rows = data.map((d) => mapCatalogEntry(d, seedSourceIds)).filter((x): x is Exercise => x !== null);
  await repo.catalog.replaceAll(rows);
  return rows;
}
