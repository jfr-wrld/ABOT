import type { BodyPhaseType, FuelTarget } from "./phase-engine";
import { FOODS, type Food } from "./nutrition-guide";
import { total, type Nutrients } from "./nutrition-calc";

export type MealSlot = "breakfast" | "lunch" | "pre" | "post" | "dinner" | "snack";
export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  pre: "Before training",
  post: "After training",
  dinner: "Dinner",
  snack: "Snack",
};

/**
 * What an item does in the solver: protein, carb and fat items are scaled to hit the day's
 * target; fixed items (vegetables, fruit, a glass of milk) keep their amount.
 */
type Role = "protein" | "carb" | "fat" | "fixed";

interface TemplateItem {
  foodId: string;
  grams: number;
  role: Role;
}

export interface DayTemplate {
  id: string;
  name: string;
  /** Phases it is written for. */
  phases: BodyPhaseType[];
  meals: { slot: MealSlot; items: TemplateItem[] }[];
}

const i = (foodId: string, grams: number, role: Role): TemplateItem => ({ foodId, grams, role });

/** Indonesian days built from the food guide; the solver sizes them to the lifter. */
export const DAY_TEMPLATES: DayTemplate[] = [
  {
    id: "bulk-warung",
    name: "Bulk: rice and lauk",
    phases: ["BULKING", "STRENGTH_PEAK"],
    meals: [
      { slot: "breakfast", items: [i("oats", 60, "carb"), i("whole-milk", 250, "fixed"), i("egg", 100, "protein"), i("banana", 120, "carb")] },
      { slot: "lunch", items: [i("white-rice", 200, "carb"), i("chicken-thigh", 150, "protein"), i("tempeh", 50, "protein"), i("long-beans", 100, "fixed")] },
      { slot: "pre", items: [i("white-bread", 60, "carb"), i("peanut-butter", 16, "fat")] },
      { slot: "post", items: [i("whey", 30, "protein"), i("banana", 120, "carb")] },
      { slot: "dinner", items: [i("white-rice", 200, "carb"), i("beef-lean", 150, "protein"), i("broccoli", 90, "fixed"), i("cooking-oil", 10, "fat")] },
      { slot: "snack", items: [i("peanuts", 30, "fat"), i("whole-milk", 250, "fixed")] },
    ],
  },
  {
    id: "bulk-simple",
    name: "Bulk: easy prep",
    phases: ["BULKING", "STRENGTH_PEAK", "RECOMP"],
    meals: [
      { slot: "breakfast", items: [i("white-bread", 90, "carb"), i("egg", 150, "protein"), i("whole-milk", 250, "fixed")] },
      { slot: "lunch", items: [i("white-rice", 200, "carb"), i("chicken-breast", 150, "protein"), i("water-spinach", 100, "fixed"), i("cooking-oil", 10, "fat")] },
      { slot: "post", items: [i("chocolate-milk", 250, "fixed"), i("whey", 30, "protein"), i("dates", 25, "carb")] },
      { slot: "dinner", items: [i("white-rice", 200, "carb"), i("tilapia", 150, "protein"), i("tofu", 75, "protein"), i("cabbage", 90, "fixed"), i("cooking-oil", 10, "fat")] },
      { slot: "snack", items: [i("avocado", 70, "fat"), i("greek-yogurt", 150, "protein")] },
    ],
  },
  {
    id: "cut-lean",
    name: "Cut: lean and filling",
    phases: ["CUTTING", "RECOMP"],
    meals: [
      { slot: "breakfast", items: [i("egg", 100, "protein"), i("egg-white", 100, "protein"), i("wholemeal-bread", 60, "carb"), i("tomato", 120, "fixed")] },
      { slot: "lunch", items: [i("brown-rice", 150, "carb"), i("chicken-breast", 150, "protein"), i("spinach", 100, "fixed"), i("cooking-oil", 5, "fat")] },
      { slot: "pre", items: [i("banana", 120, "carb"), i("greek-yogurt", 150, "protein")] },
      { slot: "post", items: [i("whey", 30, "protein"), i("apple", 180, "fixed")] },
      { slot: "dinner", items: [i("potato", 200, "carb"), i("tilapia", 150, "protein"), i("broccoli", 90, "fixed"), i("cooking-oil", 5, "fat")] },
      { slot: "snack", items: [i("tofu", 150, "protein"), i("guava", 100, "fixed")] },
    ],
  },
  {
    id: "cut-budget",
    name: "Cut: budget lauk",
    phases: ["CUTTING", "RECOMP", "STRENGTH_PEAK"],
    meals: [
      { slot: "breakfast", items: [i("oats", 40, "carb"), i("skim-milk", 250, "fixed"), i("egg", 100, "protein")] },
      { slot: "lunch", items: [i("white-rice", 150, "carb"), i("tempeh", 100, "protein"), i("tofu", 150, "protein"), i("green-beans", 100, "fixed"), i("cooking-oil", 5, "fat")] },
      { slot: "post", items: [i("tuna", 120, "protein"), i("sweet-potato", 130, "carb")] },
      { slot: "dinner", items: [i("white-rice", 150, "carb"), i("chicken-breast", 150, "protein"), i("water-spinach", 100, "fixed"), i("cooking-oil", 5, "fat")] },
      { slot: "snack", items: [i("papaya", 150, "fixed"), i("cottage-cheese", 110, "protein")] },
    ],
  },
];

const BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export interface PlannedItem {
  food: Food;
  grams: number;
}
export interface PlannedMeal {
  slot: MealSlot;
  items: PlannedItem[];
  totals: Nutrients;
}
export interface PlannedDay {
  template: DayTemplate;
  meals: PlannedMeal[];
  totals: Nutrients;
}

/** Templates written for a phase, the best fit first. */
export function templatesFor(phase: BodyPhaseType): DayTemplate[] {
  return [...DAY_TEMPLATES].sort((a, b) => Number(!a.phases.includes(phase)) - Number(!b.phases.includes(phase)));
}

/** Grams that read like a real portion: eggs by the egg, the rest by 5 or 10 g. */
function portion(food: Food, grams: number): number {
  const unit = food.units[0];
  if (unit && /egg|slice|scoop/i.test(unit.label)) return Math.max(unit.grams, Math.round(grams / unit.grams) * unit.grams);
  const step = grams >= 100 ? 10 : 5;
  return Math.max(step, Math.round(grams / step) * step);
}

/**
 * Sizes a template to the day's target. Protein items scale together until protein meets the
 * target, then carb items for carbs, then fat items for what calories remain; a few rounds let
 * each settle against the others (carbs carry some protein, and so on). Amounts are rounded to
 * portions people can measure. Fixed items stay as written.
 */
