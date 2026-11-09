import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { IDEAL_SHARE, analyzeSymmetry } from "./symmetry-analyzer";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
let n = 0;
const sets = (count: number): WorkoutSet[] =>
  Array.from({ length: count }, () => ({ id: `s${n++}`, type: "normal", weightKg: 50, reps: 10, rpe: null, completed: true }));
const workout = (startedAt: number, ex: [string, number][]): WorkoutSession => ({
  id: `w${n++}`,
  name: "w",
  startedAt,
  finishedAt: startedAt + 1,
  status: "completed",
  exercises: ex.map(([id, c]) => ({ id: `e${n++}`, exerciseId: id, restSeconds: 90, sets: sets(c) })),
});

describe("analyzeSymmetry", () => {
  it("counts primary muscles 1 per set and secondary 0.5, once per axis", () => {
    // Bench press: chest primary (Push), triceps and shoulders secondary (Push again, Arms 0.5).
    const r = analyzeSymmetry([workout(10, [["bench-press-barbell", 4], ["bent-over-row-barbell", 4]])], byId, 0);
    expect(r.axes.push.sets).toBe(4);
    expect(r.axes.arms.sets).toBeGreaterThanOrEqual(2);
    expect(r.axes.pull.sets).toBe(4);
  });

  it("only counts the window, and needs a few sets before judging", () => {
    const r = analyzeSymmetry([workout(5, [["squat-barbell", 10]]), workout(100, [["bench-press-barbell", 3]])], byId, 50);
    expect(r.axes.knee.sets).toBe(0);
    expect(r.score).toBeNull();
    expect(r.diagnostics).toEqual([]);
  });

  it("push far ahead of pull fires the shoulder warning with sets to add", () => {
    const r = analyzeSymmetry(
      [workout(1, [["bench-press-barbell", 10], ["overhead-press-barbell", 6], ["bent-over-row-barbell", 8], ["squat-barbell", 8], ["romanian-deadlift-barbell", 8]])],
      byId,
      0,
    );
    const d = r.diagnostics.find((x) => x.code === "push-pull")!;
    expect(d.text).toMatch(/^Push volume exceeds Pull by \d+%\. Add \d+ sets of Rows or Rear Delt Flyes this week\.$/);
    expect(d.addSets).toBe(Math.max(2, Math.ceil(r.axes.push.sets - r.axes.pull.sets)));
  });

  it("no pull work at all says so instead of a percentage, and is never balanced", () => {
    const r = analyzeSymmetry([workout(1, [["bench-press-barbell", 4], ["squat-barbell", 4]])], byId, 0);
    expect(r.diagnostics[0]!.text).toMatch(/^No pull work in this range against 4 push sets\. Add 4 sets/);
    expect(["IMBALANCED", "CRITICAL"]).toContain(r.grade);
  });

  it("flags skipped leg days and weak hamstrings", () => {
    const upper = analyzeSymmetry([workout(1, [["bench-press-barbell", 8], ["bent-over-row-barbell", 10], ["bicep-curl-barbell", 4]])], byId, 0);
    expect(upper.diagnostics.map((d) => d.code)).toContain("skip-legs");
    expect(upper.lowerShare).toBe(0);

    const quads = analyzeSymmetry([workout(1, [["squat-barbell", 9], ["leg-extension-machine", 6], ["leg-curl-machine", 2], ["bench-press-barbell", 6], ["bent-over-row-barbell", 6]])], byId, 0);
    expect(quads.quadHam).toBeLessThan(0.75);
    expect(quads.diagnostics.map((d) => d.code)).toContain("quad-ham");
  });

  it("a program shaped like the ideal scores high", () => {
    const k = 10;
    const r = analyzeSymmetry(
      [
        workout(1, [
          ["bench-press-barbell", Math.round(IDEAL_SHARE.push * k * 3)],
          ["bent-over-row-barbell", Math.round(IDEAL_SHARE.pull * k * 3)],
          ["leg-press-machine", 5],
          ["romanian-deadlift-barbell", 5],
          ["bicep-curl-barbell", 3],
          ["triceps-pushdown-cable", 2],
          ["cable-crunch", 3],
        ]),
      ],
      byId,
      0,
    );
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(["OPTIMAL", "BALANCED"]).toContain(r.grade);
  });
});
