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
  type RepoSnapshot,
  type SyncKind,
  type SyncRecord,
  type SyncStatusRow,
  type Table,
  type TableName,
  type WorkoutPhoto,
} from "./types";

/** Copies on the way in and out, like IndexedDB, so callers never share references with storage. */
const clone = <T>(v: T): T => structuredClone(v);
const key = (kind: SyncKind, id: string) => `${kind}:${id}`;

/** Used by tests and as the fallback when IndexedDB cannot be opened (data lasts for the tab). */
export function createMemoryRepository(): Repository {
  const tables = {
    sessions: new Map<string, RepoSnapshot["sessions"][number]>(),
    routines: new Map<string, RepoSnapshot["routines"][number]>(),
    exercises: new Map<string, RepoSnapshot["exercises"][number]>(),
    locations: new Map<string, RepoSnapshot["locations"][number]>(),
  };
  const kv = new Map<KvKey, unknown>();
  const status = new Map<string, SyncStatusRow>();
  let catalog: RepoSnapshot["exercises"] = [];
  // Blobs are immutable, so a shallow copy is enough to keep callers off the stored rows.
  const photos = new Map<string, WorkoutPhoto>();
  const dropPhotos = (sessionId: string) => {
    for (const p of [...photos.values()]) if (p.sessionId === sessionId) photos.delete(p.id);
  };

  function mark(kind: SyncKind, id: string, deleted: boolean) {
    const prev = status.get(key(kind, id));
    status.set(key(kind, id), {
      kind,
      id,
      status: "pending_sync",
      localUpdatedAt: nextStamp(prev),
      lastSyncedAt: prev?.lastSyncedAt ?? null,
      deleted,
    });
  }

  function setKv(k: KvKey, value: unknown, track: boolean) {
    if (track && TRACKED_KV.includes(k)) for (const c of kvChanges(k, kv.get(k), value)) mark(c.kind, c.id, c.deleted);
    kv.set(k, clone(value));
  }

  function table<N extends TableName>(name: N): Table<RepoSnapshot[N][number]> {
    const map = tables[name] as Map<string, RepoSnapshot[N][number]>;
    return {
      async all() {
        return [...map.values()].map(clone);
      },
      async put(item) {
        map.set(item.id, clone(item));
        mark(TABLE_KINDS[name], item.id, false);
      },
      async remove(id) {
        if (!map.delete(id)) return;
        mark(TABLE_KINDS[name], id, true);
      },
    };
  }

  function putRows(name: TableName, rows: { id: string }[]) {
    const map = tables[name] as Map<string, { id: string }>;
    for (const row of rows) {
      map.set(row.id, clone(row));
      mark(TABLE_KINDS[name], row.id, false);
    }
  }

  function record(kind: SyncKind, id: string, s: SyncStatusRow | null): SyncRecord | null {
    const name = KIND_TABLES[kind];
    const payload = name
      ? tables[name].get(id)
      : kvPayload(kind, id, { settings: kv.get("settings"), bodyweightLog: kv.get("bodyweightLog"), exerciseMedia: kv.get("exerciseMedia") });
    if (payload === undefined) return null;
    return { kind, id, payload: clone(payload), updatedAt: s?.localUpdatedAt ?? 0, deleted: false };
  }

  const sessions = table("sessions");
  const repo: Repository = {
    sessions: {
      ...sessions,
      async remove(id) {
        await sessions.remove(id);
        dropPhotos(id);
      },
    },
    photos: {
      async all() {
        return [...photos.values()].sort((a, b) => a.createdAt - b.createdAt).map((p) => ({ ...p }));
      },
      async list(sessionId) {
        return [...photos.values()].filter((p) => p.sessionId === sessionId).sort((a, b) => a.createdAt - b.createdAt).map((p) => ({ ...p }));
      },
      async add(photo) {
        photos.set(photo.id, { ...photo });
      },
      async remove(id) {
        photos.delete(id);
      },
      async removeForSession(sessionId) {
        dropPhotos(sessionId);
      },
      async prune() {
        const orphans = [...photos.values()].filter((p) => !tables.sessions.has(p.sessionId));
        for (const p of orphans) photos.delete(p.id);
        return orphans.length;
      },
      async clear() {
        photos.clear();
      },
    },
    routines: table("routines"),
    exercises: table("exercises"),
    locations: table("locations"),
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
      async get<K extends KvKey>(k: K) {
        return kv.has(k) ? clone(kv.get(k) as KvValues[K]) : undefined;
      },
      async set(k, value) {
        setKv(k, value, true);
      },
      async remove(k) {
        if (TRACKED_KV.includes(k)) for (const c of kvChanges(k, kv.get(k), undefined)) mark(c.kind, c.id, c.deleted);
        kv.delete(k);
      },
    },
    sync: {
      async pending() {
        const out: SyncRecord[] = [];
        for (const s of status.values()) {
          if (s.status !== "pending_sync") continue;
          const rec = s.deleted ? null : record(s.kind, s.id, s);
          out.push(rec ?? { kind: s.kind, id: s.id, payload: null, updatedAt: s.localUpdatedAt, deleted: true });
        }
        return out;
      },
      async get(kind, id) {
        const s = status.get(key(kind, id)) ?? null;
        return { record: s?.deleted ? null : record(kind, id, s), status: s ? clone(s) : null };
      },
      async applyRemote(rec, at, expected) {
        if (expected !== undefined && (status.get(key(rec.kind, rec.id))?.localUpdatedAt ?? null) !== expected) return false;
        const name = KIND_TABLES[rec.kind];
        if (name) {
          const map = tables[name] as Map<string, unknown>;
          if (rec.deleted) {
            map.delete(rec.id);
            if (rec.kind === "session") dropPhotos(rec.id);
          } else map.set(rec.id, clone(rec.payload));
        } else if (!(rec.kind === "settings" && rec.deleted)) {
          const { key: k, value } = kvApply(rec, { bodyweightLog: kv.get("bodyweightLog"), exerciseMedia: kv.get("exerciseMedia") });
          setKv(k, value, false);
        }
        status.set(key(rec.kind, rec.id), {
          kind: rec.kind,
          id: rec.id,
          status: "synced",
          localUpdatedAt: rec.updatedAt,
          lastSyncedAt: at,
          deleted: rec.deleted,
        });
        return true;
      },
      async markSynced(kind, id, version, at) {
        const s = status.get(key(kind, id));
        if (s && s.localUpdatedAt === version) status.set(key(kind, id), { ...s, status: "synced", lastSyncedAt: at });
      },
      async purgeTombstones(olderThan) {
        let n = 0;
        for (const [k, s] of status) {
          if (s.deleted && s.status === "synced" && (s.lastSyncedAt ?? 0) < olderThan) {
            status.delete(k);
            n++;
          }
        }
        return n;
      },
      async markAllPending() {
        for (const name of Object.keys(tables) as TableName[]) {
          for (const id of tables[name].keys()) mark(TABLE_KINDS[name], id, false);
        }
        for (const k of TRACKED_KV) for (const item of kvItems(k, kv.get(k))) mark(item.kind, item.id, false);
      },
    },
    async replaceAll(data) {
      for (const name of Object.keys(tables) as TableName[]) {
        const incoming = new Set(data[name].map((r) => r.id));
        for (const id of tables[name].keys()) if (!incoming.has(id)) mark(TABLE_KINDS[name], id, true);
        tables[name].clear();
        putRows(name, data[name]);
      }
      if (data.settings) setKv("settings", data.settings, true);
      else kv.delete("settings");
      kv.set("activeWorkout", clone(data.activeWorkout));
      kv.set("restTimer", null);
      setKv("exerciseMedia", data.exerciseMedia, true);
      setKv("bodyweightLog", data.bodyweightLog, true);
      kv.set("foodLog", clone(data.foodLog ?? []));
      await repo.photos.prune();
    },
    async commitFinishedWorkout(session) {
      putRows("sessions", [session]);
      kv.set("activeWorkout", null);
      kv.set("restTimer", null);
    },
    async mergeAll(data) {
      for (const name of Object.keys(tables) as TableName[]) putRows(name, data[name]);
      setKv("exerciseMedia", { ...((kv.get("exerciseMedia") as object) ?? {}), ...data.exerciseMedia }, true);
      setKv("bodyweightLog", mergeLog((kv.get("bodyweightLog") as KvValues["bodyweightLog"]) ?? [], data.bodyweightLog), true);
    },
    async snapshot() {
      return {
        sessions: await repo.sessions.all(),
        routines: await repo.routines.all(),
        exercises: await repo.exercises.all(),
        locations: await repo.locations.all(),
        settings: (await repo.kv.get("settings")) ?? null,
        activeWorkout: (await repo.kv.get("activeWorkout")) ?? null,
        exerciseMedia: (await repo.kv.get("exerciseMedia")) ?? {},
        bodyweightLog: (await repo.kv.get("bodyweightLog")) ?? [],
        foodLog: (await repo.kv.get("foodLog")) ?? [],
      };
    },
    async wipe() {
      for (const t of Object.values(tables)) t.clear();
      kv.clear();
      status.clear();
      photos.clear();
      catalog = [];
    },
  };
  return repo;
}
