"use client";

import { memo, useState } from "react";
import type { Exercise } from "@/types/workout";
import { BUNDLED_THUMBS } from "@/data/exercise-thumbs.generated";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";

/**
 * A photo of the exercise. Seed exercises use a 128 px thumbnail bundled with the app
 * (scripts/make-exercise-thumbs.py), so the library shows pictures offline. Catalog exercises
 * use their first free-exercise-db frame, loaded lazily, which needs a connection; custom
 * exercises and failed loads show the equipment icon instead. The row's text names the exercise, so the
 * picture is decorative for screen readers. A badge in the corner shows the equipment, the same
 * icon as the equipment filter, so the list can be scanned by tool as well as by movement.
 */
export const ExerciseThumb = memo(function ExerciseThumb({
  exercise,
  size = 48,
}: {
  exercise: Pick<Exercise, "id" | "media" | "equipment">;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const remote = exercise.media?.motionUrls?.[0];
  const src = BUNDLED_THUMBS.has(exercise.id)
    ? `/thumbs/${exercise.id}.webp`
    : remote && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(remote)
      ? remote
      : null;
  return (
    <span
      data-thumb
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-surface-2"
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export without the image optimizer; files are already 128 px
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
      {src && !failed && (
        <span
          data-equipment={exercise.equipment}
          className="absolute right-0 bottom-0 flex items-center justify-center rounded-tl-lg bg-black/80 text-accent"
          style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42) }}
        >
          <EquipmentIcon equipment={exercise.equipment} size={Math.round(size * 0.3)} />
        </span>
      )}
    </span>
  );
});
