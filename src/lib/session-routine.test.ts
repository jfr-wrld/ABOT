import { describe, expect, it } from "vitest";
import { routineExercisesFrom } from "./session-routine";
import type { WorkoutSession } from "@/types/workout";

const set = (id: string, completed: boolean, weightKg: number, reps: number) => ({ id, type: "normal" as const, weightKg, reps, rpe: null, completed });

describe("routineExercisesFrom", () => {
  it("keeps the lifts and takes the done sets as targets", () => {
    let n = 0;
    const s: WorkoutSession = {
      id: "s",
      name: "Push",
      startedAt: 0,
      status: "completed",
      exercises: [
        { id: "a", exerciseId: "bench-press-barbell", restSeconds: 120, notes: "Arch", variation: "close", sets: [set("1", true, 80, 5), set("2", false, 0, 0)] },
        { id: "b", exerciseId: "push-up", restSeconds: 60, sets: [set("3", false, 0, 10)] },
      ],
    };
    const r = routineExercisesFrom(s, () => `id${n++}`);
    expect(r[0]).toMatchObject({ exerciseId: "bench-press-barbell", restSeconds: 120, notes: "Arch", variation: "close" });
    expect(r[0].sets).toEqual([{ id: "id1", type: "normal", targetWeightKg: 80, targetReps: 5 }]);
    expect(r[1].sets).toHaveLength(1);
  });
});
