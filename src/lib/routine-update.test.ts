import { describe, expect, it } from "vitest";
import { hasChanges, routineChanges, updatedRoutineExercises } from "./routine-update";
import type { Routine, SessionExercise, WorkoutSession } from "@/types/workout";

const routine: Routine = {
  id: "r",
  name: "Push A",
  createdAt: 0,
  updatedAt: 0,
  exercises: [
    { id: "re-bench", exerciseId: "bench", restSeconds: 120, sets: [{ id: "a", type: "normal", targetWeightKg: 60, targetReps: 8, targetRepsMax: 12 }] },
    { id: "re-fly", exerciseId: "fly", restSeconds: 60, sets: [{ id: "b", type: "normal", targetWeightKg: 10, targetReps: 12 }] },
  ],
};

const done = (exerciseId: string, weightKg: number, reps: number): SessionExercise => ({
  id: `s-${exerciseId}`,
  exerciseId,
  restSeconds: 90,
  sets: [{ id: `x-${exerciseId}`, type: "normal", weightKg, reps, rpe: null, completed: true }],
});

const session = (...exercises: SessionExercise[]): WorkoutSession => ({
  id: "w",
  name: "Push A",
  routineId: "r",
  startedAt: 1,
  finishedAt: 2,
  status: "completed",
  exercises,
});

describe("updating a routine from a workout", () => {
  it("sees nothing to change when the workout matched", () => {
    const same = session(done("bench", 60, 8), done("fly", 10, 12));
    expect(hasChanges(routineChanges(routine, same))).toBe(false);
  });

  it("lists new weights, swaps and dropped lifts", () => {
    const c = routineChanges(routine, session(done("bench", 62.5, 10), done("cable-fly", 15, 12)));
    expect(c).toEqual({ added: ["cable-fly"], removed: ["fly"], retargeted: ["bench"] });
  });

  it("keeps a planned rep range and the exercise id, takes the new weight", () => {
    const next = updatedRoutineExercises(routine, session(done("bench", 62.5, 11)));
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "re-bench", exerciseId: "bench" });
    expect(next[0]!.sets[0]).toMatchObject({ targetWeightKg: 62.5, targetReps: 8, targetRepsMax: 12 });
  });
});
