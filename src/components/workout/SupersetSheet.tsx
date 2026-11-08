"use client";

import type { SessionExercise } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";

/** Pick the exercise to pair with. Rest then starts only after the last one of the pair. */
export function SupersetSheet({ item, name, onClose }: { item: SessionExercise; name: string; onClose: () => void }) {
  const exercises = useWorkoutStore((s) => s.active?.exercises ?? []);
  const link = useWorkoutStore((s) => s.linkSuperset);
  const { byId } = useAllExercises();
  const others = exercises.filter((e) => e.id !== item.id);
  return (
    <Sheet open onClose={onClose} title={`Superset ${name} with`}>
      <p className="mb-3 text-sm text-text-muted">
        Do one set of each back to back. The rest timer starts after the last exercise of the superset.
      </p>
      {others.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Add another exercise to the workout first.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {others.map((e) => {
            const ex = byId[e.exerciseId];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    link(item.id, e.id);
                    onClose();
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2 active:bg-ink/[0.08]"
                >
                  {ex && <ExerciseThumb exercise={ex} size={40} />}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{ex?.name ?? "Removed exercise"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
