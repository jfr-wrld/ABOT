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
      },
      activeWorkout: { ...session("live"), status: "active", finishedAt: undefined },
    };
    await repo.replaceAll(data);
    const snap = await repo.snapshot();
    expect(snap.sessions.map((s) => s.id)).toEqual(["x"]);
    expect(snap).toEqual({ ...data, activeWorkout: snap.activeWorkout });
    expect(snap.activeWorkout?.id).toBe("live");
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
