import { describe, expect, it } from "vitest";
import { DAY_TEMPLATES, groceryList, planDay, templatesFor } from "./meal-templates";
import { FOODS } from "./nutrition-guide";
import { gramsFor, nutrientsFor, portionsOf } from "./nutrition-calc";

const byId = Object.fromEntries(FOODS.map((f) => [f.id, f]));

describe("portion calculator", () => {
  it("turns a macro goal into grams and household units", () => {
    // TKPI nasi: 39.8 g carbs per 100 g, so 40 g carbs is about 100 g, one centong.
    expect(gramsFor(byId["white-rice"]!, "carbs", 40)).toMatchObject({ grams: 100, units: 1 });
    expect(gramsFor(byId["chicken-breast"]!, "protein", 31)).toMatchObject({ grams: 100 });
    expect(gramsFor(byId["water"]!, "protein", 10)).toBeNull();
  });

  it("scales nutrients and lists every portion", () => {
    expect(nutrientsFor(byId["egg"]!, 50)).toMatchObject({ kcal: 78, protein: 6.3 });
    expect(portionsOf(byId["tempeh"]!).map((u) => u.grams)).toContain(50);
  });
});

describe("day templates", () => {
  const targets = [
    { phase: "BULKING" as const, fuel: { kcal: 3000, proteinG: 140, carbsG: 400, fatG: 85 } },
    { phase: "CUTTING" as const, fuel: { kcal: 1900, proteinG: 160, carbsG: 170, fatG: 55 } },
    { phase: "RECOMP" as const, fuel: { kcal: 2400, proteinG: 150, carbsG: 270, fatG: 70 } },
  ];

  it("uses only foods from the guide", () => {
    for (const t of DAY_TEMPLATES) for (const m of t.meals) for (const x of m.items) expect(byId[x.foodId], `${t.id}:${x.foodId}`).toBeDefined();
  });

  it("sizes each template close to the day's target", () => {
    for (const { phase, fuel } of targets) {
      for (const t of templatesFor(phase).filter((x) => x.phases.includes(phase))) {
        const day = planDay(t, fuel);
        expect(Math.abs(day.totals.kcal - fuel.kcal) / fuel.kcal, `${t.id} kcal ${day.totals.kcal}`).toBeLessThanOrEqual(0.06);
        expect(Math.abs(day.totals.protein - fuel.proteinG), `${t.id} protein ${day.totals.protein}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("buys rice dry and sums a week", () => {
    const day = planDay(DAY_TEMPLATES[0]!, targets[0]!.fuel);
    const cookedRice = day.meals.flatMap((m) => m.items).filter((x) => x.food.id === "white-rice").reduce((n, x) => n + x.grams, 0);
    const rice = groceryList(day, 7).find((l) => l.foodId === "white-rice")!;
    expect(rice.label).toBe("Uncooked white rice");
    expect(Math.abs(rice.grams - (cookedRice * 7) / 2.5)).toBeLessThanOrEqual(10);
  });
});
