import type { KvKey, KvValues, Repository, RepoSnapshot, Table } from "./types";

/** Copies on the way in and out, like IndexedDB, so callers never share references with storage. */
const clone = <T>(v: T): T => structuredClone(v);

function memoryTable<T extends { id: string }>(): Table<T> & { map: Map<string, T> } {
  const map = new Map<string, T>();
  return {
    map,
    async all() {
      return [...map.values()].map(clone);
    },
    async put(item) {
      map.set(item.id, clone(item));
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

/** Used by tests and as the fallback when IndexedDB cannot be opened (data lasts for the tab). */
export function createMemoryRepository(): Repository {
  const sessions = memoryTable<RepoSnapshot["sessions"][number]>();
  const routines = memoryTable<RepoSnapshot["routines"][number]>();
  const exercises = memoryTable<RepoSnapshot["exercises"][number]>();
  const locations = memoryTable<RepoSnapshot["locations"][number]>();
  const kv = new Map<KvKey, unknown>();
  let catalog: RepoSnapshot["exercises"] = [];

  const repo: Repository = {
    sessions,
    routines,
    exercises,
    locations,
    catalog: {
      async all() {
        return clone(catalog);
      },
      async replaceAll(rows) {
        catalog = clone(rows);
      },
      async clear() {
        catalog = [];
      },
    },
    kv: {
      async get<K extends KvKey>(key: K) {
        return kv.has(key) ? clone(kv.get(key) as KvValues[K]) : undefined;
      },
      async set(key, value) {
        kv.set(key, clone(value));
      },
      async remove(key) {
        kv.delete(key);
      },
    },
    async replaceAll(data) {
      for (const [table, rows] of [
        [sessions, data.sessions],
        [routines, data.routines],
        [exercises, data.exercises],
        [locations, data.locations],
      ] as const) {
        table.map.clear();
        for (const row of rows) table.map.set(row.id, clone(row) as never);
      }
      if (data.settings) kv.set("settings", clone(data.settings));
      else kv.delete("settings");
      kv.set("activeWorkout", clone(data.activeWorkout));
      kv.set("restTimer", null);
    },
    async commitFinishedWorkout(session) {
      sessions.map.set(session.id, clone(session));
      kv.set("activeWorkout", null);
      kv.set("restTimer", null);
    },
    async mergeAll(data) {
      for (const s of data.sessions) sessions.map.set(s.id, clone(s));
      for (const r of data.routines) routines.map.set(r.id, clone(r));
      for (const e of data.exercises) exercises.map.set(e.id, clone(e));
      for (const l of data.locations) locations.map.set(l.id, clone(l));
    },
    async snapshot() {
      return {
        sessions: await sessions.all(),
        routines: await routines.all(),
        exercises: await exercises.all(),
        locations: await locations.all(),
        settings: (await repo.kv.get("settings")) ?? null,
        activeWorkout: (await repo.kv.get("activeWorkout")) ?? null,
      };
    },
  };
  return repo;
}
