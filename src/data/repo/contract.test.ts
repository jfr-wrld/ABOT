import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { Repository, RepoSnapshot } from "./types";
import { createMemoryRepository } from "./memory";
import { createDexieRepository } from "./dexie";
import { getRepository } from "./index";
import type { GymLocation, Routine, WorkoutSession } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const session = (id: string, startedAt = 1): WorkoutSession => ({
  id,
  name: id,
  startedAt,
  finishedAt: startedAt + 1000,
  status: "completed",
  exercises: [
    {
      id: `${id}-e`,
      exerciseId: "squat-barbell",
      restSeconds: 90,
      sets: [{ id: `${id}-s`, type: "normal", weightKg: 100, reps: 5, rpe: 8, completed: true }],
    },
  ],
});
const routine = (id: string): Routine => ({ id, name: id, exercises: [], createdAt: 1, updatedAt: 1 });
const location = (id: string): GymLocation => ({
  id,
  name: id,
  barWeightKg: 20,
  plateInventoryKg: [25, 20, 10, 5, 2.5, 1.25],
  isDefault: false,
});
const custom = { ...SEED_EXERCISES[0]!, id: "custom-1", name: "Custom", isCustom: true };

describe.each([
  ["memory", () => createMemoryRepository()],
  ["dexie", () => createDexieRepository(`t-${crypto.randomUUID()}`)],
] as [string, () => Repository][])("%s repository", (_name, make) => {
  it("round-trips sessions, routines, exercises and locations", async () => {
    const repo = make();
    await repo.sessions.put(session("a"));
    await repo.sessions.put(session("b", 2));
    await repo.routines.put(routine("r"));
    await repo.exercises.put(custom);
    await repo.locations.put(location("gym"));
    expect((await repo.sessions.all()).map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(await repo.routines.all()).toEqual([routine("r")]);
    expect(await repo.exercises.all()).toEqual([custom]);
    expect(await repo.locations.all()).toEqual([location("gym")]);
    await repo.sessions.remove("a");
    expect((await repo.sessions.all()).map((s) => s.id)).toEqual(["b"]);
  });

  it("put with an existing id overwrites", async () => {
    const repo = make();
    await repo.sessions.put(session("a"));
    await repo.sessions.put({ ...session("a"), name: "renamed" });
    const all = await repo.sessions.all();
    expect(all).toHaveLength(1);
    expect(all[0]!.name).toBe("renamed");
  });

  it("kv returns undefined for a missing key and stores values", async () => {
    const repo = make();
    expect(await repo.kv.get("activeWorkout")).toBeUndefined();
    await repo.kv.set("activeWorkout", session("live"));
    expect((await repo.kv.get("activeWorkout"))?.id).toBe("live");
    await repo.kv.set("activeWorkout", null);
    expect(await repo.kv.get("activeWorkout")).toBeNull();
    await repo.kv.remove("activeWorkout");
    expect(await repo.kv.get("activeWorkout")).toBeUndefined();
  });

  it("replaceAll then snapshot returns the same data", async () => {
    const repo = make();
    await repo.sessions.put(session("old"));
    const data: RepoSnapshot = {
      sessions: [session("x")],
      routines: [routine("y")],
      exercises: [custom],
      locations: [location("z")],
      settings: {
        weightUnit: "lbs",
        defaultRestSeconds: 120,
        restTimerAlert: false,
        firstDayOfWeek: 0,
        activeLocationId: "z",
        showRpe: false,
        profileName: "Jafar",
        profileHandle: "jafar.lifts",
        language: "id",
        theme: "light",
        visualEffects: "lite",
        tapFeedback: false,
        healthAutoSync: true,
        lastSleep: { minutes: 430, endAt: 1_700_000_000_000 },
        entitlement: {
          tier: "lifetime",
          isFounder: true,
          founderUnitCode: "FOUNDER // #0421",
          founderJoinedAt: "2026-11-09T00:00:00.000Z",
          proExpiresAt: null,
          licenseSource: "account",
          devOverrideMode: "FORCE_FREE",
        },
        bodyweightKg: 72.5,
        heightCm: 170,
        profilePhoto: null,
        bodyPhase: null,
      },
      activeWorkout: { ...session("live"), status: "active", finishedAt: undefined },
      exerciseMedia: { "bench-press-barbell": { customVideoUrl: "https://youtu.be/dQw4w9WgXcQ" } },
      bodyweightLog: [{ id: "2026-11-01", date: 1, weightKg: 80 }],
      foodLog: [{ id: "f1", day: "2026-11-01", at: 1, meal: "lunch", foodId: "tempeh", name: "Tempeh", grams: 100, kcal: 201, protein: 20.8, carbs: 13.5, fat: 8.8 }],
    };
    await repo.replaceAll(data);
    const snap = await repo.snapshot();
    expect(snap.sessions.map((s) => s.id)).toEqual(["x"]);
    expect(snap).toEqual({ ...data, activeWorkout: snap.activeWorkout });
    expect(snap.activeWorkout?.id).toBe("live");
  });
});

describe.each([
  ["memory", () => createMemoryRepository()],
  ["dexie", () => createDexieRepository(`t-${crypto.randomUUID()}`)],
] as const)("%s repository bodyweight merge", (_n, make) => {
  it("merges the log by day, the incoming entry winning", async () => {
    const repo = make();
    await repo.kv.set("bodyweightLog", [
      { id: "2026-11-01", date: 1, weightKg: 80 },
      { id: "2026-11-03", date: 3, weightKg: 79 },
    ]);
    await repo.mergeAll({
      sessions: [], routines: [], exercises: [], locations: [], exerciseMedia: {},
      bodyweightLog: [
        { id: "2026-11-01", date: 1, weightKg: 81 },
        { id: "2026-11-02", date: 2, weightKg: 80.5 },
      ],
    });
    expect((await repo.snapshot()).bodyweightLog).toEqual([
      { id: "2026-11-01", date: 1, weightKg: 81 },
      { id: "2026-11-02", date: 2, weightKg: 80.5 },
      { id: "2026-11-03", date: 3, weightKg: 79 },
    ]);
  });
});

describe("getRepository", () => {
  it("opens the durable Dexie repository when IndexedDB works", async () => {
    const r = await getRepository(`t-${crypto.randomUUID()}`);
    expect(r.durable).toBe(true);
    expect(r.error).toBeNull();
  });

  it("falls back to memory with an error when IndexedDB is missing", async () => {
    const saved = globalThis.indexedDB;
    // @ts-expect-error simulate a browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      const r = await getRepository(`t-${crypto.randomUUID()}`);
      expect(r.durable).toBe(false);
      expect(r.error).toMatch(/IndexedDB/);
      await r.repo.sessions.put(session("still-works"));
      expect(await r.repo.sessions.all()).toHaveLength(1);
    } finally {
      globalThis.indexedDB = saved;
    }
  });
});

