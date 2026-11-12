import type { Exercise } from "@/types/workout";
import { BUNDLED_THUMBS } from "@/data/exercise-thumbs.generated";

type PhotoExercise = Pick<Exercise, "id" | "media">;

/** The first still frame from free-exercise-db, if the exercise has one (never a video file). */
export function remotePhotoOf(exercise: PhotoExercise): string | undefined {
  const url = exercise.media?.motionUrls?.[0];
  return url && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ? url : undefined;
}

/**
 * The 128 px photo that ships with the app: seed exercises in /thumbs, free-exercise-db ones in
 * /thumbs/fedb. A free-exercise-db row without images has no file, so it gets none.
 */
export function bundledThumb(exercise: PhotoExercise): string | undefined {
  if (BUNDLED_THUMBS.has(exercise.id)) return `/thumbs/${exercise.id}.webp`;
  return exercise.id.startsWith("fedb-") && remotePhotoOf(exercise) ? `/thumbs/fedb/${exercise.id.slice(5)}.webp` : undefined;
}

/**
 * Whether the exercise has a real photo of the movement that works offline. The lists browse
 * only these; the rest (Atlas machines, a few without pictures) are found by searching.
 */
export function hasPhoto(exercise: PhotoExercise): boolean {
  return bundledThumb(exercise) !== undefined;
}

/** The best photo of an exercise for a larger picture: bundled first (works offline), else online. */
export function exercisePhoto(exercise: PhotoExercise): string | undefined {
  const bundled = bundledThumb(exercise);
  if (bundled) return bundled;
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  return online ? remotePhotoOf(exercise) : undefined;
}
