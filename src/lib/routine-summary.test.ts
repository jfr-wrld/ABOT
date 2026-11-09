import { describe, expect, it } from "vitest";
import { routineSummary } from "./routine-summary";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, Routine, RoutineSet } from "@/types/workout";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const set = (reps: number | null, type: RoutineSet["type"] = "normal"): RoutineSet => ({ id: Math.random().toString(36), type, targetWeightKg: null, targetReps: reps });
const routine = (exercises: Routine["exercises"]): Routine => ({ id: "r", name: "R", exercises, createdAt: 0, updatedAt: 0 });

describe("routineSummary", () => {
  it("reads a push routine like a template: focus, minutes, muscles, sets x reps", () => {
    const s = routineSummary(
      routine([
        { id: "a", exerciseId: "bench-press-barbell", restSeconds: 120, sets: [set(5, "warmup"), set(8), set(8), set(8)] },
        { id: "b", exerciseId: "overhead-press-barbell", restSeconds: 90, sets: [set(8), set(10), set(12)] },
      ]),
      byId,
    );
    expect(s.focus?.label).toBe("Push");
    expect(s.muscles[0]).toBe("chest");
    expect(s.sets).toBe(7);
    expect(s.lines.map((l) => [l.sets, l.reps])).toEqual([[3, "8"], [3, "8-12"]]);
    expect(s.minutes % 5).toBe(0);
    expect(s.minutes).toBeGreaterThanOrEqual(20);
  });

  it("an empty routine has no focus and no time", () => {
    expect(routineSummary(routine([]), byId)).toMatchObject({ focus: null, minutes: 0, muscles: [], sets: 0 });
  });

  it("no target reps reads as null", () => {
    const s = routineSummary(routine([{ id: "a", exerciseId: "squat-barbell", restSeconds: 60, sets: [set(null), set(null)] }]), byId);
    expect(s.lines[0]).toMatchObject({ sets: 2, reps: null });
    expect(s.focus?.label).toBe("Legs");
  });
});
