import { describe, expect, it } from "vitest";
import { backOut, beat, countUp, easeOut, linear, stagger, typed } from "./story-motion";

describe("story motion", () => {
  it("a beat goes from 0 to 1 over its window", () => {
    expect(beat(0, 1, 2)).toBe(0);
    expect(beat(2, 1, 2, linear)).toBeCloseTo(0.5);
    expect(beat(9, 1, 2)).toBe(1);
    expect(beat(1, 1, 0)).toBe(1);
  });

  it("eases end where they start and finish", () => {
    for (const e of [easeOut, backOut]) {
      expect(e(0)).toBeCloseTo(0);
      expect(e(1)).toBeCloseTo(1);
    }
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => backOut(i / 49)))).toBeGreaterThan(1);
  });

  it("staggers items one after another", () => {
    expect(stagger(1, 0, 1, 0.2, 0.5)).toBe(0);
    expect(stagger(1.6, 0, 1, 0.2, 0.5)).toBe(1);
    expect(stagger(1.6, 3, 1, 0.2, 0.5)).toBe(0);
  });

  it("counts up and types out", () => {
    expect(countUp(12345, 0)).toBe(0);
    expect(countUp(12345, 1)).toBe(12345);
    expect(countUp(10, 0.5, 1)).toBe(5);
    expect(typed("LEVEL", 0.4)).toBe("LE");
    expect(typed("LEVEL", 1)).toBe("LEVEL");
  });
});
