import type { BodyPhaseType, FuelTarget } from "./phase-engine";

/**
 * A short list of everyday foods and drinks, many easy to find in Indonesia, with what 100 g
 * (or 100 ml) holds, a way to judge a portion without a scale, and what each is good for in a
 * body phase. Values are typical figures from USDA FoodData Central for the food as listed
 * (cooked unless it says raw or dry); brands and cooking change them, so they are a guide,
 * not a label. Names and notes are English here; the UI translates them.
 */

export type FoodCategory = "PROTEIN" | "CARBS" | "FATS" | "DRINK_HYDRATION" | "PRE_POST_WORKOUT";
export type Level = "HIGH" | "MEDIUM" | "LOW";
export type DigestSpeed = "FAST" | "MODERATE" | "SLOW";

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  /** Per 100 g, or 100 ml for drinks. */
  macrosPer100g: { calories: number; protein: number; carbs: number; fat: number };
  /** A portion judged by eye: "1 palm-sized piece (~120 g)". */
  servingVisual: string;
  /** Grams (or ml) in that portion. */
  servingG: number;
  bestForPhases: BodyPhaseType[];
  /** How full it keeps you per calorie: matters most on a cut. */
  satietyIndex: Level;
  /** How fast it digests: fast before training, any after. */
  digestSpeed: DigestSpeed;
  tacticalNote: string;
}

const ALL: BodyPhaseType[] = ["CUTTING", "BULKING", "RECOMP", "STRENGTH_PEAK"];

const f = (
  id: string,
  name: string,
  category: FoodCategory,
  [calories, protein, carbs, fat]: [number, number, number, number],
  servingVisual: string,
  servingG: number,
  bestForPhases: BodyPhaseType[],
  satietyIndex: Level,
  digestSpeed: DigestSpeed,
  tacticalNote: string,
): Food => ({ id, name, category, macrosPer100g: { calories, protein, carbs, fat }, servingVisual, servingG, bestForPhases, satietyIndex, digestSpeed, tacticalNote });

