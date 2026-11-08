import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepository, type Repository } from "@/data/repo";
import { attachPersistence, hydrateStores } from "./persistence";
import { useWorkoutStore } from "./useWorkoutStore";
import { useRoutineStore } from "./useRoutineStore";
import { useExerciseStore } from "./useExerciseStore";
import { useSettingsStore } from "./useSettingsStore";
import { useLocationStore } from "./useLocationStore";
import { useHydration } from "./hydration";
import type { WorkoutSession } from "@/types/workout";

const initial = {
  workout: useWorkoutStore.getState(),
  routines: useRoutineStore.getState(),
  exercises: useExerciseStore.getState(),
  settings: useSettingsStore.getState(),
  locations: useLocationStore.getState(),
  hydration: useHydration.getState(),
};

let detach: (() => void) | null = null;

beforeEach(() => {
  useWorkoutStore.setState(initial.workout, true);
  useRoutineStore.setState(initial.routines, true);
  useExerciseStore.setState(initial.exercises, true);
  useSettingsStore.setState(initial.settings, true);
  useLocationStore.setState(initial.locations, true);
  useHydration.setState(initial.hydration, true);
});
afterEach(() => {
  detach?.();
  detach = null;
});

const finished = (id: string): WorkoutSession => ({
  id,
  name: id,
  startedAt: 1,
  finishedAt: 2,
  status: "completed",
  exercises: [],
});

async function attach(repo: Repository) {
  const p = attachPersistence(repo);
  detach = p.detach;
  return p;
}

function startWithExercise() {
  useWorkoutStore.getState().startEmpty(90);
  useWorkoutStore.getState().addExercise("bench-press-barbell", 90);
  const ex = useWorkoutStore.getState().active!.exercises[0]!;
  return { exId: ex.id, setId: ex.sets[0]!.id };
}

