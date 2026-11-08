import { describe, expect, it } from "vitest";
import {
  buildPRTable,
  detectSessionPRs,
  estimate1RM,
  muscleSplit,
  previousSets,
  sessionVolume,
} from "./calc";
import type { WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";

const set = (p: Partial<WorkoutSet> & { id: string }): WorkoutSet => ({
  type: "normal",
  weightKg: 100,
  reps: 5,
  rpe: null,
  completed: true,
  ...p,
});

const session = (
  id: string,
  startedAt: number,
  sets: WorkoutSet[],
  exerciseId = "bench-press-barbell",
): WorkoutSession => ({
  id,
  name: id,
  startedAt,
  finishedAt: startedAt + 3600_000,
  status: "completed",
  exercises: [{ id: `${id}-ex`, exerciseId, sets, restSeconds: 90 }],
});

describe("estimate1RM (Epley)", () => {
  it("returns the weight itself for a single", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it("scales with reps", () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimate1RM(60, 10)).toBeCloseTo(80, 5);
  });
  it("is zero for invalid input", () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
  });
});

describe("sessionVolume", () => {
  it("sums weight × reps for completed working sets only", () => {
    const s = session("s1", 1, [
      set({ id: "a", weightKg: 100, reps: 5 }), // 500
      set({ id: "b", weightKg: 40, reps: 10, type: "warmup" }), // excluded
      set({ id: "c", weightKg: 100, reps: 5, completed: false }), // excluded
      set({ id: "d", weightKg: 80, reps: 8, type: "dropset" }), // 640
    ]);
    expect(sessionVolume(s)).toBe(1140);
  });
});

describe("PR detection", () => {
  const day = 86_400_000;
  const past = session("old", day, [set({ id: "o1", weightKg: 100, reps: 5 })]);

  it("builds all three PR kinds from history", () => {
    const table = buildPRTable([past]);
    const prs = table["bench-press-barbell"]!;
    expect(prs.heaviest_weight?.value).toBe(100);
    expect(prs.best_set_volume?.value).toBe(500);
    expect(prs.best_1rm?.value).toBeCloseTo(116.67, 2);
  });

  it("flags only sets that beat prior history", () => {
    const today = session("new", day * 2, [
      set({ id: "n1", weightKg: 102.5, reps: 3 }), // heaviest weight PR (1RM 112.75 < 116.67)
      set({ id: "n2", weightKg: 90, reps: 8 }), // volume 720 PR, 1RM 114 no
      set({ id: "n3", weightKg: 100, reps: 5 }), // ties everything — no PR
    ]);
    const prs = detectSessionPRs(today, [past, today]);
    const kinds = prs.map((p) => `${p.kind}:${p.setId}`).sort();
    expect(kinds).toEqual(["best_set_volume:n2", "heaviest_weight:n1"]);
  });

  it("awards the badge to the single best set per kind within a session", () => {
    const today = session("new", day * 2, [
      set({ id: "n1", weightKg: 105, reps: 1 }),
      set({ id: "n2", weightKg: 110, reps: 1 }),
    ]);
    const prs = detectSessionPRs(today, [past, today]);
    const heavy = prs.filter((p) => p.kind === "heaviest_weight");
    expect(heavy).toHaveLength(1);
    expect(heavy[0]!.setId).toBe("n2");
  });

  it("treats a brand-new exercise as all PRs", () => {
    const today = session("new", day * 2, [set({ id: "n1", weightKg: 50, reps: 10 })], "squat-barbell");
    const prs = detectSessionPRs(today, [past, today]);
    expect(prs).toHaveLength(3);
  });
});

describe("previousSets", () => {
  it("returns completed sets from the most recent session containing the exercise", () => {
    const a = session("a", 1, [set({ id: "a1", weightKg: 80, reps: 8 })]);
    const b = session("b", 2, [set({ id: "b1", weightKg: 85, reps: 6 })]);
    const active = session("c", 3, [set({ id: "c1", completed: false })]);
    const prev = previousSets("bench-press-barbell", [a, b, active], "c");
    expect(prev?.map((s) => s.weightKg)).toEqual([85]);
  });
});

describe("muscleSplit", () => {
  it("credits primary muscles fully and secondaries by half", () => {
    const s = session("s", 1, [set({ id: "1" }), set({ id: "2" })]);
    const split = muscleSplit([s], SEED_EXERCISES_BY_ID);
    expect(split.chest).toBe(2);
    expect(split.triceps).toBe(1);
    expect(split.shoulders).toBe(1);
  });
});

