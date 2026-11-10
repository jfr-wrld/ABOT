"use client";

import { memo, useState } from "react";
import type { Exercise } from "@/types/workout";
import { BUNDLED_THUMBS } from "@/data/exercise-thumbs.generated";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";

type ThumbExercise = Pick<Exercise, "id" | "name" | "category" | "equipment" | "primaryMuscles" | "media">;

/** The first still frame from free-exercise-db, if the exercise has one (never a video file). */
function remotePhotoOf(exercise: ThumbExercise): string | undefined {
  const url = exercise.media?.motionUrls?.[0];
  return url && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ? url : undefined;
}

/** The best photo of an exercise for a larger picture: bundled first (works offline), else online. */
export function exercisePhoto(exercise: ThumbExercise): string | undefined {
  if (BUNDLED_THUMBS.has(exercise.id)) return `/thumbs/${exercise.id}.webp`;
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  return online ? remotePhotoOf(exercise) : undefined;
}

/**
 * A picture of the movement, in order of preference:
 * 1. a 128 px photo bundled with the app (seed exercises; scripts/make-exercise-thumbs.py), so the
 *    library shows pictures offline;
 * 2. the exercise's free-exercise-db photo, loaded lazily, when online;
 * 3. a still from the app's own figure, mid-rep, worked muscles in Volt (no download; also the
 *    offline and failed-photo fallback);
 * 4. the equipment icon.
 * Over a photo, a corner badge shows the equipment, the same icon as the equipment filter, so the
 * list can be scanned by tool as well as by movement. The row's text names the exercise, so the
 * picture is decorative for screen readers. The box is fixed-size in every case, so rows never shift.
 */
export const ExerciseThumb = memo(function ExerciseThumb({ exercise, size = 48 }: { exercise: ThumbExercise; size?: number }) {
  const [failed, setFailed] = useState(false);
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const bundled = BUNDLED_THUMBS.has(exercise.id) ? `/thumbs/${exercise.id}.webp` : undefined;
  const remote = online ? remotePhotoOf(exercise) : undefined;
  const src = failed ? undefined : (bundled ?? remote);

  return (
    <span
      data-thumb={src ? "photo" : "icon"}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink/[0.06] bg-surface-2"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export without the image optimizer; files are already small
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="text-text-muted">
          <EquipmentIcon equipment={exercise.equipment} size={Math.round(size * 0.5)} />
        </span>
      )}
      {src && (
        <span
          data-equipment={exercise.equipment}
          className="force-dark absolute right-0 bottom-0 flex items-center justify-center rounded-tl-lg bg-black/80 text-accent"
          style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42) }}
        >
          <EquipmentIcon equipment={exercise.equipment} size={Math.round(size * 0.3)} />
        </span>
      )}
    </span>
  );
});
