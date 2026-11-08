import Dexie, { type EntityTable } from "dexie";
import type { Exercise, GymLocation, Routine, WorkoutSession } from "@/types/workout";
import {
  KIND_TABLES,
  TABLE_KINDS,
  TRACKED_KV,
  kvApply,
  kvChanges,
  kvItems,
  kvPayload,
  mergeLog,
  nextStamp,
  type KvKey,
  type KvValues,
  type Repository,
  type SyncKind,
  type SyncRecord,
  type SyncStatusRow,
  type Table,
  type TableName,
} from "./types";

interface KvRow {
  key: KvKey;
  value: unknown;
}

export class AbotDB extends Dexie {
  sessions!: EntityTable<WorkoutSession, "id">;
  routines!: EntityTable<Routine, "id">;
  exercises!: EntityTable<Exercise, "id">;
  locations!: EntityTable<GymLocation, "id">;
  catalog!: EntityTable<Exercise, "id">;
  kv!: EntityTable<KvRow, "key">;
  syncStatus!: Dexie.Table<SyncStatusRow, [SyncKind, string]>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      sessions: "id, startedAt, status",
      routines: "id",
      exercises: "id",
      locations: "id",
      kv: "key",
    });
    // v2: on-demand exercise catalog. Existing tables are untouched by the upgrade.
    this.version(2).stores({ catalog: "id" });
    // v3: sync bookkeeping. Everything already on the device is queued, so a guest's history
    // uploads on their first sign-in.
    this.version(3)
      .stores({ syncStatus: "[kind+id], status" })
      .upgrade(async (tx) => {
        const now = Date.now();
        const rows: SyncStatusRow[] = [];
        const pending = (kind: SyncKind, id: string) =>
          rows.push({ kind, id, status: "pending_sync", localUpdatedAt: now, lastSyncedAt: null, deleted: false });
        for (const name of Object.keys(TABLE_KINDS) as TableName[]) {
          for (const id of (await tx.table(name).toCollection().primaryKeys()) as string[]) pending(TABLE_KINDS[name], id);
        }
        for (const k of TRACKED_KV) {
          const row = (await tx.table("kv").get(k)) as KvRow | undefined;
          for (const item of kvItems(k, row?.value)) pending(item.kind, item.id);
        }
        await tx.table("syncStatus").bulkPut(rows);
      });
  }
}

const SYNCED_TABLES = ["sessions", "routines", "exercises", "locations", "kv", "syncStatus"] as const;

