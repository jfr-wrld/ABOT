import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Exercise } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";
import { newId } from "@/lib/id";

interface ExerciseState {
  custom: Exercise[];
  addCustom: (ex: Omit<Exercise, "id" | "isCustom">) => Exercise;
  updateCustom: (id: string, patch: Partial<Exercise>) => void;
  removeCustom: (id: string) => void;
}

export const useExerciseStore = create<ExerciseState>()(
  persist(
    (set) => ({
      custom: [],
      addCustom: (ex) => {
        const created: Exercise = { ...ex, id: `custom-${newId()}`, isCustom: true };
        set((s) => ({ custom: [...s.custom, created] }));
        return created;
      },
      updateCustom: (id, patch) =>
        set((s) => ({ custom: s.custom.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeCustom: (id) => set((s) => ({ custom: s.custom.filter((e) => e.id !== id) })),
    }),
    {
      name: "heavy.exercises",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

/** Seed + custom, as a list and as a lookup. Stable across renders for the same `custom`. */
export function useAllExercises() {
  const custom = useExerciseStore((s) => s.custom);
  const list = [...SEED_EXERCISES, ...custom].sort((a, b) => a.name.localeCompare(b.name));
  const byId: Record<string, Exercise> = {};
  for (const e of list) byId[e.id] = e;
  return { list, byId };
}