describe.each([
  ["memory", () => createMemoryRepository()],
  ["dexie", () => createDexieRepository(`t-${crypto.randomUUID()}`)],
] as [string, () => Repository][])("%s repository, final review fixes", (_name, make) => {
  it("commitFinishedWorkout stores the session and clears the active workout and timer together", async () => {
    const repo = make();
    await repo.kv.set("activeWorkout", { ...session("live"), status: "active" });
    await repo.kv.set("restTimer", { endsAt: 1, totalSec: 90, sessionExerciseId: "x" });
    await repo.commitFinishedWorkout(session("live"));
    expect((await repo.sessions.all()).map((s) => s.id)).toEqual(["live"]);
    expect(await repo.kv.get("activeWorkout")).toBeNull();
    expect(await repo.kv.get("restTimer")).toBeNull();
  });

  it("replaceAll clears a running rest timer", async () => {
    const repo = make();
    await repo.kv.set("restTimer", { endsAt: 1, totalSec: 90, sessionExerciseId: "x" });
    await repo.replaceAll({ sessions: [], routines: [], exercises: [], locations: [], settings: null, activeWorkout: null, exerciseMedia: {}, bodyweightLog: [] });
    expect(await repo.kv.get("restTimer")).toBeNull();
  });

  it("mergeAll adds and overwrites rows by id and removes nothing", async () => {
    const repo = make();
    await repo.sessions.put(session("a"));
    await repo.sessions.put(session("b"));
    await repo.mergeAll({ sessions: [{ ...session("a"), name: "A2" }, session("c")], routines: [routine("r")], exercises: [], locations: [location("g")], exerciseMedia: {}, bodyweightLog: [] });
    expect((await repo.sessions.all()).map((s) => `${s.id}:${s.name}`).sort()).toEqual(["a:A2", "b:b", "c:c"]);
    expect((await repo.routines.all()).map((r) => r.id)).toEqual(["r"]);
    expect((await repo.locations.all()).map((l) => l.id)).toEqual(["g"]);
  });
});

