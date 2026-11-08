import Dexie, { type EntityTable } from "dexie";
import type { Exercise, GymLocation, Routine, WorkoutSession } from "@/types/workout";
import type { KvKey, KvValues, Repository, Table } from "./types";

interface KvRow {
  key: KvKey;
  value: unknown;
}

export class AbotDB extends Dexie {
  sessions!: EntityTable<WorkoutSession, "id">;
  routines!: EntityTable<Routine, "id">;
  exercises!: EntityTable<Exercise, "id">;
  locations!: EntityTable<GymLocation, "id">;
  kv!: EntityTable<KvRow, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      sessions: "id, startedAt, status",
      routines: "id",
      exercises: "id",
      locations: "id",
      kv: "key",
    });
  }
}

function dexieTable<T extends { id: string }>(table: EntityTable<T, "id">): Table<T> {
  return {
    all: () => table.toArray(),
    put: async (item) => {
      await table.put(item);
    },
    remove: (id) => table.delete(id as never),
  };
}

export function createDexieRepository(name = "abot", db: AbotDB = new AbotDB(name)): Repository {
  const repo: Repository = {
    sessions: dexieTable(db.sessions),
    routines: dexieTable(db.routines),
    exercises: dexieTable(db.exercises),
    locations: dexieTable(db.locations),
    kv: {
      async get<K extends KvKey>(key: K) {
        const row = await db.kv.get(key);
        return row ? (row.value as KvValues[K]) : undefined;
      },
      async set(key, value) {
        await db.kv.put({ key, value });
      },
      async remove(key) {
        await db.kv.delete(key);
      },
    },
    async replaceAll(data) {
      await db.transaction("rw", [db.sessions, db.routines, db.exercises, db.locations, db.kv], async () => {
        await Promise.all([db.sessions.clear(), db.routines.clear(), db.exercises.clear(), db.locations.clear()]);
        await db.sessions.bulkPut(data.sessions);
        await db.routines.bulkPut(data.routines);
        await db.exercises.bulkPut(data.exercises);
        await db.locations.bulkPut(data.locations);
        if (data.settings) await db.kv.put({ key: "settings", value: data.settings });
        else await db.kv.delete("settings");
        await db.kv.put({ key: "activeWorkout", value: data.activeWorkout });
        await db.kv.put({ key: "restTimer", value: null });
      });
    },
    async commitFinishedWorkout(session) {
      await db.transaction("rw", [db.sessions, db.kv], async () => {
        await db.sessions.put(session);
        await db.kv.put({ key: "activeWorkout", value: null });
        await db.kv.put({ key: "restTimer", value: null });
      });
    },
    async mergeAll(data) {
      await db.transaction("rw", [db.sessions, db.routines, db.exercises, db.locations], async () => {
        await db.sessions.bulkPut(data.sessions);
        await db.routines.bulkPut(data.routines);
        await db.exercises.bulkPut(data.exercises);
        await db.locations.bulkPut(data.locations);
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
      }));
    },
  };
  return repo;
}
