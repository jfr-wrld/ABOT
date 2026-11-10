import { describe, expect, it } from "vitest";
import { carryFrom } from "./useWorkoutStore";
import type { SessionExercise, WorkoutSession, WorkoutSet } from "@/types/workout";

const set = (p: Partial<WorkoutSet> & { id: string }): WorkoutSet => ({ type: "normal", weightKg: null, reps: null, rpe: null, completed: false, ...p });
const ex = (sets: WorkoutSet[]): SessionExercise => ({ id: "e", exerciseId: "bench-press-barbell", restSeconds: 90, sets });

describe("a new set's starting numbers", () => {
  it("copy the last set with numbers, skipping the empty rows after it", () => {
    const e = ex([set({ id: "1", weightKg: 60, reps: 8, completed: true }), set({ id: "2" }), set({ id: "3" })]);
    expect(carryFrom(e, [])?.weightKg).toBe(60);
  });

  it("prefer a working set over a later warm-up", () => {
    const e = ex([set({ id: "1", weightKg: 80, reps: 5 }), set({ id: "2", type: "warmup", weightKg: 40, reps: 10 })]);
    expect(carryFrom(e, [])?.weightKg).toBe(80);
  });

  it("with nothing typed yet, take the last working set from the latest workout", () => {
    const old = (startedAt: number, kg: number): WorkoutSession => ({
      id: `s${startedAt}`,
      name: "W",
      startedAt,
      status: "completed",
      exercises: [ex([set({ id: "a", weightKg: kg, reps: 6, completed: true }), set({ id: "b", weightKg: kg + 5, reps: 4, completed: true })])],
    });
    expect(carryFrom(ex([set({ id: "1" })]), [old(1, 50), old(2, 70)])?.weightKg).toBe(75);
    expect(carryFrom(ex([set({ id: "1" })]), [])).toBeUndefined();
  });
});
