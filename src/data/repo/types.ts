import type { BodyweightEntry, Exercise, GymLocation, Routine, UserSettings, WorkoutSession } from "@/types/workout";
import type { WorkoutSchedule } from "@/lib/notifications/schedule";

/** Settings as persisted: the domain settings plus UI preferences. */
export type StoredSettings = UserSettings & { showRpe: boolean };

export interface RestTimerState {
  endsAt: number;
  totalSec: number;
  sessionExerciseId: string;
}

/** Videos the user pasted for an exercise, keyed by exercise id (seed, custom or catalog). */
export type ExerciseMediaOverrides = Record<string, { customVideoUrl: string }>;

export interface KvValues {
  settings: StoredSettings;
  activeWorkout: WorkoutSession | null;
  restTimer: RestTimerState | null;
  migratedFromLocalStorage: boolean;
  exerciseMedia: ExerciseMediaOverrides;
  /** Daily weigh-ins, oldest first. Small (one row per day), so one value is enough. */
  bodyweightLog: BodyweightEntry[];
  syncState: SyncState;
  /** Local versions that lost to a newer remote edit, newest first, at most 50 (Task 16). */
  conflicts: ConflictEntry[];
  /** Workout reminders. Device-local (notifications belong to this phone): not synced or backed up. */
  reminders: WorkoutSchedule;
  /** What the reminder loop has already shown, so nothing fires twice. */
  reminderState: { lastCheck: number; fired: string[] };
  /** Written by the service worker when "Snooze 30 min" is tapped; read by the reminder loop. */
  reminderSnooze: { until: number; routineId: string | null } | null;
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
  exerciseMedia: ExerciseMediaOverrides;
  bodyweightLog: BodyweightEntry[];
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
  /**
   * The optional full exercise catalog (free-exercise-db). Re-downloadable, so it is not part
   * of snapshots, backups or sync.
   */
  catalog: {
    all(): Promise<Exercise[]>;
    replaceAll(rows: Exercise[]): Promise<void>;
    clear(): Promise<void>;
  };
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
  /** Change tracking for cloud sync. Every write above marks what it touched as pending. */
  sync: {
    /** Everything changed locally and not yet accepted by the server, tombstones included. */
    pending(): Promise<SyncRecord[]>;
    /** The local item (null when absent or deleted) and its sync status (null if never tracked). */
    get(kind: SyncKind, id: string): Promise<{ record: SyncRecord | null; status: SyncStatusRow | null }>;
    /**
     * Writes a server version locally without marking it pending; status becomes synced.
     * With `expected` (the localUpdatedAt that was read, or null for "never tracked") it only
     * applies if the item is still at that version, and returns whether it applied.
     */
    applyRemote(rec: SyncRecord, at: number, expected?: number | null): Promise<boolean>;
    /** Marks synced only if the item is still at `version`, so an edit made meanwhile stays pending. */
    markSynced(kind: SyncKind, id: string, version: number, at: number): Promise<void>;
    /** Forgets synced tombstones whose last sync is older than `olderThan`; returns how many. */
    purgeTombstones(olderThan: number): Promise<number>;
    /** Queues every local item for upload (first sign-in, or a different account). */
    markAllPending(): Promise<void>;
  };
  /** Adds or overwrites rows by id in one transaction; removes nothing. */
  mergeAll(data: Pick<RepoSnapshot, "sessions" | "routines" | "exercises" | "locations" | "exerciseMedia" | "bodyweightLog">): Promise<void>;
  /** Replaces every table and the settings/active workout in one transaction; clears the rest timer. */
  replaceAll(data: RepoSnapshot): Promise<void>;
  snapshot(): Promise<RepoSnapshot>;
}

/** Merge weigh-ins by day: an incoming entry replaces that day's local one. Oldest first. */
export function mergeLog(local: BodyweightEntry[], incoming: BodyweightEntry[]): BodyweightEntry[] {
  const byDay = new Map(local.map((e) => [e.id, e]));
  for (const e of incoming) byDay.set(e.id, e);
  return [...byDay.values()].sort((a, b) => a.date - b.date);
}

/* ------------------------------------------------------------------ */
/* Cloud sync metadata (plan Task 15, master plan section 3.1)         */
/* ------------------------------------------------------------------ */

/** What a synced item is. `bodyweight` and `media` were added after the plan (both user data). */
export type SyncKind = "session" | "routine" | "exercise" | "location" | "settings" | "bodyweight" | "media";

export interface SyncStatusRow {
  kind: SyncKind;
  id: string;
  status: "pending_sync" | "synced";
  /** Device time of the last local change (or of the server version, after a pull). */
  localUpdatedAt: number;
  lastSyncedAt: number | null;
  /** Tombstone: deleted here (or on the server) so the delete syncs too. */
  deleted: boolean;
}

