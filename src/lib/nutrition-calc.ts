import type { Food, FoodUnit } from "./nutrition-guide";

export type Macro = "calories" | "protein" | "carbs" | "fat";

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** What `grams` of a food holds, rounded for display (kcal whole, the rest to 0.1 g). */
export function nutrientsFor(food: Food, grams: number): Nutrients {
  const m = food.macrosPer100g;
  const k = grams / 100;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(m.calories * k),
    protein: r1(m.protein * k),
    carbs: r1(m.carbs * k),
    fat: r1(m.fat * k),
    fiber: r1((food.fiber ?? 0) * k),
  };
}

/** Every portion a food offers: its household units, then its serving if that differs. */
export function portionsOf(food: Food): FoodUnit[] {
  const units = [...food.units];
  if (!units.some((u) => u.grams === food.servingG)) units.push({ label: food.servingVisual, grams: food.servingG });
  return units;
}

/**
 * The reverse question: how much of this food gives `amount` of a macro ("40 g carbs" ->
 * 140 g of nasi). Grams are rounded to 5 g; `units` says how many of the food's first
 * household unit that is, to the nearest half. Null when the food has none of that macro.
 */
export function gramsFor(food: Food, macro: Macro, amount: number): { grams: number; units: number; unit: FoodUnit } | null {
  const per100 = food.macrosPer100g[macro];
  if (per100 <= 0 || amount <= 0) return null;
  const grams = Math.max(5, Math.round((amount * 100) / per100 / 5) * 5);
  const unit = food.units[0] ?? { label: food.servingVisual, grams: food.servingG };
  return { grams, units: Math.round((grams / unit.grams) * 2) / 2, unit };
}

/** Sums of several portions. */
export function total(items: { food: Food; grams: number }[]): Nutrients {
  const sum: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const i of items) {
    const n = nutrientsFor(i.food, i.grams);
    sum.kcal += n.kcal;
    sum.protein += n.protein;
    sum.carbs += n.carbs;
    sum.fat += n.fat;
    sum.fiber += n.fiber;
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { kcal: Math.round(sum.kcal), protein: r1(sum.protein), carbs: r1(sum.carbs), fat: r1(sum.fat), fiber: r1(sum.fiber) };
}
