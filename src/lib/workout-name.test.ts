import { describe, expect, it } from "vitest";
import { isTimeOfDayName, muscleWorkoutName } from "./workout-name";
import { currentT } from "@/i18n";
import type { Exercise, WorkoutSession } from "@/types/workout";

const t = currentT();
const ex = (id: string, muscle: string) => ({ id, name: id, primaryMuscles: [muscle] }) as unknown as Exercise;
const byId = { bench: ex("bench", "chest"), fly: ex("fly", "chest"), push: ex("push", "triceps"), curl: ex("curl", "biceps") };
const set = (completed: boolean, type = "normal") => ({ id: Math.random().toString(), completed, type, weightKg: 50, reps: 8 });
const session = (items: [string, ReturnType<typeof set>[]][]) =>
  ({ name: "Evening Workout", exercises: items.map(([exerciseId, sets], i) => ({ id: `e${i}`, exerciseId, sets })) }) as unknown as WorkoutSession;

describe("muscleWorkoutName", () => {
  it("names the two muscles with the most working sets", () => {
    const s = session([
      ["bench", [set(true), set(true)]],
      ["fly", [set(true)]],
      ["push", [set(true), set(true), set(false)]],
      ["curl", [set(true), set(true, "warmup")]],
    ]);
    expect(muscleWorkoutName(s, byId, t)).toBe("Chest & Triceps");
  });

  it("is null with nothing done", () => {
    expect(muscleWorkoutName(session([["bench", [set(false), set(true, "warmup")]]]), byId, t)).toBeNull();
  });
});

describe("isTimeOfDayName", () => {
  it("knows the start names and leaves a chosen one alone", () => {
    expect(isTimeOfDayName("Morning Workout", t)).toBe(true);
    expect(isTimeOfDayName("Push A", t)).toBe(false);
  });
});