export function planDay(template: DayTemplate, fuel: Pick<FuelTarget, "kcal" | "proteinG" | "carbsG" | "fatG">): PlannedDay {
  const items = template.meals.flatMap((m, mi) => m.items.map((it) => ({ ...it, mi, food: BY_ID[it.foodId]! })));
  const scale: Record<Role, number> = { protein: 1, carb: 1, fat: 1, fixed: 1 };
  const sumOf = (role: Role | "other", key: "protein" | "carbs" | "fat" | "calories") =>
    items
      .filter((x) => (role === "other" ? true : x.role === role))
      .reduce((n, x) => n + (x.food.macrosPer100g[key] * x.grams * scale[x.role]) / 100, 0);
  const solve = (role: Role, key: "protein" | "carbs" | "calories", target: number) => {
    const mine = sumOf(role, key);
    if (mine <= 0) return;
    const others = sumOf("other", key) - mine;
    scale[role] = Math.min(4, Math.max(0.25, (scale[role] * (target - others)) / mine));
  };
  for (let round = 0; round < 8; round++) {
    solve("protein", "protein", fuel.proteinG);
    solve("carb", "carbs", fuel.carbsG);
    solve("fat", "calories", fuel.kcal);
  }
  const rounded = items.map((x) => ({ ...x, grams: portion(x.food, x.grams * scale[x.role]) }));
  // Eggs and scoops round to whole ones, which can leave protein and calories off: the biggest
  // item measured in grams of each role takes up the difference.
  const settle = (role: Role, key: "protein" | "carbs" | "calories", target: number) => {
    const free = rounded.filter((x) => x.role === role && !/egg|slice|scoop/i.test(x.food.units[0]?.label ?? ""));
    const main = free.sort((a, b) => b.grams * b.food.macrosPer100g[key] - a.grams * a.food.macrosPer100g[key])[0];
    if (!main || main.food.macrosPer100g[key] <= 0) return;
    const have = rounded.reduce((n, x) => n + (x.food.macrosPer100g[key] * x.grams) / 100, 0);
    const grams = main.grams + ((target - have) * 100) / main.food.macrosPer100g[key];
    main.grams = portion(main.food, Math.max(main.grams * 0.25, grams));
  };
  settle("protein", "protein", fuel.proteinG);
  settle("carb", "carbs", fuel.carbsG);
  settle("fat", "calories", fuel.kcal);
  const meals: PlannedMeal[] = template.meals.map((m, mi) => {
    const planned = rounded.filter((x) => x.mi === mi).map((x) => ({ food: x.food, grams: x.grams }));
    return { slot: m.slot, items: planned, totals: total(planned) };
  });
  return { template, meals, totals: total(meals.flatMap((m) => m.items)) };
}

/* ---------------------------------------------------------------- grocery list */

export type Aisle = "protein" | "staples" | "produce" | "dairy" | "pantry";
export const AISLE_LABEL: Record<Aisle, string> = {
  protein: "Meat, fish, tempe and tofu",
  staples: "Rice, bread and staples",
  produce: "Vegetables and fruit",
  dairy: "Milk and eggs",
  pantry: "Pantry",
};

/** Cooked staples are bought dry: rice about 2.5 times its weight once cooked, pasta 2.2. */
const RAW: Record<string, { factor: number; label: string }> = {
  "white-rice": { factor: 1 / 2.5, label: "Uncooked white rice" },
  "brown-rice": { factor: 1 / 2.5, label: "Uncooked brown rice" },
  pasta: { factor: 1 / 2.2, label: "Dry pasta" },
  "mung-beans": { factor: 1 / 2.5, label: "Dry mung beans" },
  "rice-vermicelli": { factor: 1 / 2.5, label: "Dry rice vermicelli" },
};

/** For translation: the shopping-list names of dry staples. */
export const RAW_LABELS = Object.values(RAW).map((r) => r.label);

function aisleOf(food: Food): Aisle {
  if (/milk|yogurt|cheese|egg/.test(food.id)) return "dairy";
  if (food.category === "PROTEIN") return "protein";
  if (food.category === "CARBS") return "staples";
  if (food.category === "VEGETABLES" || food.category === "FRUIT" || food.id === "banana" || food.id === "dates") return "produce";
  return "pantry";
}

export interface GroceryLine {
  foodId: string;
  /** English label, translated by the UI: the raw form when it differs. */
  label: string;
  grams: number;
  aisle: Aisle;
}

/** Everything a planned day needs, times the number of days, summed per food. */
export function groceryList(day: PlannedDay, days: number): GroceryLine[] {
  const sums = new Map<string, number>();
  for (const it of day.meals.flatMap((m) => m.items)) sums.set(it.food.id, (sums.get(it.food.id) ?? 0) + it.grams * days);
  const lines: GroceryLine[] = [];
  for (const [id, grams] of sums) {
    const food = BY_ID[id]!;
    if (food.id === "water") continue;
    const raw = RAW[id];
    lines.push({
      foodId: id,
      label: raw?.label ?? food.name,
      grams: Math.round((raw ? grams * raw.factor : grams) / 10) * 10,
      aisle: aisleOf(food),
    });
  }
  const order: Aisle[] = ["protein", "staples", "produce", "dairy", "pantry"];
  return lines.sort((a, b) => order.indexOf(a.aisle) - order.indexOf(b.aisle) || b.grams - a.grams);
}
