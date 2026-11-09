import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { convertLoad, movementPattern, swapCandidates } from "./exercise-swapper";
import { lbsToKg } from "./calc";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const bench = byId["bench-press-barbell"]!;

describe("movementPattern", () => {
  it("names the pattern from the exercise", () => {
    expect(movementPattern(bench)).toBe("horizontal-push");
    expect(movementPattern(byId["overhead-press-barbell"]!)).toBe("vertical-push");
    expect(movementPattern(byId["lat-pulldown-cable"]!)).toBe("vertical-pull");
    expect(movementPattern(byId["seated-row-cable"]!)).toBe("horizontal-pull");
    expect(movementPattern(byId["romanian-deadlift-barbell"]!)).toBe("hinge");
    expect(movementPattern(byId["leg-press-machine"]!)).toBe("squat");
    expect(movementPattern(byId["bicep-curl-dumbbell"]!)).toBe("isolation-biceps");
  });
});

describe("swapCandidates", () => {
  it("puts the same pattern and main muscle first, best match first", () => {
    const c = swapCandidates(bench, SEED_EXERCISES, "all");
    expect(c.length).toBeGreaterThan(0);
    expect(c.length).toBeLessThanOrEqual(5);
    expect(c[0]!.exercise.primaryMuscles[0]).toBe("chest");
    expect(c[0]!.reason.kind).toBe("pattern");
    expect(c.map((x) => x.exercise.id)).not.toContain("bench-press-barbell");
    expect([...c].sort((a, b) => b.match - a.match)).toEqual(c);
  });

  it("the equipment profile filters what is offered", () => {
    const dumbbell = swapCandidates(bench, SEED_EXERCISES, "home");
    expect(dumbbell.every((x) => ["dumbbell", "barbell", "kettlebell", "bodyweight", "band"].includes(x.exercise.equipment))).toBe(true);
    expect(dumbbell.map((x) => x.exercise.id)).toContain("bench-press-dumbbell");
    const machine = swapCandidates(bench, SEED_EXERCISES, "machine");
    expect(machine.map((x) => x.exercise.id)).toContain("chest-press-machine");
    const bw = swapCandidates(bench, SEED_EXERCISES, "bodyweight");
    expect(bw.map((x) => x.exercise.id)).toContain("push-up");
  });

  it("never offers a timed exercise for a rep exercise", () => {
    expect(swapCandidates(byId["cable-crunch"]!, SEED_EXERCISES, "all").map((x) => x.exercise.id)).not.toContain("plank");
  });
});

describe("convertLoad", () => {
  const none: WorkoutSession[] = [];
  it("barbell to dumbbell is about 41% per hand, to machine 110%, to Smith 105%", () => {
    expect(convertLoad(80, bench, byId["bench-press-dumbbell"]!, { sessions: none, unit: "kg" })).toEqual({ weightKg: 32.5, source: "ratio" });
    expect(convertLoad(80, bench, byId["chest-press-machine"]!, { sessions: none, unit: "kg" })).toEqual({ weightKg: 87.5, source: "ratio" });
    expect(convertLoad(80, bench, byId["bench-press-smith-machine"]!, { sessions: none, unit: "kg" })).toEqual({ weightKg: 85, source: "ratio" });
  });

  it("uses the lifter's own last weight on the new exercise when there is one", () => {
    const done: WorkoutSession = {
      id: "w",
      name: "w",
      startedAt: 1,
      finishedAt: 2,
      status: "completed",
      exercises: [
        {
          id: "e",
          exerciseId: "bench-press-dumbbell",
          restSeconds: 90,
          sets: [
            { id: "a", type: "warmup", weightKg: 40, reps: 10, rpe: null, completed: true },
            { id: "b", type: "normal", weightKg: 30, reps: 8, rpe: null, completed: true },
          ],
        },
      ],
    };
    expect(convertLoad(80, bench, byId["bench-press-dumbbell"]!, { sessions: [done], unit: "kg" })).toEqual({ weightKg: 30, source: "history" });
  });

  it("bodyweight starts empty, pounds round to 5 lb", () => {
    expect(convertLoad(80, bench, byId["push-up"]!, { sessions: none, unit: "kg" })).toEqual({ weightKg: null, source: "none" });
    const lb = convertLoad(lbsToKg(185), bench, byId["bench-press-dumbbell"]!, { sessions: none, unit: "lbs" });
    expect(lb.weightKg).toBeCloseTo(lbsToKg(75), 5);
  });
});
