import { describe, expect, it } from "vitest";
import { previousComparable, sessionRecords, workedMuscles } from "./session-insights";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const DAY = 86_400_000;
const set = (w: number, r: number): WorkoutSet => ({ id: `${w}x${r}${Math.random()}`, type: "normal", weightKg: w, reps: r, rpe: null, completed: true });
const session = (id: string, at: number, ex: [string, WorkoutSet[]][], extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  name: "Push",
  startedAt: at,
  finishedAt: at + 3_600_000,
  status: "completed",
  exercises: ex.map(([exerciseId, sets], i) => ({ id: `${id}${i}`, exerciseId, restSeconds: 90, sets })),
  ...extra,
});

describe("session insights", () => {
  const first = session("a", 0, [["bench-press-barbell", [set(60, 5)]]], { routineId: "r" });
  const second = session("b", DAY, [["bench-press-barbell", [set(70, 5)]], ["overhead-press-barbell", [set(40, 5)]]], { routineId: "r" });

  it("separates beaten records from lifts done for the first time", () => {
    const r = sessionRecords(second, [first, second], byId);
    expect(new Set(r.records.map((p) => p.exerciseId))).toEqual(new Set(["bench-press-barbell"]));
    expect(r.newLifts).toEqual(["overhead-press-barbell"]);
    expect(sessionRecords(first, [first, second], byId).records).toEqual([]);
  });

  it("finds the previous session of the same routine", () => {
    expect(previousComparable(second, [first, second])?.id).toBe("a");
    expect(previousComparable(first, [first, second])).toBeNull();
  });

  it("lists primary muscles first, without repeating them as secondary", () => {
    const m = workedMuscles(second, byId);
    expect(m.primary).toContain("chest");
    expect(m.secondary.some((x) => m.primary.includes(x))).toBe(false);
  });
});
