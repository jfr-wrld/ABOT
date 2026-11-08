import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import type { Repository } from "./types";
import { createMemoryRepository } from "./memory";
import { AbotDB, createDexieRepository } from "./dexie";
import type { Routine, WorkoutSession } from "@/types/workout";
import { DEFAULT_SETTINGS } from "@/types/workout";

const session = (id: string): WorkoutSession => ({
  id,
  name: id,
  startedAt: 1,
  finishedAt: 2,
  status: "completed",
  exercises: [],
});
const routine = (id: string): Routine => ({ id, name: id, exercises: [], createdAt: 1, updatedAt: 1 });
const settings = { ...DEFAULT_SETTINGS, showRpe: true };
const keys = async (repo: Repository) => (await repo.sync.pending()).map((r) => `${r.kind}:${r.id}${r.deleted ? "-" : ""}`).sort();

describe.each([
  ["memory", () => createMemoryRepository()],
  ["dexie", () => createDexieRepository(`t-${crypto.randomUUID()}`)],
] as [string, () => Repository][])("%s repository sync metadata", (_name, make) => {
  it("a put is pending with its local time and the row as payload", async () => {
    const repo = make();
    const before = Date.now();
    await repo.sessions.put(session("a"));
    const [rec] = await repo.sync.pending();
    expect(rec).toMatchObject({ kind: "session", id: "a", deleted: false, payload: session("a") });
    expect(rec!.updatedAt).toBeGreaterThanOrEqual(before);
    const { status } = await repo.sync.get("session", "a");
    expect(status).toMatchObject({ status: "pending_sync", lastSyncedAt: null, deleted: false });
  });

  it("remove hides the row and leaves a pending tombstone", async () => {
    const repo = make();
    await repo.routines.put(routine("r"));
    await repo.routines.remove("r");
    expect(await repo.routines.all()).toEqual([]);
    expect(await keys(repo)).toEqual(["routine:r-"]);
  });

  it("applyRemote stores the row as synced, not pending", async () => {
    const repo = make();
    await repo.sync.applyRemote({ kind: "routine", id: "r", payload: routine("r"), updatedAt: 50, deleted: false }, 60);
    expect(await repo.routines.all()).toEqual([routine("r")]);
    expect(await keys(repo)).toEqual([]);
    expect((await repo.sync.get("routine", "r")).status).toMatchObject({ status: "synced", localUpdatedAt: 50, lastSyncedAt: 60 });
  });

  it("a remote tombstone deletes the local row", async () => {
    const repo = make();
    await repo.sync.applyRemote({ kind: "routine", id: "r", payload: routine("r"), updatedAt: 50, deleted: false }, 60);
    await repo.sync.applyRemote({ kind: "routine", id: "r", payload: null, updatedAt: 70, deleted: true }, 80);
    expect(await repo.routines.all()).toEqual([]);
    expect((await repo.sync.get("routine", "r")).record).toBeNull();
  });

  it("markSynced clears pending, but not if the row changed after it was read", async () => {
    const repo = make();
    await repo.sessions.put(session("a"));
    const [rec] = await repo.sync.pending();
    await repo.sync.markSynced("session", "a", rec!.updatedAt, 99);
    expect(await keys(repo)).toEqual([]);

    await repo.sessions.put({ ...session("a"), name: "edited" });
    const [edited] = await repo.sync.pending();
    await repo.sync.markSynced("session", "a", edited!.updatedAt - 1, 100);
    expect(await keys(repo)).toEqual(["session:a"]);
  });

  it("settings, weigh-ins and custom videos are tracked per item", async () => {
    const repo = make();
    await repo.kv.set("settings", settings);
    await repo.kv.set("bodyweightLog", [
      { id: "2026-11-01", date: 1, weightKg: 80 },
      { id: "2026-11-02", date: 2, weightKg: 79 },
    ]);
    await repo.kv.set("exerciseMedia", { "squat-barbell": { customVideoUrl: "https://youtu.be/aaaaaaaaaaa" } });
    expect(await keys(repo)).toEqual(["bodyweight:2026-11-01", "bodyweight:2026-11-02", "media:squat-barbell", "settings:settings"]);

    for (const r of await repo.sync.pending()) await repo.sync.markSynced(r.kind, r.id, r.updatedAt, 5);
    await repo.kv.set("bodyweightLog", [{ id: "2026-11-02", date: 2, weightKg: 78.5 }]);
    await repo.kv.set("exerciseMedia", {});
    expect(await keys(repo)).toEqual(["bodyweight:2026-11-01-", "bodyweight:2026-11-02", "media:squat-barbell-"]);
  });

  it("the in-progress workout and rest timer are never synced", async () => {
    const repo = make();
    await repo.kv.set("activeWorkout", { ...session("live"), status: "active" });
    await repo.kv.set("restTimer", { endsAt: 1, totalSec: 90, sessionExerciseId: "x" });
    expect(await keys(repo)).toEqual([]);
  });

  it("finishing a workout marks the new session pending", async () => {
    const repo = make();
    await repo.commitFinishedWorkout(session("done"));
    expect(await keys(repo)).toEqual(["session:done"]);
  });

  it("purgeTombstones removes only synced tombstones older than the cutoff", async () => {
    const repo = make();
    await repo.routines.put(routine("old"));
    await repo.routines.put(routine("new"));
    await repo.routines.put(routine("pending"));
    for (const id of ["old", "new", "pending"]) await repo.routines.remove(id);
    await repo.sync.markSynced("routine", "old", (await repo.sync.get("routine", "old")).status!.localUpdatedAt, 100);
    await repo.sync.markSynced("routine", "new", (await repo.sync.get("routine", "new")).status!.localUpdatedAt, 900);
    expect(await repo.sync.purgeTombstones(500)).toBe(1);
    expect((await repo.sync.get("routine", "old")).status).toBeNull();
    expect((await repo.sync.get("routine", "new")).status).not.toBeNull();
    expect(await keys(repo)).toEqual(["routine:pending-"]);
  });

  it("markAllPending queues every local item, for a first sign-in or a new account", async () => {
    const repo = make();
    await repo.sync.applyRemote({ kind: "session", id: "s", payload: session("s"), updatedAt: 5, deleted: false }, 6);
    await repo.kv.set("settings", settings);
    await repo.sync.markSynced("settings", "settings", (await repo.sync.get("settings", "settings")).status!.localUpdatedAt, 7);
    expect(await keys(repo)).toEqual([]);
    await repo.sync.markAllPending();
    expect(await keys(repo)).toEqual(["session:s", "settings:settings"]);
  });

  it("an import marks what it brings in, and replace leaves tombstones for what it removes", async () => {
    const repo = make();
    await repo.sync.applyRemote({ kind: "routine", id: "gone", payload: routine("gone"), updatedAt: 5, deleted: false }, 6);
    await repo.replaceAll({
      sessions: [session("a")],
      routines: [],
      exercises: [],
      locations: [],
      settings: null,
      activeWorkout: null,
      exerciseMedia: {},
      bodyweightLog: [],
    });
    expect(await keys(repo)).toEqual(["routine:gone-", "session:a"]);
    await repo.mergeAll({ sessions: [], routines: [routine("m")], exercises: [], locations: [], exerciseMedia: {}, bodyweightLog: [] });
    expect(await keys(repo)).toContain("routine:m");
  });
});

describe("Dexie upgrade", () => {
  it("a database from before sync marks its existing data pending, so guest data uploads", async () => {
    const name = `t-${crypto.randomUUID()}`;
    // The v2 schema exactly as shipped before Task 15.
    const old = new Dexie(name);
    old.version(1).stores({ sessions: "id, startedAt, status", routines: "id", exercises: "id", locations: "id", kv: "key" });
    old.version(2).stores({ catalog: "id" });
    await old.open();
    await old.table("sessions").put(session("guest"));
    await old.table("kv").put({ key: "settings", value: settings });
    await old.table("kv").put({ key: "bodyweightLog", value: [{ id: "2026-11-01", date: 1, weightKg: 80 }] });
    old.close();

    const repo = createDexieRepository(name, new AbotDB(name));
    expect(await keys(repo)).toEqual(["bodyweight:2026-11-01", "session:guest", "settings:settings"]);
  });
});
