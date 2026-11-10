import { describe, expect, it } from "vitest";
import { suggestNext, todaysTargets } from "./exercise-suggest";
import { SEED_EXERCISES, SEED_EXERCISES_BY_ID } from "@/data/exercises";
import type { Routine, WorkoutSession } from "@/types/workout";

const push: Routine = {
  id: "push",
  name: "Push",
  createdAt: 0,
  updatedAt: 0,
  exercises: ["bench-press-barbell", "overhead-press-barbell", "triceps-pushdown-cable"].map((exerciseId, i) => ({
    id: `r${i}`,
    exerciseId,
    restSeconds: 90,
    sets: [],
  })),
};
const session = (ids: string[], routineId?: string): WorkoutSession => ({
  id: "s",
  name: "Workout",
  startedAt: 0,
  status: "active",
  routineId,
  exercises: ids.map((exerciseId, i) => ({ id: `e${i}`, exerciseId, restSeconds: 90, sets: [] })),
});
const off = { enabled: false, days: {} } as never;

describe("next exercise suggestions", () => {
  it("targets the muscles of the routine this workout came from", () => {
    const t = todaysTargets(session([], "push"), [push], [], off, SEED_EXERCISES_BY_ID);
    expect(t?.muscles).toEqual(["chest", "shoulders", "triceps"]);
  });

  it("suggests the targets not yet in the workout, the routine's own pick first", () => {
    const active = session(["bench-press-barbell"], "push");
    const t = todaysTargets(active, [push], [], off, SEED_EXERCISES_BY_ID)!;
    const s = suggestNext(active, t, SEED_EXERCISES, [], SEED_EXERCISES_BY_ID);
    expect(s.map((x) => x.muscle)).toEqual(["shoulders", "shoulders", "triceps", "triceps"]);
    expect(s[0].exercise.id).toBe("overhead-press-barbell");
    expect(s[2].exercise.id).toBe("triceps-pushdown-cable");
    expect(s.some((x) => x.exercise.id === "bench-press-barbell")).toBe(false);
  });

  it("an empty workout follows the routine due next, and nothing is left once all targets are in", () => {
    const empty = session([]);
    expect(todaysTargets(empty, [push], [], off, SEED_EXERCISES_BY_ID)?.routine.id).toBe("push");
    const full = session(["bench-press-barbell", "overhead-press-barbell", "triceps-pushdown-cable"], "push");
    const t = todaysTargets(full, [push], [], off, SEED_EXERCISES_BY_ID)!;
    expect(suggestNext(full, t, SEED_EXERCISES, [], SEED_EXERCISES_BY_ID)).toEqual([]);
    expect(todaysTargets(empty, [], [], off, SEED_EXERCISES_BY_ID)).toBeNull();
  });
});
