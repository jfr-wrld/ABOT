import { useMemo } from "react";
import { create } from "zustand";
import type { Exercise, ExerciseDraft } from "@/types/workout";
import { normalizeExercise } from "@/data/normalize";
import { buildExerciseIndex } from "@/lib/sets";
import { newId } from "@/lib/id";
import { loadExtendedLibrary, withoutBuiltIn } from "@/data/extended-library";

interface ExerciseState {
  /** Custom exercises plus catalog exercises the user has logged (persisted, backed up). */
  custom: Exercise[];
  /** The optional downloaded catalog (stored separately, not backed up). */
  catalog: Exercise[];
  setCatalog: (rows: Exercise[]) => void;
  /** The extended library that ships with the app (data/extended-library); empty until it loads. */
  extended: Exercise[];
  /** True once loading the extended library has finished, loaded or not. */
  extendedTried: boolean;
  loadExtended: () => Promise<void>;
  /** Videos the user pasted per exercise; works for seed exercises too. */
  mediaOverrides: Record<string, { customVideoUrl: string }>;
  setCustomVideo: (exerciseId: string, url: string | null) => void;
  /** Keeps a copy of a catalog exercise once it is used, so history and backups keep its name. */
  adopt: (e: Exercise) => void;
  addCustom: (ex: ExerciseDraft) => Exercise;
  updateCustom: (id: string, patch: Partial<ExerciseDraft>) => void;
  removeCustom: (id: string) => void;
}

export const useExerciseStore = create<ExerciseState>()(
    (set) => ({
      custom: [],
      catalog: [],
      setCatalog: (catalog) => set({ catalog }),
      extended: [],
      extendedTried: false,
      loadExtended: async () => {
        if (useExerciseStore.getState().extended.length > 0) return;
        try {
          set({ extended: await loadExtendedLibrary() });
        } catch {
          // A chunk that fails to load (an old cached page after an update) leaves the seed
          // library and any downloaded catalog; the next start tries again.
        } finally {
          set({ extendedTried: true });
        }
      },
      mediaOverrides: {},
      setCustomVideo: (id, url) =>
        set((s) => {
          const next = { ...s.mediaOverrides };
          if (url) next[id] = { customVideoUrl: url };
          else delete next[id];
          return { mediaOverrides: next };
        }),
      adopt: (e) => {
        if (!e.isCatalog) return;
        set((s) => (s.custom.some((c) => c.id === e.id) ? s : { custom: [...s.custom, e] }));
      },
      addCustom: (ex) => {
        const created = normalizeExercise({ ...ex, id: `custom-${newId()}`, isCustom: true });
        set((s) => ({ custom: [...s.custom, created] }));
        return created;
      },
      updateCustom: (id, patch) =>
        set((s) => ({ custom: s.custom.map((e) => (e.id === id ? normalizeExercise({ ...e, ...patch }) : e)) })),
      removeCustom: (id) => set((s) => ({ custom: s.custom.filter((e) => e.id !== id) })),
    }),
);

/** Seed + custom, as a sorted list and an id lookup. Stable while `custom` is unchanged. */
/**
 * One index for the whole app, rebuilt only when the custom or catalog lists change. Built per
 * component before, so a workout with eight cards sorted about 1,000 exercises eight times.
 */
let cached: { custom: unknown; catalog: unknown; extended: unknown; index: ReturnType<typeof buildExerciseIndex> } | null = null;
function sharedIndex(custom: Exercise[], catalog: Exercise[], extended: Exercise[]) {
  if (!cached || cached.custom !== custom || cached.catalog !== catalog || cached.extended !== extended) {
    cached = { custom, catalog, extended, index: buildExerciseIndex(custom, withoutBuiltIn(extended, catalog)) };
  }
  return cached.index;
}

export function useAllExercises() {
  const custom = useExerciseStore((s) => s.custom);
  const catalog = useExerciseStore((s) => s.catalog);
  const extended = useExerciseStore((s) => s.extended);
  return useMemo(() => sharedIndex(custom, catalog, extended), [custom, catalog, extended]);
}

/** One exercise by id, outside React (seed, extended library or custom); undefined when unknown. */
export function exerciseById(id: string): Exercise | undefined {
  const { custom, catalog, extended } = useExerciseStore.getState();
  return sharedIndex(custom, catalog, extended).byId[id];
}
