import { memo } from "react";
import { Dumbbell } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { patternFor } from "@/components/motion/patterns";
import { MotionScene } from "@/components/motion/MotionFigure";

/**
 * A still of the movement, mid-rep, drawn from the same figure as the Motion tab: works offline,
 * costs no download, and the worked segments light up in Volt. Movements the side view cannot
 * show (a few rotations and hip ab/adduction) get an equipment glyph instead.
 */
export const ExerciseThumb = memo(function ExerciseThumb({
  exercise,
  size = 48,
}: {
  exercise: Pick<Exercise, "id" | "name" | "category" | "equipment" | "primaryMuscles">;
  size?: number;
}) {
  const pattern = patternFor(exercise);
  return (
    <span
      data-thumb
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-black"
    >
      {pattern ? (
        <span className="block w-full p-0.5">
          <MotionScene pattern={pattern} progress={0.55} exercise={exercise} fit />
        </span>
      ) : (
        <Dumbbell size={size * 0.42} className="text-text-muted" />
      )}
    </span>
  );
});
