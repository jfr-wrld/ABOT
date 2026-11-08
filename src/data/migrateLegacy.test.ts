import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "./repo";
import { migrateFromLocalStorage } from "./migrateLegacy";

const wrap = (state: unknown) => JSON.stringify({ state, version: 0 });

const legacySession = (id: string) => ({
  id,
  name: id,
  startedAt: 1000,
  finishedAt: 2000,
  status: "completed",
  exercises: [
    {
      id: `${id}-e`,
      exerciseId: "squat-barbell",
      restSeconds: 90,
      sets: [{ id: `${id}-s`, type: "normal", weightKg: 100, reps: 5, rpe: null, completed: true }],
    },
  ],
});

function storageOf(items: Record<string, string>): Pick<Storage, "getItem"> {
  // No setItem/removeItem: migration must never write to localStorage.
  return { getItem: (k: string) => items[k] ?? null };
}

const full = storageOf({
  "heavy.workouts": wrap({
    sessions: [legacySession("a"), legacySession("b")],
    active: { ...legacySession("live"), status: "active", finishedAt: undefined },
    restTimer: null,
  }),
  "heavy.routines": wrap({ routines: [{ id: "r1", name: "Push", exercises: [], createdAt: 1, updatedAt: 1 }] }),
  "heavy.exercises": wrap({
    custom: [{ id: "custom-1", name: "Pendlay Row", primaryMuscle: "back", secondaryMuscles: [], equipment: "barbell", isCustom: true }],
  }),
  "heavy.settings": wrap({
    weightUnit: "lbs",
    defaultRestSeconds: 120,
    restTimerAlert: true,
    firstDayOfWeek: 1,
    showRpe: false,
  }),
});

describe("migrateFromLocalStorage", () => {
  it("moves every legacy store into the repository", async () => {
    const repo = createMemoryRepository();
    const r = await migrateFromLocalStorage(repo, full);
    expect(r).toEqual({ migrated: true, counts: { sessions: 2, routines: 1, exercises: 1 } });
    const snap = await repo.snapshot();
    expect(snap.sessions.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(snap.activeWorkout?.id).toBe("live");
    expect(snap.routines[0]!.name).toBe("Push");
    expect(snap.exercises[0]!.loadMode).toBe("total");
    expect(snap.settings).toMatchObject({ weightUnit: "lbs", showRpe: false, activeLocationId: null });
    expect(await repo.kv.get("migratedFromLocalStorage")).toBe(true);
  });

  it("does nothing the second time and does not duplicate", async () => {
    const repo = createMemoryRepository();
    await migrateFromLocalStorage(repo, full);
    await repo.sessions.remove("a"); // user deleted one after migrating
    const again = await migrateFromLocalStorage(repo, full);
    expect(again.migrated).toBe(false);
    expect((await repo.sessions.all()).map((s) => s.id)).toEqual(["b"]);
  });

  it("migrates the readable keys when one key is corrupt", async () => {
    const repo = createMemoryRepository();
    const r = await migrateFromLocalStorage(
      repo,
      storageOf({
        "heavy.workouts": "{not json",
        "heavy.routines": wrap({ routines: [{ id: "r1", name: "Push", exercises: [], createdAt: 1, updatedAt: 1 }] }),
      }),
    );
    expect(r.migrated).toBe(true);
    expect(r.counts).toEqual({ sessions: 0, routines: 1, exercises: 0 });
  });

  it("marks a device with no legacy data as migrated without writing rows", async () => {
    const repo = createMemoryRepository();
    const r = await migrateFromLocalStorage(repo, storageOf({}));
    expect(r.migrated).toBe(false);
    expect(await repo.kv.get("migratedFromLocalStorage")).toBe(true);
    expect((await repo.snapshot()).sessions).toEqual([]);
  });

  it("does not set the flag when a write fails, so the next start retries", async () => {
    const repo = createMemoryRepository();
    repo.routines.put = async () => {
      throw new Error("disk full");
    };
    await expect(migrateFromLocalStorage(repo, full)).rejects.toThrow("disk full");
    expect(await repo.kv.get("migratedFromLocalStorage")).toBeUndefined();
  });
});
