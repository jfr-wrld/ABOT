import { describe, expect, it } from "vitest";
import { PLATE_SETS, calculatePlates, plateColor, sleeveStack } from "./plate-calculator";

const KG = PLATE_SETS.kg.plates;

describe("calculatePlates", () => {
  it("loads 100 kg on an Olympic bar as 25 + 15 per side", () => {
    const load = calculatePlates(100, 20, KG);
    expect(load.perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ]);
    expect(load.perSideWeight).toBe(40);
    expect(load.loaded).toBe(100);
    expect(load.remainder).toBe(0);
  });

  it("uses several of a size and the small change plates", () => {
    const load = calculatePlates(142.5, 20, KG);
    expect(sleeveStack(load)).toEqual([25, 25, 10, 1.25]);
    expect(load.loaded).toBe(142.5);
  });

  it("reports what the plates cannot make", () => {
    const load = calculatePlates(101, 20, KG);
    expect(load.loaded).toBe(100);
    expect(load.remainder).toBe(1);
  });

  it("respects a gym without 25s or 1.25s", () => {
    const load = calculatePlates(72.5, 20, [20, 15, 10, 5, 2.5]);
    expect(sleeveStack(load)).toEqual([20, 5]);
    expect(load.loaded).toBe(70);
    expect(load.remainder).toBe(2.5);
  });

  it("handles the empty bar, a machine with no bar, and a target below the bar", () => {
    expect(calculatePlates(20, 20, KG)).toMatchObject({ perSide: [], loaded: 20, remainder: 0, belowBar: false });
    expect(sleeveStack(calculatePlates(50, 0, KG))).toEqual([25]);
    expect(calculatePlates(15, 20, KG)).toMatchObject({ belowBar: true, perSide: [] });
  });

  it("never drifts on fractional plates", () => {
    const load = calculatePlates(22.5, 20, KG);
    expect(load.perSide).toEqual([{ plate: 1.25, count: 1 }]);
    expect(load.remainder).toBe(0);
  });

  it("works in pounds", () => {
    const load = calculatePlates(225, 45, PLATE_SETS.lbs.plates);
    expect(sleeveStack(load)).toEqual([45, 45]);
  });

  it("colours plates by rank (IWF), the same rank in pounds", () => {
    expect(plateColor(25, "kg").fill).toBe("#ef4444");
    expect(plateColor(2.5, "kg")).toMatchObject({ fill: "#18181b", edge: "#ccff00" });
    expect(plateColor(45, "lbs").fill).toBe("#ef4444");
  });
});
