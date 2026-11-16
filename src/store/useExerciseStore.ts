import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { Exercise, ExerciseDraft } from "@/types/workout";
import { normalizeExercise } from "@/data/normalize";
import { buildExerciseIndex } from "@/lib/sets";
import { newId } from "@/lib/id";
import { loadExtendedLibrary, withoutBuiltIn } from "@/data/extended-library";

let extendedLoading: Promise<void> | null = null;

interface ExerciseState {
  /** The built-in library (data/exercises); empty until loadSeed, which startApp awaits. */
  seed: Exercise[];
  loadSeed: () => Promise<void>;
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
      seed: [],
      loadSeed: async () => {
        if (useExerciseStore.getState().seed.length > 0) return;
        try {
          const { SEED_EXERCISES } = await import("@/data/exercises");
          set({ seed: SEED_EXERCISES });
        } catch {
          // Same as loadExtended: a chunk that fails to load must not stop the app starting.
        }
      },
      custom: [],
      catalog: [],
      setCatalog: (catalog) => set({ catalog }),
      extended: [],
      extendedTried: false,
      loadExtended: async () => {
        if (useExerciseStore.getState().extended.length > 0) return;
        // The idle load and a screen that needs the list may ask at once: one load serves both.
        extendedLoading ??= (async () => {
          try {
            set({ extended: await loadExtendedLibrary() });
          } catch {
            // A chunk that fails to load (an old cached page after an update) leaves the seed
            // library and any downloaded catalog; the next start tries again.
          } finally {
            set({ extendedTried: true });
            extendedLoading = null;
          }
        })();
        return extendedLoading;
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

/**
 * One index for the whole app, rebuilt only when the custom or catalog lists change. Built per
 * component before, so a workout with eight cards sorted about 1,000 exercises eight times.
 */
let cached: { seed: unknown; custom: unknown; catalog: unknown; extended: unknown; index: ReturnType<typeof buildExerciseIndex> } | null = null;
function sharedIndex(seed: Exercise[], custom: Exercise[], catalog: Exercise[], extended: Exercise[]) {
  if (!cached || cached.seed !== seed || cached.custom !== custom || cached.catalog !== catalog || cached.extended !== extended) {
    cached = { seed, custom, catalog, extended, index: buildExerciseIndex(seed, custom, withoutBuiltIn(extended, catalog)) };
  }
  return cached.index;
}

export function useAllExercises() {
  const seed = useExerciseStore((s) => s.seed);
  const custom = useExerciseStore((s) => s.custom);
  const catalog = useExerciseStore((s) => s.catalog);
  const extended = useExerciseStore((s) => s.extended);
  return useMemo(() => sharedIndex(seed, custom, catalog, extended), [seed, custom, catalog, extended]);
}

/** Loads the extended library now, for a screen that lists or searches exercises (idempotent). */
export function useExtendedLibrary(when = true): void {
  useEffect(() => {
    if (when) void useExerciseStore.getState().loadExtended();
  }, [when]);
}

/** One exercise by id, outside React (seed, extended library or custom); undefined when unknown. */
export function exerciseById(id: string): Exercise | undefined {
  const { seed, custom, catalog, extended } = useExerciseStore.getState();
  return sharedIndex(seed, custom, catalog, extended).byId[id];
}