export const FOODS: Food[] = [
  // Protein
  f("chicken-breast", "Chicken breast, skinless", "PROTEIN", [165, 31, 0, 3.6], "1 palm-sized piece (~120 g)", 120, ALL, "HIGH", "MODERATE", "The most protein per calorie among everyday meats."),
  f("chicken-thigh", "Chicken thigh, skinless", "PROTEIN", [209, 26, 0, 10.9], "1 large thigh (~120 g)", 120, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "MODERATE", "More fat and flavour than breast: easier calories when bulking."),
  f("egg", "Egg, boiled", "PROTEIN", [155, 12.6, 1.1, 10.6], "1 large egg (~50 g)", 50, ALL, "HIGH", "MODERATE", "Complete protein; the yolk carries most of the vitamins."),
  f("egg-white", "Egg whites", "PROTEIN", [52, 10.9, 0.7, 0.2], "Whites of 3 eggs (~100 g)", 100, ["CUTTING", "RECOMP"], "MEDIUM", "FAST", "Almost pure protein: adds volume to a meal on a cut."),
  f("tempeh", "Tempeh", "PROTEIN", [192, 20.3, 7.6, 10.8], "2 slices the size of a phone (~100 g)", 100, ALL, "HIGH", "SLOW", "Fermented soy: protein and fibre at a low price."),
  f("tofu", "Tofu", "PROTEIN", [76, 8.1, 1.9, 4.8], "1 block (~150 g)", 150, ["CUTTING", "RECOMP"], "MEDIUM", "MODERATE", "Few calories for its size: fills the plate on a cut."),
  f("tuna", "Tuna, canned in water, drained", "PROTEIN", [116, 25.5, 0, 0.8], "1 small can, drained (~120 g)", 120, ["CUTTING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "MODERATE", "Very lean protein that needs no cooking."),
  f("tilapia", "Tilapia (ikan nila)", "PROTEIN", [128, 26.2, 0, 2.7], "1 palm-sized fillet (~120 g)", 120, ALL, "HIGH", "MODERATE", "Lean white fish found in most markets."),
  f("salmon", "Salmon", "PROTEIN", [206, 22.1, 0, 12.4], "1 palm-sized fillet (~120 g)", 120, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "SLOW", "Omega-3 fats with the protein."),
  f("beef-lean", "Lean beef, raw weight", "PROTEIN", [137, 21.4, 0, 5], "1 palm-sized piece, raw (~120 g)", 120, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "SLOW", "Iron, zinc and creatine along with the protein."),
  f("greek-yogurt", "Greek yogurt, plain, fat-free", "PROTEIN", [59, 10.2, 3.6, 0.4], "1 small cup (~150 g)", 150, ["CUTTING", "RECOMP"], "HIGH", "MODERATE", "Thick and filling for very few calories."),
  // Carbs
  f("white-rice", "White rice", "CARBS", [130, 2.7, 28.2, 0.3], "1 fist (~150 g)", 150, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "LOW", "FAST", "Fast fuel around training; easy to eat more of when bulking."),
  f("brown-rice", "Brown rice", "CARBS", [112, 2.3, 23.5, 0.8], "1 fist (~150 g)", 150, ["CUTTING", "RECOMP"], "MEDIUM", "MODERATE", "More fibre than white rice, so it lasts longer."),
  f("potato", "Potato, boiled", "CARBS", [86, 1.7, 20, 0.1], "1 fist-sized potato (~150 g)", 150, ["CUTTING", "RECOMP", "BULKING"], "HIGH", "MODERATE", "One of the most filling foods per calorie."),
  f("sweet-potato", "Sweet potato (ubi), baked", "CARBS", [90, 2, 20.7, 0.2], "1 fist-sized piece (~150 g)", 150, ALL, "HIGH", "MODERATE", "Slow carbs with vitamin A."),
  f("oats", "Oats, dry", "CARBS", [379, 13.2, 67.7, 6.5], "½ cup dry (~40 g)", 40, ALL, "HIGH", "SLOW", "Slow carbs and fibre: a steady breakfast before a late-morning session."),
  // Fats
  f("avocado", "Avocado", "FATS", [160, 2, 8.5, 14.7], "½ avocado (~70 g)", 70, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "MEDIUM", "SLOW", "Healthy fats and potassium; keep it small on a cut."),
  f("peanut-butter", "Peanut butter", "FATS", [588, 25, 20, 50], "1 tablespoon (~16 g)", 16, ["BULKING"], "MEDIUM", "SLOW", "Calorie-dense: an easy surplus, easy to overdo on a cut."),
  // Around training
  f("banana", "Banana", "PRE_POST_WORKOUT", [89, 1.1, 22.8, 0.3], "1 medium banana, peeled (~120 g)", 120, ALL, "MEDIUM", "FAST", "Fast carbs and potassium 30 to 60 minutes before training."),
  f("whey", "Whey protein powder (typical)", "PRE_POST_WORKOUT", [400, 80, 10, 5], "1 scoop (~30 g)", 30, ALL, "LOW", "FAST", "Fast protein after training; check your brand's label."),
  f("black-coffee", "Black coffee", "PRE_POST_WORKOUT", [1, 0.1, 0, 0], "1 cup (~240 ml)", 240, ALL, "LOW", "FAST", "Caffeine 30 to 60 minutes before training can lift effort; skip it late in the day."),
  // Drinks
  f("water", "Water", "DRINK_HYDRATION", [0, 0, 0, 0], "1 bottle (~500 ml)", 500, ALL, "LOW", "FAST", "Drink through the day, and more when you sweat."),
  f("coconut-water", "Coconut water", "DRINK_HYDRATION", [19, 0.7, 3.7, 0.2], "1 glass (~250 ml)", 250, ALL, "LOW", "FAST", "Rich in potassium: a light way to replace electrolytes after sweaty sessions."),
  f("soy-milk", "Soy milk, unsweetened", "DRINK_HYDRATION", [33, 2.9, 1.7, 1.6], "1 glass (~250 ml)", 250, ["CUTTING", "RECOMP"], "LOW", "MODERATE", "Some protein in a drink, with few calories when unsweetened."),
];

export const FOOD_CATEGORIES: FoodCategory[] = ["PROTEIN", "CARBS", "FATS", "PRE_POST_WORKOUT", "DRINK_HYDRATION"];
export const CATEGORY_LABEL: Record<FoodCategory, string> = {
  PROTEIN: "Protein",
  CARBS: "Carbs",
  FATS: "Fats",
  PRE_POST_WORKOUT: "Around training",
  DRINK_HYDRATION: "Drinks",
};
export const LEVEL_LABEL: Record<Level, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
export const DIGEST_LABEL: Record<DigestSpeed, string> = { FAST: "Fast", MODERATE: "Moderate", SLOW: "Slow" };

/** Foods for a phase: those it suits first, the most filling first on a cut. */
export function foodsFor(phase: BodyPhaseType, category?: FoodCategory): Food[] {
  const rank: Record<Level, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return FOODS.filter((x) => !category || x.category === category).sort((a, b) => {
    const fit = Number(!a.bestForPhases.includes(phase)) - Number(!b.bestForPhases.includes(phase));
    if (fit !== 0) return fit;
    return phase === "CUTTING" ? rank[a.satietyIndex] - rank[b.satietyIndex] : 0;
  });
}

/* ---------------------------------------------------------------- meal combos */

export interface ComboItem {
  food: Food;
  grams: number;
}
export interface MealCombo {
  when: "pre" | "post";
  items: ComboItem[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const round10 = (g: number) => Math.round(g / 10) * 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const per = (food: Food, grams: number, key: keyof Food["macrosPer100g"]) => (food.macrosPer100g[key] * grams) / 100;

/**
 * A meal before and after training, sized from the day's target: before, a fifth of the
 * calories with a fifth of the protein from a lean, quick protein and fast carbs; after, a
 * quarter of the calories with 30% of the protein. Portions are rounded to 10 g.
 */
export function mealCombos(phase: BodyPhaseType, fuel: FuelTarget, pick = 0): MealCombo[] {
  const lean = (x: Food) => x.macrosPer100g.fat <= 5 && x.macrosPer100g.protein >= 10;
  const proteins = foodsFor(phase).filter((x) => (x.category === "PROTEIN" || x.id === "whey") && lean(x));
  const carbs = foodsFor(phase).filter((x) => (x.category === "CARBS" || x.id === "banana") && x.macrosPer100g.carbs >= 15);
  const make = (when: "pre" | "post", share: number, proteinShare: number, fast: boolean): MealCombo => {
    // Before: a quick protein and fast carbs. After: the next pair down, so the meals differ.
    const pList = fast ? proteins.filter((x) => x.digestSpeed !== "SLOW") : proteins;
    const cList = fast ? carbs.filter((x) => x.digestSpeed === "FAST") : carbs;
    const at = pick + (fast ? 0 : 1);
    const p = pList[at % pList.length]!;
    const c = cList[at % cList.length]!;
    const pMax = p.id === "whey" ? 60 : 300;
    const pG = clamp(round10((fuel.proteinG * proteinShare * 100) / p.macrosPer100g.protein), 20, pMax);
    const left = fuel.kcal * share - per(p, pG, "calories");
    const cG = clamp(round10((left * 100) / c.macrosPer100g.calories), 0, 400);
    const items = [{ food: p, grams: pG }, ...(cG > 0 ? [{ food: c, grams: cG }] : [])];
    const sum = (key: keyof Food["macrosPer100g"]) => Math.round(items.reduce((n, i) => n + per(i.food, i.grams, key), 0));
    return { when, items, kcal: sum("calories"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") };
  };
  return [make("pre", 0.2, 0.2, true), make("post", 0.25, 0.3, false)];
}

/* ---------------------------------------------------------------- hydration */

/** Daily water target: about 35 ml per kg of body weight, rounded to 250 ml. */
export function waterTargetMl(weightKg: number): number {
  return Math.round((weightKg * 35) / 250) * 250;
}
