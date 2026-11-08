import { memo, type CSSProperties } from "react";
import type { Exercise } from "@/types/workout";
import { regionLevels } from "@/components/anatomy/regions";
import { MUSCLE_SPRITE_ID } from "@/components/anatomy/MuscleSprite";

/**
 * A small front and back body with the muscles the exercise trains lit: primary in Volt,
 * secondary at 40%. Drawn from the shared body symbol (components/anatomy/MuscleSprite), so it
 * works offline and a long list stays light. The row's text already names the muscles, so the
 * thumbnail is decorative for screen readers.
 */
export const ExerciseThumb = memo(function ExerciseThumb({
  exercise,
  size = 48,
}: {
  exercise: Pick<Exercise, "primaryMuscles" | "secondaryMuscles">;
  size?: number;
}) {
  const levels = regionLevels(exercise.primaryMuscles, exercise.secondaryMuscles ?? []);
  const style: Record<string, string | number> = { width: size, height: size };
  for (const [region, level] of Object.entries(levels))
    style[`--m-${region}`] = level === "primary" ? "#ccff00" : "rgb(204 255 0 / 0.4)";
  return (
    <span
      data-thumb
      data-primary={exercise.primaryMuscles.join(" ")}
      aria-hidden="true"
      style={style as CSSProperties}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-black"
    >
      <svg viewBox="0 30 1448 1360" className="block h-auto w-full px-0.5">
        <use href={`#${MUSCLE_SPRITE_ID}`} />
      </svg>
    </span>
  );
});