/** One item as the server stores it. `payload` is null for a tombstone. */
export interface SyncRecord {
  kind: SyncKind;
  id: string;
  payload: unknown;
  updatedAt: number;
  deleted: boolean;
}

export interface SyncState {
  userId: string | null;
  lastPulledCursor: string | null;
  lastSyncedAt: number | null;
  phase: "signed_out" | "idle" | "syncing" | "offline" | "error";
  lastError: string | null;
}

export interface ConflictEntry {
  /** The local version that lost, kept so nothing disappears silently. */
  record: SyncRecord;
  /** When the newer server version replaced it. */
  replacedAt: number;
}

export const TABLE_KINDS = {
  sessions: "session",
  routines: "routine",
  exercises: "exercise",
  locations: "location",
} as const satisfies Record<string, SyncKind>;
export type TableName = keyof typeof TABLE_KINDS;
export const KIND_TABLES: Partial<Record<SyncKind, TableName>> = {
  session: "sessions",
  routine: "routines",
  exercise: "exercises",
  location: "locations",
};

/** The one settings item has a fixed id. */
export const SETTINGS_ID = "settings";

/** Item-level changes between two values of a tracked kv key ("settings", log, videos). */
export function kvChanges(
  key: KvKey,
  prev: unknown,
  next: unknown,
): { kind: SyncKind; id: string; deleted: boolean }[] {
  if (key === "settings") return [{ kind: "settings", id: SETTINGS_ID, deleted: false }];
  if (key === "bodyweightLog") {
    const before = new Map(((prev as BodyweightEntry[] | undefined) ?? []).map((e) => [e.id, e]));
    const after = new Map(((next as BodyweightEntry[] | undefined) ?? []).map((e) => [e.id, e]));
    return diffMaps("bodyweight", before, after);
  }
  if (key === "exerciseMedia") {
    const before = new Map(Object.entries((prev as ExerciseMediaOverrides | undefined) ?? {}));
    const after = new Map(Object.entries((next as ExerciseMediaOverrides | undefined) ?? {}));
    return diffMaps("media", before, after);
  }
  return [];
}

function diffMaps(kind: SyncKind, before: Map<string, unknown>, after: Map<string, unknown>) {
  const out: { kind: SyncKind; id: string; deleted: boolean }[] = [];
  for (const [id, v] of after) if (JSON.stringify(before.get(id)) !== JSON.stringify(v)) out.push({ kind, id, deleted: false });
  for (const id of before.keys()) if (!after.has(id)) out.push({ kind, id, deleted: true });
  return out;
}

/** Every kv item that is synced, for markAllPending and the Dexie upgrade. */
export function kvItems(key: KvKey, value: unknown): { kind: SyncKind; id: string }[] {
  if (value === undefined || value === null) return [];
  return kvChanges(key, undefined, value).filter((c) => !c.deleted);
}

/** Reads one kv item's payload out of the stored kv value; undefined when absent. */
export function kvPayload(kind: SyncKind, id: string, kv: { settings?: unknown; bodyweightLog?: unknown; exerciseMedia?: unknown }): unknown {
  if (kind === "settings") return kv.settings ?? undefined;
  if (kind === "bodyweight") return ((kv.bodyweightLog as BodyweightEntry[] | undefined) ?? []).find((e) => e.id === id);
  if (kind === "media") return ((kv.exerciseMedia as ExerciseMediaOverrides | undefined) ?? {})[id];
  return undefined;
}

/** Puts one remote kv item into the stored kv value and returns the key and new value. */
export function kvApply(
  rec: SyncRecord,
  kv: { bodyweightLog?: unknown; exerciseMedia?: unknown },
): { key: KvKey; value: unknown } {
  if (rec.kind === "settings") return { key: "settings", value: rec.payload };
  if (rec.kind === "bodyweight") {
    const rest = ((kv.bodyweightLog as BodyweightEntry[] | undefined) ?? []).filter((e) => e.id !== rec.id);
    return { key: "bodyweightLog", value: rec.deleted ? rest : mergeLog(rest, [rec.payload as BodyweightEntry]) };
  }
  const media = { ...((kv.exerciseMedia as ExerciseMediaOverrides | undefined) ?? {}) };
  if (rec.deleted) delete media[rec.id];
  else media[rec.id] = rec.payload as ExerciseMediaOverrides[string];
  return { key: "exerciseMedia", value: media };
}

/** Local change times only move forward, so two edits in one millisecond stay distinct. */
export function nextStamp(prev: SyncStatusRow | null | undefined): number {
  return Math.max(Date.now(), (prev?.localUpdatedAt ?? 0) + 1);
}

export const TRACKED_KV: KvKey[] = ["settings", "bodyweightLog", "exerciseMedia"];