import { variantKey, volumeFactor, setVolume, exerciseHistory } from "./calc";
import type { Exercise } from "@/types/workout";

const ex = (id: string, sets: WorkoutSet[], locationId?: string, startedAt = 1): WorkoutSession => ({
  ...session(`${id}-${startedAt}-${locationId ?? "none"}`, startedAt, sets, id),
  locationId,
});

describe("load mode volume", () => {
  it("doubles per-hand dumbbell volume and counts unilateral once", () => {
    expect(volumeFactor("per_hand")).toBe(2);
    expect(volumeFactor("unilateral")).toBe(1);
    expect(volumeFactor("total")).toBe(1);
    const s = set({ id: "x", weightKg: 30, reps: 10 });
    expect(setVolume(s, "per_hand")).toBe(600);
    expect(setVolume(s, "unilateral")).toBe(300);
    expect(setVolume(s)).toBe(300);
  });
  it("sessionVolume uses the exercise's load mode when given the lookup", () => {
    const s = ex("bench-press-dumbbell", [set({ id: "d", weightKg: 30, reps: 10 })]);
    expect(sessionVolume(s)).toBe(300);
    expect(sessionVolume(s, SEED_EXERCISES_BY_ID)).toBe(600);
  });
});

describe("variantKey", () => {
  const pulldown = SEED_EXERCISES_BY_ID["lat-pulldown-cable"]!;
  const bench = SEED_EXERCISES_BY_ID["bench-press-barbell"]!;
  it("splits machine exercises by location", () => {
    expect(variantKey(pulldown.id, pulldown, "A")).toBe("lat-pulldown-cable@A");
    expect(variantKey(pulldown.id, pulldown, undefined)).toBe("lat-pulldown-cable");
  });
  it("shares free-weight exercises across locations", () => {
    expect(variantKey(bench.id, bench, "A")).toBe("bench-press-barbell");
  });
  it("falls back to the id for an unknown exercise", () => {
    expect(variantKey("gone", undefined as unknown as Exercise, "A")).toBe("gone");
  });
});

describe("per-location records", () => {
  const day = 86_400_000;
  it("keeps machine records apart per gym", () => {
    const a = ex("lat-pulldown-cable", [set({ id: "a1", weightKg: 60, reps: 10 })], "A", day);
    const b = ex("lat-pulldown-cable", [set({ id: "b1", weightKg: 50, reps: 10 })], "B", 2 * day);
    const prs = detectSessionPRs(b, [a, b], SEED_EXERCISES_BY_ID);
    expect(prs.find((p) => p.kind === "heaviest_weight")?.weightKg).toBe(50);
    const table = buildPRTable([a, b], SEED_EXERCISES_BY_ID);
    expect(table["lat-pulldown-cable@A"]?.heaviest_weight?.value).toBe(60);
    expect(table["lat-pulldown-cable@B"]?.heaviest_weight?.value).toBe(50);
  });
  it("shares barbell records across gyms", () => {
    const a = ex("bench-press-barbell", [set({ id: "a1", weightKg: 100, reps: 5 })], "A", day);
    const b = ex("bench-press-barbell", [set({ id: "b1", weightKg: 90, reps: 5 })], "B", 2 * day);
    expect(detectSessionPRs(b, [a, b], SEED_EXERCISES_BY_ID)).toHaveLength(0);
  });
  it("previousSets for a machine at gym B ignores gym A", () => {
    const a = ex("lat-pulldown-cable", [set({ id: "a1", weightKg: 60, reps: 10 })], "A", day);
    const opts = { byId: SEED_EXERCISES_BY_ID, locationId: "B" };
    expect(previousSets("lat-pulldown-cable", [a], undefined, opts)).toBeNull();
    expect(previousSets("lat-pulldown-cable", [a], undefined, { ...opts, locationId: "A" })?.[0]?.weightKg).toBe(60);
  });
  it("exerciseHistory can be filtered to one gym", () => {
    const a = ex("lat-pulldown-cable", [set({ id: "a1", weightKg: 60, reps: 10 })], "A", day);
    const b = ex("lat-pulldown-cable", [set({ id: "b1", weightKg: 50, reps: 10 })], "B", 2 * day);
    expect(exerciseHistory("lat-pulldown-cable", [a, b])).toHaveLength(2);
    expect(exerciseHistory("lat-pulldown-cable", [a, b], { byId: SEED_EXERCISES_BY_ID, locationId: "B" })).toHaveLength(1);
  });
});
