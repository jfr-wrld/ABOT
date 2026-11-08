import { describe, expect, it } from "vitest";
import { solveTwoBone, type Vec } from "./ik";

const dist = (p: Vec, q: Vec) => Math.hypot(p[0] - q[0], p[1] - q[1]);

describe("solveTwoBone", () => {
  it("reaches a reachable target and keeps both bone lengths", () => {
    const { mid, end } = solveTwoBone([0, 0], [30, 40], 30, 30, 1);
    expect(dist([0, 0], mid)).toBeCloseTo(30, 6);
    expect(dist(mid, end)).toBeCloseTo(30, 6);
    expect(dist(end, [30, 40])).toBeCloseTo(0, 6);
  });
  it("bends to opposite sides for opposite bend signs", () => {
    const up = solveTwoBone([0, 0], [40, 0], 30, 30, 1).mid;
    const down = solveTwoBone([0, 0], [40, 0], 30, 30, -1).mid;
    expect(Math.sign(up[1])).toBe(-Math.sign(down[1]));
  });
  it("straightens toward an unreachable target without stretching", () => {
    const { mid, end } = solveTwoBone([0, 0], [100, 0], 30, 30, 1);
    expect(dist([0, 0], mid)).toBeCloseTo(30, 6);
    expect(dist(mid, end)).toBeCloseTo(30, 6);
    expect(end[0]).toBeGreaterThan(59.9);
  });
  it("handles a target on the root without NaN", () => {
    const { mid, end } = solveTwoBone([5, 5], [5, 5], 30, 26, 1);
    for (const v of [...mid, ...end]) expect(Number.isFinite(v)).toBe(true);
  });
});
