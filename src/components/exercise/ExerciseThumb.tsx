"use client";

import { memo, useState } from "react";
import { Dumbbell } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { patternFor } from "@/components/motion/patterns";
import { MotionScene } from "@/components/motion/MotionFigure";

type ThumbExercise = Pick<Exercise, "id" | "name" | "category" | "equipment" | "primaryMuscles" | "media">;

/** The first still frame from free-exercise-db, if the exercise has one (never a video file). */
function photoOf(exercise: ThumbExercise): string | undefined {
  const url = exercise.media?.motionUrls?.[0];
  return url && /\.(jpe?g|png|webp)$/i.test(url) ? url : undefined;
}

/**
 * A 44px picture of the movement. Order of preference:
 * 1. the exercise's photo (free-exercise-db), loaded lazily so only rows on screen fetch;
 * 2. a still from the app's own figure, mid-rep, worked muscles in Volt (no download; also the
 *    offline and failed-photo fallback);
 * 3. an equipment glyph for the few movements neither covers.
 * The box is fixed-size and hairline-bordered in every case, so rows never shift.
 */
export const ExerciseThumb = memo(function ExerciseThumb({ exercise, size = 44 }: { exercise: ThumbExercise; size?: number }) {
  const photo = photoOf(exercise);
  const [failed, setFailed] = useState(false);
  const showPhoto = photo && !failed && (typeof navigator === "undefined" || navigator.onLine !== false);
  const pattern = showPhoto ? null : patternFor(exercise);
  return (
    <span
      data-thumb={showPhoto ? "photo" : pattern ? "figure" : "icon"}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black"
    >
      {showPhoto ? (
        // A plain <img>: tiny, lazy and cached by the browser; next/image would add a server route.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover opacity-90"
        />
      ) : pattern ? (
        <span className="block w-full p-0.5">
          <MotionScene pattern={pattern} progress={0.55} exercise={exercise} fit />
        </span>
      ) : (
        <Dumbbell size={size * 0.42} strokeWidth={1.75} className="text-zinc-500" />
      )}
    </span>
  );
});
