"use client";

import { memo, useState } from "react";
import type { Exercise } from "@/types/workout";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import { localPhoto, remotePhotoOf } from "@/lib/exercise-photo";
import { MuscleIcon } from "@/components/icons/MuscleIcon";

export { bundledThumb, exercisePhoto } from "@/lib/exercise-photo";

type ThumbExercise = Pick<Exercise, "id" | "name" | "category" | "equipment" | "primaryMuscles" | "media">;

/**
 * A picture of the movement, in order of preference:
 * 1. a 128 px photo bundled with the app (seed exercises, scripts/make-exercise-thumbs.py; the
 *    free-exercise-db library, scripts/build-fedb-library.mjs), or the start photo the lifter
 *    added to their own exercise, so the library shows photos offline;
 * 2. the exercise's own free-exercise-db photo, loaded lazily, when online;
 * 3. the body with the exercise's main muscle lit (also the offline and failed-photo fallback).
 * Over a photo, a corner badge shows the equipment, the same icon as the equipment filter, so the
 * list can be scanned by tool as well as by movement. The row's text names the exercise, so the
 * picture is decorative for screen readers. The box is fixed-size in every case, so rows never shift.
 * `badge` fixes the badge's size in px, for a thumb stretched past `size` (the grid tiles), where a
 * badge in proportion to 128 px would cover a third of the photo.
 */
export const ExerciseThumb = memo(function ExerciseThumb({ exercise, size = 48, badge }: { exercise: ThumbExercise; size?: number; badge?: number }) {
  const [failed, setFailed] = useState(false);
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const bundled = localPhoto(exercise);
  const badgeBox = badge ?? Math.round(size * 0.42);
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
        // No photo: the body with the muscle it trains lit, so the row still shows what it is for.
        <MuscleIcon muscle={exercise.primaryMuscles[0]} size={Math.round(size * 0.82)} />
      )}
      {src && (
        <span
          data-equipment={exercise.equipment}
          className="force-dark absolute right-0 bottom-0 flex items-center justify-center rounded-tl-lg bg-black/80 text-accent"
          style={{ width: badgeBox, height: badgeBox }}
        >
          <EquipmentIcon equipment={exercise.equipment} size={badge ? Math.round(badge * 0.62) : Math.round(size * 0.3)} />
        </span>
      )}
    </span>
  );
});
