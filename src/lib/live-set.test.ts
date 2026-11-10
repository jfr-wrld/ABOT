import { describe, expect, it } from "vitest";
import type { SessionExercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { liveSet, setProgress } from "./live-set";

const set = (completed: boolean, type: WorkoutSet["type"] = "normal"): WorkoutSet => ({
  id: Math.random().toString(36),
  type,
  weightKg: 60,
  reps: 8,
  rpe: null,
  completed,
});
const exercise = (id: string, sets: WorkoutSet[]): SessionExercise => ({ id, exerciseId: id, sets, restSeconds: 90 });
const session = (exercises: SessionExercise[]): WorkoutSession => ({ id: "w", name: "Push", startedAt: 0, status: "active", exercises });

describe("liveSet", () => {
  it("is the first set not done, counted without warm-ups", () => {
    const s = session([
      exercise("bench", [set(true, "warmup"), set(true), set(false), set(false)]),
      exercise("row", [set(false)]),
    ]);
    const live = liveSet(s)!;
    expect(live.exercise.id).toBe("bench");
    expect(live.number).toBe(2);
    expect(live.of).toBe(3);
    expect(live.last).toBe(s.exercises[0]!.sets[1]);
  });

  it("moves to the next exercise once one is finished", () => {
    const s = session([exercise("bench", [set(true)]), exercise("row", [set(false, "warmup"), set(false)])]);
    expect(liveSet(s)).toMatchObject({ number: null, of: 1, exercise: { id: "row" } });
  });

  it("is null when every set is done or there is nothing yet", () => {
    expect(liveSet(session([exercise("bench", [set(true)])]))).toBeNull();
    expect(liveSet(session([]))).toBeNull();
  });
});

describe("setProgress", () => {
  it("counts every set, warm-ups included", () => {
    const s = session([exercise("bench", [set(true, "warmup"), set(true), set(false)]), exercise("row", [set(false)])]);
    expect(setProgress(s)).toEqual({ done: 2, total: 4 });
  });
});
