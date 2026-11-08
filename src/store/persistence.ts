import type { Repository, RepoSnapshot, StoredSettings } from "@/data/repo";
import type { OpenedRepository } from "@/data/repo";
import { normalizeExercise } from "@/data/normalize";
import { migrateFromLocalStorage } from "@/data/migrateLegacy";
import { DEFAULT_SETTINGS, type Exercise } from "@/types/workout";
import { useWorkoutStore } from "./useWorkoutStore";
import { useRoutineStore } from "./useRoutineStore";
import { useExerciseStore } from "./useExerciseStore";
import { useSettingsStore, type SettingsState } from "./useSettingsStore";
import { useLocationStore } from "./useLocationStore";
import { useHydration } from "./hydration";

export interface PersistenceHandle {
  /** Resolves when every queued write (including ones queued meanwhile) has settled. */
  flush(): Promise<void>;
  /** Re-attempts every write that failed, using the current in-memory value. */
  retryFailed(): Promise<void>;
  /** Waits for queued writes, then runs `fn` with no other write interleaving (used by import). */
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;
  detach(): void;
}

/** The repository and persistence the running app uses; set by bootstrapStores. */
let activeRepo: Repository | null = null;
let activePersistence: PersistenceHandle | null = null;
export const getActiveRepository = () => activeRepo;
export const getActivePersistence = () => activePersistence;
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
    profileName: s.profileName,
    bodyweightKg: s.bodyweightKg,
    heightCm: s.heightCm,
  };
}

const DEFAULT_STORED_SETTINGS: StoredSettings = { ...DEFAULT_SETTINGS, showRpe: true };

/** True while stores are being filled from the repository, so subscribers do not echo it back. */
let loadingFromRepo = false;

/** Replaces in-memory state with what the repository holds. */
export async function hydrateStores(repo: Repository): Promise<void> {
  const snap = await repo.snapshot();
  const restTimer = (await repo.kv.get("restTimer")) ?? null;
  const catalog = await repo.catalog.all();
  loadingFromRepo = true;
  try {
    useWorkoutStore.setState({ sessions: snap.sessions, active: snap.activeWorkout, restTimer });
    useRoutineStore.setState({ routines: snap.routines });
    useExerciseStore.setState({
      custom: snap.exercises.map((e: Exercise) => normalizeExercise(e)),
      catalog,
      mediaOverrides: snap.exerciseMedia,
    });
    useLocationStore.setState({ locations: snap.locations });
    // A repository without settings means defaults, not "keep whatever was in memory".
    // Defaults first: rows saved before a field existed must not keep a stale in-memory value.
    useSettingsStore.setState({ ...DEFAULT_STORED_SETTINGS, ...snap.settings });
  } finally {
    loadingFromRepo = false;
  }
}

/** Everything the app holds in memory, which includes changes that could not be saved yet. */
export function snapshotFromStores(): RepoSnapshot {
  const w = useWorkoutStore.getState();
  return {
    sessions: w.sessions,
    routines: useRoutineStore.getState().routines,
    exercises: useExerciseStore.getState().custom,
    locations: useLocationStore.getState().locations,
    settings: pickSettings(useSettingsStore.getState()),
    activeWorkout: w.active,
    exerciseMedia: useExerciseStore.getState().mediaOverrides,
  };
}

/**
 * A write is identified by what it stores, not by the value at the time of the change. When it
 * runs (or is retried) it writes the current in-memory value, so a retry can never put back an
 * older version.
 */
type TableName = "sessions" | "routines" | "exercises" | "locations";
type WriteKey =
  | `${TableName}:${string}`
  | "kv:activeWorkout"
  | "kv:restTimer"
  | "kv:settings"
  | "kv:exerciseMedia"
  | `finish:${string}`;

function currentRows(table: TableName): { id: string }[] {
  switch (table) {
    case "sessions":
      return useWorkoutStore.getState().sessions;
    case "routines":
      return useRoutineStore.getState().routines;
    case "exercises":
      return useExerciseStore.getState().custom;
    case "locations":
      return useLocationStore.getState().locations;
  }
}

async function writeKey(repo: Repository, key: WriteKey): Promise<void> {
  if (key === "kv:activeWorkout") return repo.kv.set("activeWorkout", useWorkoutStore.getState().active);
  if (key === "kv:restTimer") return repo.kv.set("restTimer", useWorkoutStore.getState().restTimer);
  if (key === "kv:settings") return repo.kv.set("settings", pickSettings(useSettingsStore.getState()));
  if (key === "kv:exerciseMedia") return repo.kv.set("exerciseMedia", useExerciseStore.getState().mediaOverrides);
  const sep = key.indexOf(":");
  const kind = key.slice(0, sep);
  const id = key.slice(sep + 1);
  if (kind === "finish") {
    const w = useWorkoutStore.getState();
    const session = w.sessions.find((s) => s.id === id);
    if (!session) return repo.sessions.remove(id); // deleted again before the write ran
    await repo.commitFinishedWorkout(session);
    // A new workout may already be running; the commit cleared it in storage, so restore it.
    if (w.active) {
      await repo.kv.set("activeWorkout", w.active);
      await repo.kv.set("restTimer", w.restTimer);
    }
    return;
  }
  const table = kind as TableName;
  const row = currentRows(table).find((r) => r.id === id);
  const t = repo[table] as { put(x: unknown): Promise<void>; remove(id: string): Promise<void> };
  return row ? t.put(row) : t.remove(id);
}

