import type { Repository, StoredSettings } from "@/data/repo";
import { normalizeExercise } from "@/data/normalize";
import type { Exercise } from "@/types/workout";
import { useWorkoutStore } from "./useWorkoutStore";
import { useRoutineStore } from "./useRoutineStore";
import { useExerciseStore } from "./useExerciseStore";
import { useSettingsStore, type SettingsState } from "./useSettingsStore";
import { useLocationStore } from "./useLocationStore";
import { useHydration } from "./hydration";

/** The repository the running app writes to; set by StoreHydrator, read by backup import. */
let activeRepo: Repository | null = null;
export const getActiveRepository = () => activeRepo;
export const setActiveRepository = (repo: Repository | null) => {
  activeRepo = repo;
};

function pickSettings(s: SettingsState): StoredSettings {
  return {
    weightUnit: s.weightUnit,
    defaultRestSeconds: s.defaultRestSeconds,
    restTimerAlert: s.restTimerAlert,
    firstDayOfWeek: s.firstDayOfWeek,
    activeLocationId: s.activeLocationId,
    showRpe: s.showRpe,
  };
}

/** True while stores are being filled from the repository, so subscribers do not echo it back. */
let loadingFromRepo = false;

/** Replaces in-memory state with what the repository holds. */
export async function hydrateStores(repo: Repository): Promise<void> {
  const snap = await repo.snapshot();
  const restTimer = (await repo.kv.get("restTimer")) ?? null;
  loadingFromRepo = true;
  try {
    useWorkoutStore.setState({ sessions: snap.sessions, active: snap.activeWorkout, restTimer });
    useRoutineStore.setState({ routines: snap.routines });
    useExerciseStore.setState({ custom: snap.exercises.map((e: Exercise) => normalizeExercise(e)) });
    useLocationStore.setState({ locations: snap.locations });
    if (snap.settings) useSettingsStore.setState(snap.settings);
  } finally {
    loadingFromRepo = false;
  }
}

/** Puts new or changed rows and removes deleted ones, comparing by reference (stores are immutable). */
function diffTable<T extends { id: string }>(
  prev: T[],
  next: T[],
  table: { put(item: T): Promise<void>; remove(id: string): Promise<void> },
  enqueue: (op: () => Promise<void>) => void,
) {
  if (prev === next) return;
  const before = new Map(prev.map((x) => [x.id, x]));
  for (const item of next) {
    if (before.get(item.id) !== item) enqueue(() => table.put(item));
    before.delete(item.id);
  }
  for (const id of before.keys()) enqueue(() => table.remove(id));
}

/**
 * Subscribes to every store and mirrors changes into the repository. Store updates stay
 * synchronous; writes run in order on one promise chain, so the last state always lands last.
 */
export function attachPersistence(repo: Repository): { flush(): Promise<void>; detach(): void } {
  let chain: Promise<void> = Promise.resolve();
  const enqueue = (op: () => Promise<void>) => {
    chain = chain.then(op).catch((e: unknown) => {
      const msg = e instanceof Error ? `${e.name === "Error" ? "" : `${e.name}: `}${e.message}` : String(e);
      useHydration.getState().reportError(`Could not save to this device (${msg}).`);
    });
  };

  const unsubs = [
    useWorkoutStore.subscribe((next, prev) => {
      if (loadingFromRepo) return;
      diffTable(prev.sessions, next.sessions, repo.sessions, enqueue);
      if (next.active !== prev.active) {
        const active = next.active;
        enqueue(() => repo.kv.set("activeWorkout", active));
      }
      if (next.restTimer !== prev.restTimer) {
        const timer = next.restTimer;
        enqueue(() => repo.kv.set("restTimer", timer));
      }
    }),
    useRoutineStore.subscribe((next, prev) => {
      if (!loadingFromRepo) diffTable(prev.routines, next.routines, repo.routines, enqueue);
    }),
    useExerciseStore.subscribe((next, prev) => {
      if (!loadingFromRepo) diffTable(prev.custom, next.custom, repo.exercises, enqueue);
    }),
    useLocationStore.subscribe((next, prev) => {
      if (!loadingFromRepo) diffTable(prev.locations, next.locations, repo.locations, enqueue);
    }),
    useSettingsStore.subscribe((next, prev) => {
      if (loadingFromRepo) return;
      const a = pickSettings(next);
      const b = pickSettings(prev);
      if ((Object.keys(a) as (keyof StoredSettings)[]).some((k) => a[k] !== b[k])) {
        enqueue(() => repo.kv.set("settings", a));
      }
    }),
  ];

  return {
    flush: async () => {
      // Writes enqueued while flushing are awaited too.
      let current: Promise<void>;
      do {
        current = chain;
        await current;
      } while (current !== chain);
    },
    detach: () => unsubs.forEach((u) => u()),
  };
}
