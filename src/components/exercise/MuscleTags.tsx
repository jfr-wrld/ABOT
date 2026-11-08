"use client";

import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from "@/types/workout";
import { useT, type T } from "@/i18n";
import { muscleText } from "@/lib/home";

/** One muscle's label in the app language ("Back" goes through muscleText's own key). */
export function muscleLabel(m: MuscleGroup, t: T): string {
  return muscleText(MUSCLE_GROUP_LABELS[m], t);
}

/** Muscle names in the app language, joined: primaryMusclesLabel with translation. */
export function muscleNames(ms: MuscleGroup[], t: T, sep = " / "): string {
  return ms.map((m) => muscleLabel(m, t)).join(sep);
}

/**
 * The line under an exercise name: the primary muscle as a small hairline pill, then the
 * equipment as plain text. One pill per primary muscle, secondary muscles left out: enough to
 * scan a long list without it turning into a wall of badges.
 */
export function MuscleTags({ exercise }: { exercise: Pick<Exercise, "primaryMuscles" | "equipment"> }) {
  const t = useT();
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
      {exercise.primaryMuscles.map((m) => (
        <span key={m} className="shrink-0 rounded-full border border-ink/10 px-2 py-px leading-4">
          {muscleLabel(m, t)}
        </span>
      ))}
      <span aria-hidden="true">·</span>
      <span className="truncate">{t(EQUIPMENT_LABELS[exercise.equipment])}</span>
    </span>
  );
}
