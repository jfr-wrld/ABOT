import { describe, expect, it } from "vitest";
import { gymSetup, plateKey, setupPatch, standardSetup } from "./gym-equipment";
import { calculatePlates } from "./plate-calculator";
import type { GymLocation } from "@/types/workout";

const gym: GymLocation = { id: "g", name: "Iron Barn", barWeightKg: 20, plateInventoryKg: [20, 10, 5], isDefault: true };

describe("gym equipment", () => {
  it("a lb gym round-trips: stored in kg, shown as whole pounds again", () => {
    const patch = setupPatch(standardSetup("lbs"), "lbs");
    expect(patch.barWeightKg).toBeCloseTo(20.4117, 3);
    const back = gymSetup({ ...gym, ...patch }, "lbs")!;
    expect(back.bar).toBe(45);
    expect(back.plates).toEqual([45, 35, 25, 10, 5, 2.5]);
  });

  it("a gym marked in kg does not drive a calculator in lbs", () => {
    expect(gymSetup(gym, "lbs")).toBeNull();
    expect(gymSetup(gym, "kg")!.plates).toEqual([20, 10, 5]);
  });

  it("pair counts follow their plate through a save", () => {
    const patch = setupPatch({ bar: 20, plates: [20, 10, 5], pairs: [2, undefined, 1] }, "kg");
    expect(patch.platePairs).toEqual({ [plateKey(20)]: 2, [plateKey(5)]: 1 });
    expect(gymSetup({ ...gym, ...patch }, "kg")!.pairs).toEqual([2, undefined, 1]);
  });

  it("the calculator loads no more plates than the gym has", () => {
    // 140 kg on a 20 kg bar is 60 a side: three 20s, but there are only two pairs of 20s.
    const load = calculatePlates(140, 20, [20, 10, 5], [2, undefined, undefined]);
    expect(load.perSide).toEqual([
      { plate: 20, count: 2 },
      { plate: 10, count: 2 },
    ]);
    expect(load.loaded).toBe(140);
    // Without the cap it would be three 20s.
    expect(calculatePlates(140, 20, [20, 10, 5]).perSide).toEqual([{ plate: 20, count: 3 }]);
  });

  it("a size that runs out leaves a remainder", () => {
    const load = calculatePlates(100, 20, [20], [1]);
    expect(load.loaded).toBe(60);
    expect(load.remainder).toBe(40);
  });
});
