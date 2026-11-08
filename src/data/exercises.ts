import type { Exercise } from "@/types/workout";
import { normalizeExercise } from "./normalize";
import { SEED_INPUTS } from "./seed-exercises.generated";

/**
 * Built-in exercise library (seeded from free-exercise-db, see scripts/generate-seed.mjs).
 * Ids are stable slugs: never rename them, workout history references them.
 */
export const SEED_EXERCISES: Exercise[] = SEED_INPUTS.map(normalizeExercise);

export const SEED_EXERCISES_BY_ID: Record<string, Exercise> = Object.fromEntries(
  SEED_EXERCISES.map((e) => [e.id, e]),
);
