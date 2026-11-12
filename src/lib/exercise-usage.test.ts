import { describe, expect, it } from "vitest";
import { exerciseUsage, recentExercises } from "./exercise-usage";
import type { WorkoutSession } from "@/types/workout";

const s = (id: string, at: number, ids: string[], status: WorkoutSession["status"] = "completed"): WorkoutSession => ({
  id,
  name: id,
  startedAt: at - 1000,
  finishedAt: at,
  status,
  exercises: ids.map((x, i) => ({ id: `${id}-${i}`, exerciseId: x, sets: [], restSeconds: 90 })),
});

describe("exercise usage", () => {
  const sessions = [s("a", 100, ["squat", "bench"]), s("b", 300, ["bench", "row", "bench"]), s("c", 200, ["curl"]), s("live", 400, ["press"], "active")];

  it("counts finished workouts per exercise and when each was last done", () => {
    const u = exerciseUsage(sessions);
    expect(u.uses).toEqual({ squat: 1, bench: 2, row: 1, curl: 1 });
    expect(u.lastDone.bench).toBe(300);
    expect(u.lastDone.press).toBeUndefined();
  });

  it("lists the most recent exercises once each, newest workout first", () => {
    expect(recentExercises(sessions, 8)).toEqual(["bench", "row", "curl", "squat"]);
    expect(recentExercises(sessions, 2)).toEqual(["bench", "row"]);
  });
});