describe.each([
  ["memory", () => createMemoryRepository()],
  ["dexie", () => createDexieRepository(`t-${crypto.randomUUID()}`)],
] as [string, () => Repository][])("%s repository exercise media", (_n, make) => {
  it("snapshot defaults to no custom videos", async () => {
    expect((await make().snapshot()).exerciseMedia).toEqual({});
  });
  it("mergeAll adds custom videos and the incoming link wins per exercise", async () => {
    const repo = make();
    await repo.kv.set("exerciseMedia", { a: { customVideoUrl: "https://youtu.be/aaaaaaaaaaa" }, b: { customVideoUrl: "https://youtu.be/bbbbbbbbbbb" } });
    await repo.mergeAll({ sessions: [], routines: [], exercises: [], locations: [], exerciseMedia: { b: { customVideoUrl: "https://youtu.be/BBBBBBBBBBB" }, c: { customVideoUrl: "https://youtu.be/ccccccccccc" } }, bodyweightLog: [] });
    expect((await repo.snapshot()).exerciseMedia).toEqual({
      a: { customVideoUrl: "https://youtu.be/aaaaaaaaaaa" },
      b: { customVideoUrl: "https://youtu.be/BBBBBBBBBBB" },
      c: { customVideoUrl: "https://youtu.be/ccccccccccc" },
    });
  });
});

describe.each([
  ["memory", () => createMemoryRepository()],
  ["dexie", () => createDexieRepository(`t-${crypto.randomUUID()}`)],
] as [string, () => Repository][])("%s repository, workout photos", (_name, make) => {
  const photo = (id: string, sessionId: string, createdAt: number) => ({
    id,
    sessionId,
    createdAt,
    blob: new Blob([id], { type: "image/jpeg" }),
    width: 4,
    height: 3,
  });

  it("lists a workout's photos oldest first and removes one", async () => {
    const repo = make();
    await repo.sessions.put(session("a"));
    await repo.photos.add(photo("p2", "a", 2));
    await repo.photos.add(photo("p1", "a", 1));
    await repo.photos.add(photo("x", "other", 1));
    expect((await repo.photos.list("a")).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(await (await repo.photos.list("a"))[0]!.blob.text()).toBe("p1");
    await repo.photos.remove("p1");
    expect((await repo.photos.list("a")).map((p) => p.id)).toEqual(["p2"]);
  });

  it("deleting a workout, here or from sync, deletes its photos", async () => {
    const repo = make();
    await repo.sessions.put(session("a"));
    await repo.sessions.put(session("b"));
    await repo.photos.add(photo("pa", "a", 1));
    await repo.photos.add(photo("pb", "b", 1));
    await repo.sessions.remove("a");
    expect(await repo.photos.list("a")).toEqual([]);
    await repo.sync.applyRemote({ kind: "session", id: "b", payload: null, updatedAt: 5, deleted: true }, 6);
    expect(await repo.photos.list("b")).toEqual([]);
  });

  it("photos stay out of snapshots and sync, and prune drops orphans", async () => {
    const repo = make();
    await repo.sessions.put(session("a"));
    await repo.photos.add(photo("pa", "a", 1));
    await repo.photos.add(photo("lost", "gone", 1));
    expect(JSON.stringify(await repo.snapshot())).not.toContain("pa");
    expect((await repo.sync.pending()).some((r) => r.id === "pa")).toBe(false);
    expect(await repo.photos.prune()).toBe(1);
    expect((await repo.photos.list("a")).map((p) => p.id)).toEqual(["pa"]);
  });
});
