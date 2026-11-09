import { afterEach, describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { suggestOverload } from "./progressive-overload";
import { lbsToKg } from "./calc";
import { setPhaseSource, type ActivePhaseConfig } from "./phase-engine";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const DAY = 86_400_000;
let n = 0;
const set = (kg: number | null, reps: number, rpe: number | null = null, type: WorkoutSet["type"] = "normal"): WorkoutSet => ({
  id: `s${n++}`,
  type,
  weightKg: kg,
  reps,
  rpe,
  completed: true,
});
const session = (daysAgo: number, exerciseId: string, sets: WorkoutSet[]): WorkoutSession => ({
  id: `w${n++}`,
  name: "w",
  startedAt: Date.now() - daysAgo * DAY,
  finishedAt: Date.now() - daysAgo * DAY + 3_600_000,
  status: "completed",
  exercises: [{ id: `e${n++}`, exerciseId, restSeconds: 90, sets }],
});
const kg = { unit: "kg" as const };

describe("load upgrades", () => {
  it("a clean squat session adds 2.5 kg at the same reps", () => {
    const s = suggestOverload(byId["squat-barbell"], [session(3, "squat-barbell", [set(40, 10, null, "warmup"), set(100, 5, 8), set(100, 5, 8), set(100, 5, 8.5)])], kg);
    expect(s).toMatchObject({ kind: "load", weightKg: 102.5, reps: 5, deltaKg: 2.5, basedOn: 1 });
  });

  it("an easy one (RPE 7 or less) adds 5 kg on a lower-body compound", () => {
    const s = suggestOverload(byId["deadlift-barbell"], [session(3, "deadlift-barbell", [set(140, 5, 7), set(140, 5, 6.5)])], kg);
    expect(s).toMatchObject({ kind: "load", weightKg: 145, deltaKg: 5 });
  });

  it("pounds users get 5 lb and 10 lb jumps", () => {
    const start = lbsToKg(225);
    const s = suggestOverload(byId["squat-barbell"], [session(3, "squat-barbell", [set(start, 5), set(start, 5)])], { unit: "lbs" });
    expect(s!.weightKg).toBeCloseTo(lbsToKg(230), 5);
  });

  it("a missed rep or RPE over 8.5 suggests nothing", () => {
    expect(suggestOverload(byId["squat-barbell"], [session(3, "squat-barbell", [set(100, 5), set(100, 4)])], kg)).toBeNull();
    expect(suggestOverload(byId["squat-barbell"], [session(3, "squat-barbell", [set(100, 5, 9), set(100, 5, 9)])], kg)).toBeNull();
  });
});

describe("double progression for upper body and isolation", () => {
  it("adds a rep at the same weight under 12 reps (two when easy)", () => {
    expect(suggestOverload(byId["bench-press-barbell"], [session(2, "bench-press-barbell", [set(80, 8), set(80, 8)])], kg)).toMatchObject({
      kind: "reps",
      weightKg: 80,
      reps: 9,
      deltaReps: 1,
    });
    expect(suggestOverload(byId["bench-press-barbell"], [session(2, "bench-press-barbell", [set(80, 8, 7), set(80, 8, 7)])], kg)!.reps).toBe(10);
  });

  it("at 12 reps adds the smallest jump and starts again at 8", () => {
    const s = suggestOverload(byId["lateral-raise-dumbbell"], [session(2, "lateral-raise-dumbbell", [set(10, 12), set(10, 12), set(10, 12)])], kg);
    expect(s).toMatchObject({ kind: "load", weightKg: 11, reps: 8, deltaKg: 1, deltaReps: -4 });
    const bench = suggestOverload(byId["bench-press-barbell"], [session(2, "bench-press-barbell", [set(80, 12), set(80, 12)])], kg);
    expect(bench).toMatchObject({ kind: "load", weightKg: 82.5, reps: 8 });
  });

  it("bodyweight work adds reps with no weight", () => {
    expect(suggestOverload(byId["pull-up"], [session(2, "pull-up", [set(null, 8), set(null, 8)])], kg)).toMatchObject({ kind: "reps", weightKg: null, reps: 9 });
  });
});

describe("deload", () => {
  it("volume falling three sessions in a row takes 10% off, rounded down", () => {
    const s = suggestOverload(
      byId["squat-barbell"],
      [
        session(9, "squat-barbell", [set(100, 5), set(100, 5), set(100, 5)]),
        session(6, "squat-barbell", [set(100, 5), set(100, 5), set(100, 4)]),
        session(3, "squat-barbell", [set(100, 5), set(100, 4), set(100, 3)]),
      ],
      kg,
    );
    expect(s).toMatchObject({ kind: "deload", weightKg: 90, deltaKg: -10, basedOn: 3 });
  });

  it("two grinding sessions at RPE 9.5+ with missed reps deload", () => {
    const s = suggestOverload(
      byId["bench-press-barbell"],
      [session(6, "bench-press-barbell", [set(82.5, 6, 9.5), set(82.5, 4, 10)]), session(3, "bench-press-barbell", [set(82.5, 6, 10), set(82.5, 5, 10)])],
      kg,
    );
    expect(s).toMatchObject({ kind: "deload", weightKg: 72.5 });
  });

  it("only looks at the last three sessions, and skips the workout in progress", () => {
    const old = [9, 8, 7].map((d) => session(d + 10, "squat-barbell", [set(100, 5), set(100, 2)]));
    const recent = session(1, "squat-barbell", [set(100, 5), set(100, 5)]);
    expect(suggestOverload(byId["squat-barbell"], [...old, recent], kg)!.kind).toBe("load");
    expect(suggestOverload(byId["squat-barbell"], [...old, recent], { unit: "kg", excludeSessionId: recent.id })!.kind).toBe("deload");
  });
});

it("no history, or a timed exercise, gives no suggestion", () => {
  expect(suggestOverload(byId["squat-barbell"], [], kg)).toBeNull();
  expect(suggestOverload(byId["plank"], [session(1, "plank", [{ ...set(null, 0), durationSec: 60 }])], kg)).toBeNull();
});

describe("body phase calibration", () => {
  const phase = (phaseType: ActivePhaseConfig["phaseType"]): ActivePhaseConfig => ({
    id: "p",
    phaseType,
    title: "",
    startDate: "2026-11-01",
    durationWeeks: 8,
    startWeightKg: 80,
    targetWeightKg: 80,
    heightCm: 180,
    age: 30,
    biologicalSex: "male",
    activityMultiplier: 1.375,
    weeklyRatePercent: 0,
    isActive: true,
  });
  afterEach(() => setPhaseSource(() => null));

  it("cutting: a hard session holds the weight instead of suggesting nothing", () => {
    setPhaseSource(() => phase("CUTTING"));
    const s = suggestOverload(byId["squat-barbell"], [session(3, "squat-barbell", [set(100, 5, 9), set(100, 5, 9)])], kg);
    expect(s).toMatchObject({ kind: "hold", weightKg: 100, reps: 5, deltaKg: 0 });
  });

  it("cutting: fatigue drops one set instead of 10% off the bar", () => {
    setPhaseSource(() => phase("CUTTING"));
    const history = [9, 6, 3].map((d, i) => session(d, "squat-barbell", [set(100, 5 - i), set(100, 4 - i, null, "failure")]));
    expect(suggestOverload(byId["squat-barbell"], history, kg)).toMatchObject({ kind: "trim", weightKg: 100 });
  });

  it("lean bulk: a clean bench session adds 2.5 kg at the same reps, plus a set when fresh", () => {
    setPhaseSource(() => phase("BULKING"));
    const hist = [session(2, "bench-press-barbell", [set(80, 8), set(80, 8)])];
    expect(suggestOverload(byId["bench-press-barbell"], hist, kg)).toMatchObject({ kind: "load", weightKg: 82.5, reps: 8, label: "Surplus overload" });
    expect(suggestOverload(byId["bench-press-barbell"], hist, { ...kg, fresh: true })?.extraSet).toBe(true);
    expect(suggestOverload(byId["bench-press-barbell"], hist, kg)?.extraSet).toBeUndefined();
  });

  it("strength peak: 8 reps become a 5-rep load from the e1RM", () => {
    setPhaseSource(() => phase("STRENGTH_PEAK"));
    const s = suggestOverload(byId["bench-press-barbell"], [session(2, "bench-press-barbell", [set(80, 8), set(80, 8)])], kg);
    // e1RM 80 × (1 + 8/30) = 101.3; ÷ (1 + 5/30) = 86.9, down to 85.
    expect(s).toMatchObject({ kind: "load", weightKg: 85, reps: 5, label: "Strength peak" });
  });
});
