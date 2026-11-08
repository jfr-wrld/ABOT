import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, type Exercise } from "@/types/workout";

/**
 * The line under an exercise name: the primary muscle as a small hairline pill, then the
 * equipment as plain text. One pill per primary muscle, secondary muscles left out: enough to
 * scan a long list without it turning into a wall of badges.
 */
export function MuscleTags({ exercise }: { exercise: Pick<Exercise, "primaryMuscles" | "equipment"> }) {
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
      {exercise.primaryMuscles.map((m) => (
        <span key={m} className="shrink-0 rounded-full border border-white/10 px-2 py-px leading-4">
          {MUSCLE_GROUP_LABELS[m]}
        </span>
      ))}
      <span aria-hidden="true">·</span>
      <span className="truncate">{EQUIPMENT_LABELS[exercise.equipment]}</span>
    </span>
  );
}
