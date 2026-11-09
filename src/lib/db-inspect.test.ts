import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { inspectSnapshot } from "./db-inspect";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const s = (id: string, exerciseId: string, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  name: id,
  startedAt: 1,
  finishedAt: 2,
  status: "completed",
  exercises: [{ id: `${id}-e`, exerciseId, restSeconds: 90, sets: [{ id: "x", type: "normal", weightKg: 50, reps: 5, rpe: null, completed: true }] }],
  ...extra,
});

describe("inspectSnapshot", () => {
  it("a clean device reports no problems", () => {
    expect(inspectSnapshot({ sessions: [s("a", "squat-barbell")], routines: [], locations: [] }, byId, 10)).toEqual([
      { level: "ok", code: "clean", count: 0, text: "No problems found" },
    ]);
  });

  it("names unknown exercises, lone supersets, missing gyms and future dates", () => {
    const bad = s("b", "custom-gone", { locationId: "gym-x", startedAt: 10 * 86_400_000 });
    bad.exercises[0]!.supersetId = "ss1";
    const codes = inspectSnapshot({ sessions: [bad], routines: [], locations: [] }, byId, 0).map((f) => f.code);
    expect(codes).toEqual(["missing-exercise", "lone-superset", "missing-gym", "future-session"]);
  });
});
