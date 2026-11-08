import { describe, expect, it } from "vitest";
import { liftTrends, percentChange, periodTotals, rangeStart } from "./progress";
import type { WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES_BY_ID as byId } from "@/data/exercises";

const set = (id: string, weightKg: number | null, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id,
  type: "normal",
  weightKg,
  reps,
  rpe: null,
  completed: true,
  ...extra,
});

const session = (id: string, startedAt: number, exercises: [string, WorkoutSet[]][], status: WorkoutSession["status"] = "completed"): WorkoutSession => ({
  id,
  name: id,
  startedAt,
  finishedAt: startedAt + 60 * 60_000,
  status,
  exercises: exercises.map(([exerciseId, sets], i) => ({ id: `${id}-${i}`, exerciseId, restSeconds: 90, sets })),
});

const DAY = 86_400_000;
// Wednesday 4 Nov 2026, weeks start Monday.
const now = new Date(2026, 10, 4, 12).getTime();

describe("rangeStart", () => {
  it("covers whole weeks ending with the current one", () => {
    expect(new Date(rangeStart(1, now, 1))).toEqual(new Date(2026, 10, 2));
    expect(new Date(rangeStart(4, now, 1))).toEqual(new Date(2026, 9, 12));
  });
});

describe("periodTotals", () => {
  it("adds finished workouts inside the range only", () => {
    const sessions = [
      session("in", now - DAY, [["bench-press-barbell", [set("a", 100, 5), set("b", 100, 5, { completed: false })]]]),
      session("out", now - 40 * DAY, [["bench-press-barbell", [set("c", 100, 5)]]]),
      session("live", now, [["bench-press-barbell", [set("d", 100, 5)]]], "active"),
    ];
    expect(periodTotals(sessions, now - 7 * DAY, now + DAY, byId)).toEqual({
      workouts: 1,
      volumeKg: 500,
      durationSec: 3600,
      sets: 1,
    });
  });
});

describe("percentChange", () => {
  it("is a whole percent, or null with nothing to compare", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(90, 100)).toBe(-10);
    expect(percentChange(50, 0)).toBeNull();
  });
});

describe("liftTrends", () => {
  const sessions = [
    session("old", now - 60 * DAY, [["bench-press-barbell", [set("o1", 120, 1)]]]),
    session("w1", now - 14 * DAY, [
      ["bench-press-barbell", [set("b1", 80, 5)]],
      ["squat-barbell", [set("s1", 100, 5)]],
      ["pull-up", [set("p1", null, 8)]],
    ]),
    session("w2", now - 7 * DAY, [["bench-press-barbell", [set("b2", 85, 5)]]]),
    session("w3", now - DAY, [["bench-press-barbell", [set("b3", 90, 3)]]]),
  ];
  const trends = liftTrends(sessions, now - 21 * DAY, now + DAY, byId);

  it("ranks lifts by how often they were trained and skips bodyweight-only lifts", () => {
    expect(trends.map((t) => t.name)).toEqual(["Bench Press (Barbell)", "Squat (Barbell)"]);
    expect(trends[0].points).toHaveLength(3);
  });

  it("counts only records set inside the range that still stand", () => {
    // The 120 kg single from two months ago keeps heaviest weight and 1RM; set volume fell in range.
    expect(trends[0].records).toBe(1);
    expect(trends[1].records).toBe(3);
  });
});
