import { useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Exercise, ExerciseDraft } from "@/types/workout";
import { normalizeExercise } from "@/data/normalize";
import { buildExerciseIndex } from "@/lib/sets";
import { newId } from "@/lib/id";

interface ExerciseState {
  custom: Exercise[];
  addCustom: (ex: ExerciseDraft) => Exercise;
  updateCustom: (id: string, patch: Partial<ExerciseDraft>) => void;
  removeCustom: (id: string) => void;
}

export const useExerciseStore = create<ExerciseState>()(
  persist(
    (set) => ({
      custom: [],
      addCustom: (ex) => {
        const created = normalizeExercise({ ...ex, id: `custom-${newId()}`, isCustom: true });
        set((s) => ({ custom: [...s.custom, created] }));
        return created;
      },
      updateCustom: (id, patch) =>
        set((s) => ({ custom: s.custom.map((e) => (e.id === id ? normalizeExercise({ ...e, ...patch }) : e)) })),
      removeCustom: (id) => set((s) => ({ custom: s.custom.filter((e) => e.id !== id) })),
    }),
    {
      name: "heavy.exercises",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

/** Seed + custom, as a sorted list and an id lookup. Stable while `custom` is unchanged. */
export function useAllExercises() {
  const custom = useExerciseStore((s) => s.custom);
  return useMemo(() => buildExerciseIndex(custom), [custom]);
}