describe("hydrateStores", () => {
  it("loads every store from the repository", async () => {
    const repo = createMemoryRepository();
    await repo.sessions.put(finished("s1"));
    await repo.routines.put({ id: "r1", name: "Push", exercises: [], createdAt: 1, updatedAt: 1 });
    await repo.locations.put({ id: "g", name: "Gym", barWeightKg: 20, plateInventoryKg: [20], isDefault: true });
    await repo.kv.set("settings", {
      weightUnit: "lbs",
      defaultRestSeconds: 120,
      restTimerAlert: false,
      firstDayOfWeek: 0,
      activeLocationId: "g",
      showRpe: false,
    });
    await repo.kv.set("activeWorkout", { ...finished("live"), status: "active", finishedAt: undefined });
    await hydrateStores(repo);
    expect(useWorkoutStore.getState().sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(useWorkoutStore.getState().active?.id).toBe("live");
    expect(useRoutineStore.getState().routines[0]!.name).toBe("Push");
    expect(useLocationStore.getState().locations[0]!.name).toBe("Gym");
    expect(useSettingsStore.getState().weightUnit).toBe("lbs");
    expect(useSettingsStore.getState().showRpe).toBe(false);
  });
});

describe("attachPersistence", () => {
  it("ticking a set is synchronous and lands in the repository after flush", async () => {
    const repo = createMemoryRepository();
    const p = await attach(repo);
    const { exId, setId } = startWithExercise();
    useWorkoutStore.getState().updateSet(exId, setId, { weightKg: 60, reps: 8 });
    useWorkoutStore.getState().completeSet(exId, setId, true);
    expect(useWorkoutStore.getState().active!.exercises[0]!.sets[0]!.completed).toBe(true);
    await p.flush();
    const stored = await repo.kv.get("activeWorkout");
    expect(stored?.exercises[0]!.sets[0]).toMatchObject({ weightKg: 60, reps: 8, completed: true });
    expect((await repo.kv.get("restTimer"))?.totalSec).toBe(90);
  });

  it("rapid updates leave the repository equal to the final state", async () => {
    const repo = createMemoryRepository();
    const p = await attach(repo);
    const { exId, setId } = startWithExercise();
    for (let i = 1; i <= 20; i++) useWorkoutStore.getState().updateSet(exId, setId, { reps: i });
    await p.flush();
    expect(await repo.kv.get("activeWorkout")).toEqual(useWorkoutStore.getState().active);
    expect((await repo.kv.get("activeWorkout"))!.exercises[0]!.sets[0]!.reps).toBe(20);
  });

  it("finishing writes the session and clears the active workout", async () => {
    const repo = createMemoryRepository();
    const p = await attach(repo);
    const { exId, setId } = startWithExercise();
    useWorkoutStore.getState().updateSet(exId, setId, { weightKg: 60, reps: 8 });
    useWorkoutStore.getState().completeSet(exId, setId, true);
    const done = useWorkoutStore.getState().finishActive()!;
    await p.flush();
    expect((await repo.sessions.all()).map((s) => s.id)).toEqual([done.id]);
    expect(await repo.kv.get("activeWorkout")).toBeNull();
    useWorkoutStore.getState().deleteSession(done.id);
    await p.flush();
    expect(await repo.sessions.all()).toEqual([]);
  });

  it("persists routines, custom exercises, locations and settings", async () => {
    const repo = createMemoryRepository();
    const p = await attach(repo);
    const r = useRoutineStore.getState().create("Legs");
    const e = useExerciseStore.getState().addCustom({
      name: "Pendlay Row",
      primaryMuscle: "back",
      secondaryMuscles: [],
      equipment: "barbell",
    });
    const g = useLocationStore.getState().add("Gym A");
    useSettingsStore.getState().update({ weightUnit: "lbs" });
    await p.flush();
    expect((await repo.routines.all()).map((x) => x.id)).toEqual([r.id]);
    expect((await repo.exercises.all()).map((x) => x.id)).toEqual([e.id]);
    expect((await repo.locations.all()).map((x) => x.id)).toEqual([g.id]);
    expect((await repo.kv.get("settings"))?.weightUnit).toBe("lbs");
    useRoutineStore.getState().remove(r.id);
    await p.flush();
    expect(await repo.routines.all()).toEqual([]);
  });

  it("a failing repository reports the error and the stores keep working", async () => {
    const repo = createMemoryRepository();
    repo.kv.set = async () => {
      throw new Error("QuotaExceededError");
    };
    const p = await attach(repo);
    const { exId, setId } = startWithExercise();
    useWorkoutStore.getState().updateSet(exId, setId, { reps: 5 });
    await p.flush();
    expect(useHydration.getState().error).toMatch(/QuotaExceededError/);
    expect(useWorkoutStore.getState().active!.exercises[0]!.sets[0]!.reps).toBe(5);
  });
});

describe("useLocationStore", () => {
  it("adds, renames, sets a single default and removes", () => {
    const s = useLocationStore.getState();
    const a = s.add("Gym A");
    const b = useLocationStore.getState().add("Gym B");
    expect(useLocationStore.getState().locations.find((l) => l.id === a.id)!.isDefault).toBe(true);
    useLocationStore.getState().setDefault(b.id);
    const locs = useLocationStore.getState().locations;
    expect(locs.filter((l) => l.isDefault).map((l) => l.id)).toEqual([b.id]);
    useLocationStore.getState().update(a.id, { name: "Home gym", barWeightKg: 15 });
    expect(useLocationStore.getState().locations.find((l) => l.id === a.id)).toMatchObject({ name: "Home gym", barWeightKg: 15 });
    useLocationStore.getState().remove(b.id);
    expect(useLocationStore.getState().locations.map((l) => l.id)).toEqual([a.id]);
    expect(useLocationStore.getState().locations[0]!.isDefault).toBe(true);
  });
});

describe("hydrateStores while persistence is attached", () => {
  it("does not write the loaded data back to the repository", async () => {
    const repo = createMemoryRepository();
    await repo.sessions.put(finished("s1"));
    await repo.routines.put({ id: "r1", name: "Push", exercises: [], createdAt: 1, updatedAt: 1 });
    const p = await attach(repo);
    let writes = 0;
    for (const t of [repo.sessions, repo.routines, repo.exercises, repo.locations]) {
      const put = t.put.bind(t);
      t.put = async (x: never) => {
        writes++;
        return put(x);
      };
    }
    const kvSet = repo.kv.set.bind(repo.kv);
    repo.kv.set = async (k, v) => {
      writes++;
      return kvSet(k, v);
    };
    await hydrateStores(repo);
    await p.flush();
    expect(useWorkoutStore.getState().sessions).toHaveLength(1);
    expect(writes).toBe(0);
  });
});