function changedIds<T extends { id: string }>(prev: T[], next: T[]): string[] {
  if (prev === next) return [];
  const before = new Map(prev.map((x) => [x.id, x]));
  const out: string[] = [];
  for (const item of next) {
    if (before.get(item.id) !== item) out.push(item.id);
    before.delete(item.id);
  }
  return [...out, ...before.keys()];
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.name && e.name !== "Error" ? `${e.name}: ${e.message}` : e.message;
  return String(e);
}

/**
 * Subscribes to every store and mirrors changes into the repository. Store updates stay
 * synchronous; writes run in order on one promise chain. Failed writes are remembered and
 * retried with the latest value (after the next successful write, or via retryFailed).
 */
export function attachPersistence(repo: Repository): PersistenceHandle {
  let chain: Promise<void> = Promise.resolve();
  const failed = new Set<WriteKey>();
  let retrying = false;

  const enqueue = (key: WriteKey) => {
    chain = chain
      .then(() => writeKey(repo, key))
      .then(
        () => {
          failed.delete(key);
          if (failed.size === 0) useHydration.getState().setWriteError(null);
          else if (!retrying) scheduleRetry();
        },
        (e: unknown) => {
          failed.add(key);
          useHydration.getState().setWriteError(`Could not save to this device (${describe(e)}).`);
        },
      );
  };

  const scheduleRetry = () => {
    retrying = true;
    for (const key of [...failed]) enqueue(key);
    chain = chain.then(() => {
      retrying = false;
    });
  };

  const flush = async () => {
    let current: Promise<void>;
    do {
      current = chain;
      await current;
    } while (current !== chain);
  };

  const unsubs = [
    useWorkoutStore.subscribe((next, prev) => {
      if (loadingFromRepo) return;
      const finishedId =
        prev.active && !next.active && next.sessions.some((s) => s.id === prev.active!.id) ? prev.active.id : null;
      for (const id of changedIds(prev.sessions, next.sessions)) {
        if (id !== finishedId) enqueue(`sessions:${id}`);
      }
      if (finishedId) {
        enqueue(`finish:${finishedId}`);
        return; // the commit writes activeWorkout and restTimer
      }
      if (next.active !== prev.active) enqueue("kv:activeWorkout");
      if (next.restTimer !== prev.restTimer) enqueue("kv:restTimer");
    }),
    useRoutineStore.subscribe((next, prev) => {
      if (!loadingFromRepo) for (const id of changedIds(prev.routines, next.routines)) enqueue(`routines:${id}`);
    }),
    useExerciseStore.subscribe((next, prev) => {
      if (loadingFromRepo) return;
      for (const id of changedIds(prev.custom, next.custom)) enqueue(`exercises:${id}`);
      if (next.mediaOverrides !== prev.mediaOverrides) enqueue("kv:exerciseMedia");
    }),
    useLocationStore.subscribe((next, prev) => {
      if (!loadingFromRepo) for (const id of changedIds(prev.locations, next.locations)) enqueue(`locations:${id}`);
    }),
    useSettingsStore.subscribe((next, prev) => {
      if (loadingFromRepo) return;
      const a = pickSettings(next);
      const b = pickSettings(prev);
      if ((Object.keys(a) as (keyof StoredSettings)[]).some((k) => a[k] !== b[k])) enqueue("kv:settings");
    }),
  ];

  return {
    flush,
    retryFailed: async () => {
      if (failed.size > 0) scheduleRetry();
      await flush();
    },
    runExclusive: async <T,>(fn: () => Promise<T>) => {
      await flush();
      const run = chain.then(fn);
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    detach: () => unsubs.forEach((u) => u()),
  };
}

/**
 * Loads saved data into the stores and only then starts saving changes. If the data cannot be
 * read, nothing is attached: logging in memory must never overwrite data that was not read.
 */
export async function bootstrapStores(
  opened: OpenedRepository,
  storage: Pick<Storage, "getItem">,
): Promise<{ persistence: PersistenceHandle | null }> {
  const { repo, durable, error } = opened;
  try {
    if (durable) await migrateFromLocalStorage(repo, storage);
    await hydrateStores(repo);
  } catch (e) {
    useHydration.getState().setHydrated({
      durable: false,
      error: `Saved data could not be read (${describe(e)}). Nothing new will be saved until it loads. Reload ABOT to try again.`,
    });
    return { persistence: null };
  }
  setActiveRepository(repo);
  activePersistence = attachPersistence(repo);
  useHydration.getState().setHydrated({ durable, error });
  return { persistence: activePersistence };
}
