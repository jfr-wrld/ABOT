import { create } from "zustand";
import type { Routine, RoutineExercise, RoutineSet } from "@/types/workout";
import { newId } from "@/lib/id";

interface RoutineState {
  routines: Routine[];
  create: (name: string, folder?: string) => Routine;
  update: (id: string, patch: Partial<Pick<Routine, "name" | "folder">>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => Routine | null;
  setExercises: (id: string, exercises: RoutineExercise[]) => void;
}

export function newRoutineSet(partial: Partial<RoutineSet> = {}): RoutineSet {
  return { id: newId(), type: "normal", targetWeightKg: null, targetReps: null, ...partial };
}

export function newRoutineExercise(exerciseId: string, restSeconds: number): RoutineExercise {
  return {
    id: newId(),
    exerciseId,
    restSeconds,
    sets: [newRoutineSet(), newRoutineSet(), newRoutineSet()],
  };
}

export const useRoutineStore = create<RoutineState>()(
    (set, get) => ({
      routines: [],
      create: (name, folder) => {
        const now = Date.now();
        const r: Routine = { id: newId(), name, folder, exercises: [], createdAt: now, updatedAt: now };
        set((s) => ({ routines: [...s.routines, r] }));
        return r;
      },
      update: (id, patch) =>
        set((s) => ({
          routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)),
        })),
      remove: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      duplicate: (id) => {
        const src = get().routines.find((r) => r.id === id);
        if (!src) return null;
        const now = Date.now();
        const copy: Routine = {
          ...src,
          id: newId(),
          name: `${src.name} (copy)`,
          createdAt: now,
          updatedAt: now,
          exercises: src.exercises.map((e) => ({
            ...e,
            id: newId(),
            sets: e.sets.map((st) => ({ ...st, id: newId() })),
          })),
        };
        set((s) => ({ routines: [...s.routines, copy] }));
        return copy;
      },
      setExercises: (id, exercises) =>
        set((s) => ({
          routines: s.routines.map((r) => (r.id === id ? { ...r, exercises, updatedAt: Date.now() } : r)),
        })),
    }),
);
