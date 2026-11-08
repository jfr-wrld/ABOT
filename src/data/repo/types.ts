import type { Exercise, GymLocation, Routine, UserSettings, WorkoutSession } from "@/types/workout";

/** Settings as persisted: the domain settings plus UI preferences. */
export type StoredSettings = UserSettings & { showRpe: boolean };

export interface RestTimerState {
  endsAt: number;
  totalSec: number;
  sessionExerciseId: string;
}

export interface KvValues {
  settings: StoredSettings;
  activeWorkout: WorkoutSession | null;
  restTimer: RestTimerState | null;
  migratedFromLocalStorage: boolean;
}
export type KvKey = keyof KvValues;

export interface Table<T> {
  all(): Promise<T[]>;
  put(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface RepoSnapshot {
  sessions: WorkoutSession[];
  routines: Routine[];
  /** Custom exercises only; the seed library is code, not data. */
  exercises: Exercise[];
  locations: GymLocation[];
  settings: StoredSettings | null;
  activeWorkout: WorkoutSession | null;
}

/**
 * Everything ABOT persists goes through this interface. The Dexie implementation is the
 * default; a cloud sync adapter can implement the same contract without touching the UI.
 */
export interface Repository {
  sessions: Table<WorkoutSession>;
  routines: Table<Routine>;
  exercises: Table<Exercise>;
  locations: Table<GymLocation>;
  kv: {
    get<K extends KvKey>(key: K): Promise<KvValues[K] | undefined>;
    set<K extends KvKey>(key: K, value: KvValues[K]): Promise<void>;
    remove(key: KvKey): Promise<void>;
  };
  /**
   * Saves a finished workout and clears the in-progress workout and rest timer in one
   * transaction, so a failure leaves the workout recoverable as in progress, never lost.
   */
  commitFinishedWorkout(session: WorkoutSession): Promise<void>;
  /** Adds or overwrites rows by id in one transaction; removes nothing. */
  mergeAll(data: Pick<RepoSnapshot, "sessions" | "routines" | "exercises" | "locations">): Promise<void>;
  /** Replaces every table and the settings/active workout in one transaction; clears the rest timer. */
  replaceAll(data: RepoSnapshot): Promise<void>;
  snapshot(): Promise<RepoSnapshot>;
}
