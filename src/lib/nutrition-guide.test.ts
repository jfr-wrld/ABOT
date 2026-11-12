import { describe, expect, it } from "vitest";
import { FOODS, foodsFor, waterTargetMl } from "./nutrition-guide";


describe("food matrix", () => {
  it("has unique ids and macros whose calories add up (4/4/9) within reason", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      const m = f.macrosPer100g;
      // Fibre counts in carbs but gives about 2 kcal/g, not 4.
      const fromMacros = m.protein * 4 + m.carbs * 4 + m.fat * 9 - (f.fiber ?? 0) * 2;
      // Rounding: within 15% or 12 kcal.
      expect(Math.abs(fromMacros - m.calories), f.id).toBeLessThanOrEqual(Math.max(12, m.calories * 0.15));
      expect(f.bestForPhases.length, f.id).toBeGreaterThan(0);
      // A household portion to pick, and a named source.
      expect(f.units.length, f.id).toBeGreaterThan(0);
      expect(["TKPI", "USDA", "ESTIMATE"], f.id).toContain(f.source);
    }
  });

  it("puts the most filling foods first on a cut", () => {
    const carbs = foodsFor("CUTTING", "CARBS");
    expect(carbs[0]!.satietyIndex).toBe("HIGH");
    // Last: a low-satiety carb that does not suit a cut.
    expect(carbs.at(-1)!.satietyIndex).toBe("LOW");
    expect(carbs.at(-1)!.bestForPhases).not.toContain("CUTTING");
  });
});

describe("waterTargetMl", () => {
  it("is about 35 ml per kg, in 250 ml steps", () => {
    expect(waterTargetMl(80)).toBe(2750);
    expect(waterTargetMl(60)).toBe(2000);
  });
});