export function createDexieRepository(name = "abot", db: AbotDB = new AbotDB(name)): Repository {
  /** Marks one item pending inside the caller's transaction. */
  async function mark(kind: SyncKind, id: string, deleted: boolean) {
    const prev = await db.syncStatus.get([kind, id]);
    await db.syncStatus.put({
      kind,
      id,
      status: "pending_sync",
      localUpdatedAt: nextStamp(prev),
      lastSyncedAt: prev?.lastSyncedAt ?? null,
      deleted,
    });
  }

  async function kvValue(k: KvKey): Promise<unknown> {
    return (await db.kv.get(k))?.value;
  }

  async function setKv(k: KvKey, value: unknown, track: boolean) {
    if (track && TRACKED_KV.includes(k)) {
      for (const c of kvChanges(k, await kvValue(k), value)) await mark(c.kind, c.id, c.deleted);
    }
    await db.kv.put({ key: k, value });
  }

  /** Every write and its sync mark land together, or not at all. */
  const rw = <T>(fn: () => Promise<T>) => db.transaction("rw", [...SYNCED_TABLES.map((t) => db[t])], fn);

  function table<T extends { id: string }>(n: TableName): Table<T> {
    const t = db[n] as unknown as Dexie.Table<{ id: string }, string>;
    return {
      all: async () => (await t.toArray()) as T[],
      put: (item) =>
        rw(async () => {
          await t.put(item);
          await mark(TABLE_KINDS[n], item.id, false);
        }),
      remove: (id) =>
        rw(async () => {
          if (!(await t.get(id))) return;
          await t.delete(id);
          await mark(TABLE_KINDS[n], id, true);
        }),
    };
  }

  async function putRows(n: TableName, rows: { id: string }[]) {
    await (db[n] as unknown as Dexie.Table<{ id: string }, string>).bulkPut(rows);
    for (const row of rows) await mark(TABLE_KINDS[n], row.id, false);
  }

  async function record(kind: SyncKind, id: string, s: SyncStatusRow | null | undefined): Promise<SyncRecord | null> {
    const n = KIND_TABLES[kind];
    const payload = n
      ? await (db[n] as unknown as Dexie.Table<unknown, string>).get(id)
      : kvPayload(kind, id, {
          settings: await kvValue("settings"),
          bodyweightLog: await kvValue("bodyweightLog"),
          exerciseMedia: await kvValue("exerciseMedia"),
        });
    if (payload === undefined) return null;
    return { kind, id, payload, updatedAt: s?.localUpdatedAt ?? 0, deleted: false };
  }

  const repo: Repository = {
    sessions: table<WorkoutSession>("sessions"),
    routines: table<Routine>("routines"),
    exercises: table<Exercise>("exercises"),
    locations: table<GymLocation>("locations"),
    catalog: {
      all: () => db.catalog.toArray(),
      replaceAll: async (rows) => {
        await db.transaction("rw", db.catalog, async () => {
          await db.catalog.clear();
          await db.catalog.bulkPut(rows);
        });
      },
      clear: () => db.catalog.clear(),
    },
    kv: {
      async get<K extends KvKey>(key: K) {
        const row = await db.kv.get(key);
        return row ? (row.value as KvValues[K]) : undefined;
      },
      async set(key, value) {
        if (!TRACKED_KV.includes(key)) {
          await db.kv.put({ key, value });
          return;
        }
        await rw(() => setKv(key, value, true));
      },
      async remove(key) {
        await rw(async () => {
          if (TRACKED_KV.includes(key)) for (const c of kvChanges(key, await kvValue(key), undefined)) await mark(c.kind, c.id, c.deleted);
          await db.kv.delete(key);
        });
      },
    },
    sync: {
      pending: () =>
        db.transaction("r", [...SYNCED_TABLES.map((t) => db[t])], async () => {
          const out: SyncRecord[] = [];
          for (const s of await db.syncStatus.where("status").equals("pending_sync").toArray()) {
            const rec = s.deleted ? null : await record(s.kind, s.id, s);
            out.push(rec ?? { kind: s.kind, id: s.id, payload: null, updatedAt: s.localUpdatedAt, deleted: true });
          }
          return out;
        }),
      get: (kind, id) =>
        db.transaction("r", [...SYNCED_TABLES.map((t) => db[t])], async () => {
          const s = (await db.syncStatus.get([kind, id])) ?? null;
          return { record: s?.deleted ? null : await record(kind, id, s), status: s };
        }),
      applyRemote: (rec, at) =>
        rw(async () => {
          const n = KIND_TABLES[rec.kind];
          if (n) {
            const t = db[n] as unknown as Dexie.Table<unknown, string>;
            if (rec.deleted) await t.delete(rec.id);
            else await t.put(rec.payload);
          } else if (!(rec.kind === "settings" && rec.deleted)) {
            const { key, value } = kvApply(rec, {
              bodyweightLog: await kvValue("bodyweightLog"),
              exerciseMedia: await kvValue("exerciseMedia"),
            });
            await setKv(key, value, false);
          }
          await db.syncStatus.put({
            kind: rec.kind,
            id: rec.id,
            status: "synced",
            localUpdatedAt: rec.updatedAt,
            lastSyncedAt: at,
            deleted: rec.deleted,
          });
        }),
      markSynced: (kind, id, version, at) =>
        rw(async () => {
          const s = await db.syncStatus.get([kind, id]);
          if (s && s.localUpdatedAt === version) await db.syncStatus.put({ ...s, status: "synced", lastSyncedAt: at });
        }),
      purgeTombstones: (olderThan) =>
        rw(async () => {
          const old = await db.syncStatus
            .where("status")
            .equals("synced")
            .filter((s) => s.deleted && (s.lastSyncedAt ?? 0) < olderThan)
            .primaryKeys();
          await db.syncStatus.bulkDelete(old);
          return old.length;
        }),
      markAllPending: () =>
        rw(async () => {
          for (const n of Object.keys(TABLE_KINDS) as TableName[]) {
            for (const id of (await db[n].toCollection().primaryKeys()) as string[]) await mark(TABLE_KINDS[n], id, false);
          }
          for (const k of TRACKED_KV) for (const item of kvItems(k, await kvValue(k))) await mark(item.kind, item.id, false);
        }),
    },
    async replaceAll(data) {
      await rw(async () => {
        for (const n of Object.keys(TABLE_KINDS) as TableName[]) {
          const incoming = new Set(data[n].map((r) => r.id));
          for (const id of (await db[n].toCollection().primaryKeys()) as string[]) {
            if (!incoming.has(id)) await mark(TABLE_KINDS[n], id, true);
          }
          await db[n].clear();
          await putRows(n, data[n]);
        }
        if (data.settings) await setKv("settings", data.settings, true);
        else await db.kv.delete("settings");
        await db.kv.put({ key: "activeWorkout", value: data.activeWorkout });
        await db.kv.put({ key: "restTimer", value: null });
        await setKv("exerciseMedia", data.exerciseMedia, true);
        await setKv("bodyweightLog", data.bodyweightLog, true);
      });
    },
    async commitFinishedWorkout(session) {
      await rw(async () => {
        await putRows("sessions", [session]);
        await db.kv.put({ key: "activeWorkout", value: null });
        await db.kv.put({ key: "restTimer", value: null });
      });
    },
    async mergeAll(data) {
      await rw(async () => {
        for (const n of Object.keys(TABLE_KINDS) as TableName[]) await putRows(n, data[n]);
        const media = ((await kvValue("exerciseMedia")) as KvValues["exerciseMedia"] | undefined) ?? {};
        await setKv("exerciseMedia", { ...media, ...data.exerciseMedia }, true);
        const log = ((await kvValue("bodyweightLog")) as KvValues["bodyweightLog"] | undefined) ?? [];
        await setKv("bodyweightLog", mergeLog(log, data.bodyweightLog), true);
      });
    },
    async snapshot() {
      return db.transaction("r", [db.sessions, db.routines, db.exercises, db.locations, db.kv], async () => ({
        sessions: await db.sessions.toArray(),
        routines: await db.routines.toArray(),
        exercises: await db.exercises.toArray(),
        locations: await db.locations.toArray(),
        settings: ((await db.kv.get("settings"))?.value as KvValues["settings"] | undefined) ?? null,
        activeWorkout: ((await db.kv.get("activeWorkout"))?.value as KvValues["activeWorkout"] | undefined) ?? null,
        exerciseMedia: ((await db.kv.get("exerciseMedia"))?.value as KvValues["exerciseMedia"] | undefined) ?? {},
        bodyweightLog: ((await db.kv.get("bodyweightLog"))?.value as KvValues["bodyweightLog"] | undefined) ?? [],
      }));
    },
  };
  return repo;
}

