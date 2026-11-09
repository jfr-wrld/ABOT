import { describe, expect, it } from "vitest";
import type { WorkoutSession, WorkoutSet } from "@/types/workout";
import { FALLBACK_BODYWEIGHT_KG, estimateCalories, kcalFrom, metFor } from "./calorie-estimator";

const MIN = 60_000;
const set = (weightKg: number, reps: number, rpe: number | null = null, type: WorkoutSet["type"] = "normal"): WorkoutSet => ({
  id: `${weightKg}-${reps}-${rpe}-${type}`,
  type,
  weightKg,
  reps,
  rpe,
  completed: true,
});
const session = (minutes: number, sets: WorkoutSet[]): WorkoutSession => ({
  id: "w",
  name: "w",
  startedAt: 0,
  finishedAt: minutes * MIN,
  status: "completed",
  exercises: [{ id: "e", exerciseId: "squat-barbell", restSeconds: 90, sets }],
});

describe("metFor", () => {
  it("runs from 3.5 for sparse sessions to 6 for dense ones", () => {
    expect(metFor(0, null)).toBe(3.5);
    expect(metFor(40, null)).toBe(3.5);
    expect(metFor(170, null)).toBeCloseTo(4.75, 5);
    expect(metFor(300, null)).toBe(6);
    expect(metFor(900, null)).toBe(6);
  });
  it("adds or takes 0.25 per RPE point from 7, within 3.5 to 6.5", () => {
    expect(metFor(300, 9)).toBe(6.5);
    expect(metFor(300, 10)).toBe(6.5);
    expect(metFor(170, 9)).toBeCloseTo(5.25, 5);
    expect(metFor(0, 6)).toBe(3.5);
  });
});

describe("estimateCalories", () => {
  it("applies kcal = MET x 3.5 x (kg / 200) x minutes", () => {
    expect(kcalFrom(5, 80, 60)).toBe(420);
    // 60 minutes, 10 x 100 kg x 10 reps = 10,000 kg: 166.7 kg/min.
    const s = session(60, Array.from({ length: 10 }, () => set(100, 10)));
    const e = estimateCalories(s, { bodyweightKg: 80 });
    expect(e.density).toBeCloseTo(166.67, 1);
    expect(e.met).toBeCloseTo(4.7, 1);
    expect(e.kcal).toBe(Math.round(kcalFrom(3.5 + 2.5 * ((10_000 / 60 - 40) / 260), 80, 60)));
    expect(e.bodyweightKnown).toBe(true);
  });

  it("averages RPE over working sets only", () => {
    const s = session(30, [set(60, 5, 6, "warmup"), set(100, 5, 9), set(100, 5, 8)]);
    expect(estimateCalories(s, { bodyweightKg: 70 }).avgRpe).toBe(8.5);
  });

  it("falls back to 75 kg when no body weight is known, and says so", () => {
    const e = estimateCalories(session(45, [set(60, 10)]), { bodyweightKg: null });
    expect(e.bodyweightKg).toBe(FALLBACK_BODYWEIGHT_KG);
    expect(e.bodyweightKnown).toBe(false);
  });

  it("gives 0 for a workout with no time", () => {
    expect(estimateCalories(session(0, [set(60, 10)]), { bodyweightKg: 80 }).kcal).toBe(0);
  });
});
