import type { BodyPhaseType, FuelTarget } from "./phase-engine";

/**
 * Everyday foods and drinks, most easy to find in Indonesia, with what 100 g (or 100 ml) holds,
 * household portions (a rice scoop, a slice of tempe, an egg), and what each is good for in a
 * body phase. Each row names its source:
 * - TKPI: Tabel Komposisi Pangan Indonesia (Kemenkes RI), for Indonesian staples;
 * - USDA: USDA FoodData Central (public domain), typical figures for the food as listed
 *   (cooked unless it says raw or dry);
 * - ESTIMATE: mixed dishes (gado-gado, soto), worked out from a typical recipe: a guide only.
 * Brands and cooking change all of them, so they are a guide, not a label. Names and notes are
 * English here; the UI translates them.
 */

export type FoodCategory = "PROTEIN" | "CARBS" | "VEGETABLES" | "FRUIT" | "FATS" | "DISHES" | "DRINK_HYDRATION" | "PRE_POST_WORKOUT";
export type FoodSource = "TKPI" | "USDA" | "ESTIMATE";

/** A household portion: "1 rice scoop" is about 100 g of cooked rice. */
export interface FoodUnit {
  label: string;
  grams: number;
}
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
  /** Household portions, the usual one first; the serving above is always offered too. */
  units: FoodUnit[];
  /** Fibre per 100 g, when known. */
  fiber?: number;
  source: FoodSource;
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
  extra: { units?: [string, number][]; fiber?: number; source?: FoodSource } = {},
): Food => ({
  id,
  name,
  category,
  macrosPer100g: { calories, protein, carbs, fat },
  servingVisual,
  servingG,
  bestForPhases,
  satietyIndex,
  digestSpeed,
  tacticalNote,
  units: (extra.units ?? []).map(([label, grams]) => ({ label, grams })),
  ...(extra.fiber !== undefined ? { fiber: extra.fiber } : {}),
  source: extra.source ?? "USDA",
});

/** Newer rows: the portion is the first household unit, so it is written once. */
const u = (
  id: string,
  name: string,
  category: FoodCategory,
  macros: [number, number, number, number],
  units: [string, number][],
  bestForPhases: BodyPhaseType[],
  satietyIndex: Level,
  digestSpeed: DigestSpeed,
  tacticalNote: string,
  extra: { fiber?: number; source?: FoodSource } = {},
): Food => f(id, name, category, macros, units[0]![0], units[0]![1], bestForPhases, satietyIndex, digestSpeed, tacticalNote, { ...extra, units });

const CUT_RECOMP: BodyPhaseType[] = ["CUTTING", "RECOMP"];
const BULK_SIDE: BodyPhaseType[] = ["BULKING", "RECOMP", "STRENGTH_PEAK"];

export const FOODS: Food[] = [
  // Protein
  f("chicken-breast", "Chicken breast, skinless", "PROTEIN", [165, 31, 0, 3.6], "1 palm-sized piece (~120 g)", 120, ALL, "HIGH", "MODERATE", "The most protein per calorie among everyday meats.", { units: [["1 palm-sized piece", 120], ["1 breast", 170]] }),
  f("chicken-thigh", "Chicken thigh, skinless", "PROTEIN", [209, 26, 0, 10.9], "1 large thigh (~120 g)", 120, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "MODERATE", "More fat and flavour than breast: easier calories when bulking.", { units: [["1 thigh", 120]] }),
  f("egg", "Egg, boiled", "PROTEIN", [155, 12.6, 1.1, 10.6], "1 large egg (~50 g)", 50, ALL, "HIGH", "MODERATE", "Complete protein; the yolk carries most of the vitamins.", { units: [["1 egg", 50], ["2 eggs", 100]] }),
  f("egg-white", "Egg whites", "PROTEIN", [52, 10.9, 0.7, 0.2], "Whites of 3 eggs (~100 g)", 100, ["CUTTING", "RECOMP"], "MEDIUM", "FAST", "Almost pure protein: adds volume to a meal on a cut.", { units: [["1 egg white", 33]] }),
  f("tempeh", "Tempeh", "PROTEIN", [201, 20.8, 13.5, 8.8], "2 slices the size of a phone (~100 g)", 100, ALL, "HIGH", "SLOW", "Fermented soy: protein and fibre at a low price.", { units: [["1 slice", 50], ["1 block", 200]], fiber: 1.4, source: "TKPI" }),
  f("tofu", "Tofu", "PROTEIN", [80, 10.9, 0.8, 4.7], "1 block (~150 g)", 150, ["CUTTING", "RECOMP"], "MEDIUM", "MODERATE", "Few calories for its size: fills the plate on a cut.", { units: [["1 piece", 75], ["1 block", 150]], source: "TKPI" }),
  f("tuna", "Tuna, canned in water, drained", "PROTEIN", [116, 25.5, 0, 0.8], "1 small can, drained (~120 g)", 120, ["CUTTING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "MODERATE", "Very lean protein that needs no cooking.", { units: [["1 small can", 120]] }),
  f("tilapia", "Tilapia (ikan nila)", "PROTEIN", [128, 26.2, 0, 2.7], "1 palm-sized fillet (~120 g)", 120, ALL, "HIGH", "MODERATE", "Lean white fish found in most markets.", { units: [["1 fish", 150]] }),
  f("salmon", "Salmon", "PROTEIN", [206, 22.1, 0, 12.4], "1 palm-sized fillet (~120 g)", 120, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "SLOW", "Omega-3 fats with the protein.", { units: [["1 fillet", 120]] }),
  f("beef-lean", "Lean beef, raw weight", "PROTEIN", [137, 21.4, 0, 5], "1 palm-sized piece, raw (~120 g)", 120, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "HIGH", "SLOW", "Iron, zinc and creatine along with the protein.", { units: [["1 palm-sized piece", 120]] }),
  f("greek-yogurt", "Greek yogurt, plain, fat-free", "PROTEIN", [59, 10.2, 3.6, 0.4], "1 small cup (~150 g)", 150, ["CUTTING", "RECOMP"], "HIGH", "MODERATE", "Thick and filling for very few calories.", { units: [["1 small cup", 150]] }),
  // Carbs
  f("white-rice", "White rice", "CARBS", [180, 3, 39.8, 0.3], "1 fist (~150 g)", 150, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "LOW", "FAST", "Fast fuel around training; easy to eat more of when bulking.", { units: [["1 rice scoop", 100], ["1 plate", 200]], fiber: 0.2, source: "TKPI" }),
  f("brown-rice", "Brown rice", "CARBS", [112, 2.3, 23.5, 0.8], "1 fist (~150 g)", 150, ["CUTTING", "RECOMP"], "MEDIUM", "MODERATE", "More fibre than white rice, so it lasts longer.", { units: [["1 rice scoop", 100]], fiber: 1.8 }),
  f("potato", "Potato, boiled", "CARBS", [86, 1.7, 20, 0.1], "1 fist-sized potato (~150 g)", 150, ["CUTTING", "RECOMP", "BULKING"], "HIGH", "MODERATE", "One of the most filling foods per calorie.", { units: [["1 medium potato", 150]], fiber: 1.8 }),
  f("sweet-potato", "Sweet potato (ubi), baked", "CARBS", [90, 2, 20.7, 0.2], "1 fist-sized piece (~150 g)", 150, ALL, "HIGH", "MODERATE", "Slow carbs with vitamin A.", { units: [["1 medium sweet potato", 130]], fiber: 3.3 }),
  f("oats", "Oats, dry", "CARBS", [379, 13.2, 67.7, 6.5], "½ cup dry (~40 g)", 40, ALL, "HIGH", "SLOW", "Slow carbs and fibre: a steady breakfast before a late-morning session.", { units: [["3 tablespoons", 30], ["1 cup dry", 80]], fiber: 10.1 }),
  // Fats
  f("avocado", "Avocado", "FATS", [160, 2, 8.5, 14.7], "½ avocado (~70 g)", 70, ["BULKING", "RECOMP", "STRENGTH_PEAK"], "MEDIUM", "SLOW", "Healthy fats and potassium; keep it small on a cut.", { units: [["1 whole avocado", 140]], fiber: 6.7 }),
  f("peanut-butter", "Peanut butter", "FATS", [588, 25, 20, 50], "1 tablespoon (~16 g)", 16, ["BULKING"], "MEDIUM", "SLOW", "Calorie-dense: an easy surplus, easy to overdo on a cut.", { units: [["1 tablespoon", 16]], fiber: 6 }),
  // Around training
  f("banana", "Banana", "PRE_POST_WORKOUT", [89, 1.1, 22.8, 0.3], "1 medium banana, peeled (~120 g)", 120, ALL, "MEDIUM", "FAST", "Fast carbs and potassium 30 to 60 minutes before training.", { units: [["1 medium banana", 120]], fiber: 2.6 }),
  f("whey", "Whey protein powder (typical)", "PRE_POST_WORKOUT", [400, 80, 10, 5], "1 scoop (~30 g)", 30, ALL, "LOW", "FAST", "Fast protein after training; check your brand's label.", { units: [["1 scoop", 30]] }),
  f("black-coffee", "Black coffee", "PRE_POST_WORKOUT", [1, 0.1, 0, 0], "1 cup (~240 ml)", 240, ALL, "LOW", "FAST", "Caffeine 30 to 60 minutes before training can lift effort; skip it late in the day.", { units: [["1 cup", 240]] }),
  // Drinks
  f("water", "Water", "DRINK_HYDRATION", [0, 0, 0, 0], "1 bottle (~500 ml)", 500, ALL, "LOW", "FAST", "Drink through the day, and more when you sweat.", { units: [["1 glass", 250], ["1 bottle", 600]] }),
  f("coconut-water", "Coconut water", "DRINK_HYDRATION", [19, 0.7, 3.7, 0.2], "1 glass (~250 ml)", 250, ALL, "LOW", "FAST", "Rich in potassium: a light way to replace electrolytes after sweaty sessions.", { units: [["1 glass", 250]] }),
  f("soy-milk", "Soy milk, unsweetened", "DRINK_HYDRATION", [33, 2.9, 1.7, 1.6], "1 glass (~250 ml)", 250, ["CUTTING", "RECOMP"], "LOW", "MODERATE", "Some protein in a drink, with few calories when unsweetened.", { units: [["1 glass", 250]] }),
  // Protein, more
  u("shrimp", "Shrimp, cooked", "PROTEIN", [99, 24, 0.2, 0.3], [["10 medium shrimp", 100]], ALL, "HIGH", "FAST", "Almost all protein, quick to cook."),
  u("sardines", "Sardines, canned in oil, drained", "PROTEIN", [208, 24.6, 0, 11.5], [["1 small can, drained", 90]], BULK_SIDE, "HIGH", "MODERATE", "Protein, omega-3 and calcium from the soft bones."),
  u("fried-tofu", "Fried tofu (tahu goreng)", "PROTEIN", [271, 17.3, 10.5, 20.2], [["1 piece", 40]], ["BULKING"], "MEDIUM", "MODERATE", "Frying triples the calories of tofu: a bulking side, not a cutting one."),
  u("chicken-liver", "Chicken liver, cooked", "PROTEIN", [167, 24.5, 0.9, 6.5], [["1 piece", 40]], ALL, "HIGH", "MODERATE", "Iron and vitamin A; once or twice a week is plenty."),
  u("cottage-cheese", "Cottage cheese, low fat", "PROTEIN", [81, 10.5, 4.3, 2.3], [["1/2 cup", 110]], CUT_RECOMP, "HIGH", "SLOW", "Slow casein protein: a good evening snack."),
  u("edamame", "Edamame, shelled", "PROTEIN", [121, 11.9, 8.9, 5.2], [["1 bowl", 100]], ALL, "HIGH", "MODERATE", "Plant protein with fibre, ready in minutes.", { fiber: 5.2 }),
  u("mung-beans", "Mung beans (kacang hijau), boiled", "PROTEIN", [105, 7, 19.2, 0.4], [["1 bowl", 150]], ALL, "HIGH", "SLOW", "Cheap plant protein and carbs; skip the coconut milk and sugar on a cut.", { fiber: 7.6 }),
  // Carbs, more
  u("white-bread", "White bread", "CARBS", [266, 7.6, 49.2, 3.3], [["1 slice", 30]], BULK_SIDE, "LOW", "FAST", "Quick carbs that are easy to eat in bulk."),
  u("wholemeal-bread", "Wholemeal bread", "CARBS", [247, 13, 41.3, 3.4], [["1 slice", 30]], ALL, "MEDIUM", "MODERATE", "More fibre and protein than white bread.", { fiber: 6.8 }),
  u("rice-vermicelli", "Rice vermicelli (bihun), cooked", "CARBS", [108, 1.8, 24, 0.2], [["1 bowl", 150]], BULK_SIDE, "LOW", "FAST", "Light carbs with almost no fat."),
  u("instant-noodles", "Instant noodles, dry block", "CARBS", [440, 9, 63, 17], [["1 pack", 80]], ["BULKING"], "LOW", "FAST", "Fried noodles: many calories and much salt; add an egg and vegetables.", { source: "ESTIMATE" }),
  u("pasta", "Pasta, cooked", "CARBS", [158, 5.8, 30.9, 0.9], [["1 plate", 200]], BULK_SIDE, "MEDIUM", "MODERATE", "Steady carbs for heavy training days.", { fiber: 1.8 }),
  u("corn", "Sweet corn, boiled", "CARBS", [96, 3.4, 21, 1.5], [["1 cob", 100]], ALL, "MEDIUM", "MODERATE", "Carbs with fibre, filling for its calories.", { fiber: 2.4 }),
  u("cassava", "Cassava (singkong), raw weight", "CARBS", [160, 1.4, 38.1, 0.3], [["1 piece", 100]], BULK_SIDE, "MEDIUM", "MODERATE", "Dense, cheap carbs; boiled is lighter than fried.", { fiber: 1.8 }),
  u("honey", "Honey", "PRE_POST_WORKOUT", [304, 0.3, 82.4, 0], [["1 tablespoon", 21]], BULK_SIDE, "LOW", "FAST", "Pure fast sugar: on bread before training, or in a post-workout drink."),
  u("dates", "Dates (kurma)", "PRE_POST_WORKOUT", [277, 1.8, 75, 0.2], [["3 dates", 25]], ALL, "MEDIUM", "FAST", "Quick carbs that travel well: also the way to break a fast.", { fiber: 6.7 }),
  // Vegetables
  u("spinach", "Spinach (bayam), boiled", "VEGETABLES", [23, 3, 3.8, 0.3], [["1 bowl", 100]], ALL, "HIGH", "MODERATE", "Volume and iron for almost no calories.", { fiber: 2.4 }),
  u("water-spinach", "Water spinach (kangkung), cooked", "VEGETABLES", [20, 2.1, 3.1, 0.3], [["1 bowl", 100]], ALL, "HIGH", "MODERATE", "Cheap greens; stir-fried adds about 50 kcal of oil per bowl.", { fiber: 1.9 }),
  u("broccoli", "Broccoli, boiled", "VEGETABLES", [35, 2.4, 7.2, 0.4], [["1 bowl", 90]], ALL, "HIGH", "MODERATE", "Fibre and vitamin C; one of the most filling vegetables.", { fiber: 3.3 }),
  u("carrot", "Carrot", "VEGETABLES", [41, 0.9, 9.6, 0.2], [["1 medium carrot", 60]], ALL, "HIGH", "MODERATE", "A crunchy snack with vitamin A.", { fiber: 2.8 }),
  u("green-beans", "Green beans (buncis), boiled", "VEGETABLES", [35, 1.9, 7.9, 0.3], [["1 bowl", 100]], ALL, "HIGH", "MODERATE", "Easy volume next to rice and protein.", { fiber: 3.2 }),
  u("long-beans", "Long beans (kacang panjang), boiled", "VEGETABLES", [47, 2.5, 9.2, 0.1], [["1 bowl", 100]], ALL, "HIGH", "MODERATE", "A staple in sayur and pecel.", { fiber: 3.6 }),
  u("cabbage", "Cabbage (kol)", "VEGETABLES", [25, 1.3, 5.8, 0.1], [["1 bowl", 90]], ALL, "HIGH", "MODERATE", "Crunch and volume, raw or in soup.", { fiber: 2.5 }),
  u("cucumber", "Cucumber (timun)", "VEGETABLES", [15, 0.7, 3.6, 0.1], [["1 cucumber", 150]], ALL, "MEDIUM", "FAST", "Mostly water: lalapan that costs nothing."),
  u("tomato", "Tomato", "VEGETABLES", [18, 0.9, 3.9, 0.2], [["1 medium tomato", 120]], ALL, "MEDIUM", "FAST", "Flavour and vitamin C for very few calories.", { fiber: 1.2 }),
  // Fruit
  u("papaya", "Papaya (pepaya)", "FRUIT", [43, 0.5, 10.8, 0.3], [["1 slice", 150]], ALL, "MEDIUM", "FAST", "Sweet and light, easy on the stomach.", { fiber: 1.7 }),
  u("apple", "Apple", "FRUIT", [52, 0.3, 13.8, 0.2], [["1 medium apple", 180]], ALL, "HIGH", "MODERATE", "Crunchy and filling: a good snack on a cut.", { fiber: 2.4 }),
  u("watermelon", "Watermelon (semangka)", "FRUIT", [30, 0.6, 7.6, 0.2], [["1 slice", 280]], ALL, "MEDIUM", "FAST", "Water and a little sugar after a hot session."),
  u("mango", "Mango (mangga)", "FRUIT", [60, 0.8, 15, 0.4], [["1 medium mango", 200]], BULK_SIDE, "MEDIUM", "FAST", "Sweet carbs with vitamin C.", { fiber: 1.6 }),
  u("orange", "Orange (jeruk)", "FRUIT", [47, 0.9, 11.8, 0.1], [["1 medium orange", 130]], ALL, "MEDIUM", "FAST", "Vitamin C and fluid.", { fiber: 2.4 }),
  u("pineapple", "Pineapple (nanas)", "FRUIT", [50, 0.5, 13.1, 0.1], [["1 slice", 85]], ALL, "MEDIUM", "FAST", "Sweet and juicy for few calories.", { fiber: 1.4 }),
  u("guava", "Guava (jambu biji)", "FRUIT", [68, 2.6, 14.3, 1], [["1 guava", 100]], ALL, "HIGH", "MODERATE", "More vitamin C than an orange, and plenty of fibre.", { fiber: 5.4 }),
  // Fats, more
  u("peanuts", "Peanuts, roasted", "FATS", [585, 23.7, 21.5, 49.7], [["1 handful", 30]], ["BULKING"], "MEDIUM", "SLOW", "An easy surplus: a handful is about 175 kcal.", { fiber: 8 }),
  u("almonds", "Almonds", "FATS", [579, 21.2, 21.6, 49.9], [["1 handful", 30]], BULK_SIDE, "MEDIUM", "SLOW", "Healthy fats, vitamin E and fibre.", { fiber: 12.5 }),
  u("cooking-oil", "Cooking oil", "FATS", [884, 0, 0, 100], [["1 tablespoon", 14]], BULK_SIDE, "LOW", "SLOW", "Each tablespoon is about 120 kcal: the hidden calories in fried food."),
  u("coconut-milk", "Coconut milk (santan)", "FATS", [230, 2.3, 5.5, 23.8], [["1/2 cup", 120]], ["BULKING"], "MEDIUM", "SLOW", "Rich curries and opor: easy calories, mostly saturated fat."),
  u("cheese", "Cheddar cheese", "FATS", [403, 24.9, 1.3, 33.1], [["1 slice", 20]], BULK_SIDE, "MEDIUM", "SLOW", "Protein and fat in a small bite."),
  // Dishes (estimates for a typical portion's recipe)
  u("gado-gado", "Gado-gado", "DISHES", [137, 6, 9, 9], [["1 plate", 300]], ALL, "HIGH", "MODERATE", "Vegetables, tofu, tempe and egg; the peanut sauce holds most of the calories.", { source: "ESTIMATE", fiber: 3 }),
  u("pecel", "Pecel", "DISHES", [120, 5, 12, 6], [["1 plate", 250]], ALL, "HIGH", "MODERATE", "Boiled vegetables with peanut sauce; ask for less sauce on a cut.", { source: "ESTIMATE", fiber: 3 }),
  u("soto-ayam", "Chicken soto (soto ayam), without rice", "DISHES", [60, 4.5, 3, 3.3], [["1 bowl", 350]], ALL, "MEDIUM", "MODERATE", "Warm and light; the rice and fried toppings add the calories.", { source: "ESTIMATE" }),
  u("nasi-goreng", "Fried rice (nasi goreng)", "DISHES", [168, 6.3, 21, 6.2], [["1 plate", 300]], ["BULKING"], "MEDIUM", "MODERATE", "Rice and oil: a fast 500 kcal plate. Add an egg for protein.", { source: "ESTIMATE" }),
  u("chicken-satay", "Chicken satay (sate ayam) with peanut sauce", "DISHES", [225, 20, 6, 13], [["10 skewers", 150]], BULK_SIDE, "HIGH", "MODERATE", "Grilled chicken protein; the sauce doubles the fat.", { source: "ESTIMATE" }),
  u("mie-ayam", "Chicken noodles (mie ayam)", "DISHES", [140, 7, 18, 4.5], [["1 bowl", 350]], ["BULKING"], "MEDIUM", "MODERATE", "Mostly noodles: count it as a carb meal with some protein.", { source: "ESTIMATE" }),
  u("ketoprak", "Ketoprak", "DISHES", [150, 6, 18, 6], [["1 plate", 300]], BULK_SIDE, "MEDIUM", "MODERATE", "Rice cake, tofu and bean sprouts in peanut sauce.", { source: "ESTIMATE" }),
  u("grilled-chicken", "Grilled chicken (ayam bakar)", "DISHES", [190, 27, 2, 8], [["1 piece", 120]], ALL, "HIGH", "MODERATE", "A lean protein choice at any warung; skip the skin on a cut.", { source: "ESTIMATE" }),
  // Drinks, more
  u("skim-milk", "Skim milk", "DRINK_HYDRATION", [34, 3.4, 5, 0.1], [["1 glass", 250]], ALL, "MEDIUM", "MODERATE", "Protein in a drink with almost no fat."),
  u("whole-milk", "Whole milk", "DRINK_HYDRATION", [61, 3.2, 4.8, 3.3], [["1 glass", 250]], BULK_SIDE, "MEDIUM", "MODERATE", "An easy 150 kcal with 8 g protein per glass."),
  u("chocolate-milk", "Chocolate milk", "PRE_POST_WORKOUT", [83, 3.2, 10.4, 3.4], [["1 glass", 250]], BULK_SIDE, "LOW", "FAST", "Carbs and protein together: a classic after training."),
  u("sweet-tea", "Sweet iced tea (es teh manis)", "DRINK_HYDRATION", [40, 0, 10, 0], [["1 glass", 300]], ["BULKING"], "LOW", "FAST", "About 120 kcal of sugar a glass: ask for less sugar on a cut.", { source: "ESTIMATE" }),
  u("orange-juice", "Orange juice", "DRINK_HYDRATION", [45, 0.7, 10.4, 0.2], [["1 glass", 250]], BULK_SIDE, "LOW", "FAST", "Fast sugar and vitamin C; the whole fruit fills you more."),
  u("sports-drink", "Isotonic sports drink", "PRE_POST_WORKOUT", [26, 0, 6.4, 0], [["1 bottle", 500]], ALL, "LOW", "FAST", "Sugar and salts for long, sweaty sessions; water is enough for most."),
];

export const FOOD_CATEGORIES: FoodCategory[] = ["PROTEIN", "CARBS", "VEGETABLES", "FRUIT", "FATS", "DISHES", "PRE_POST_WORKOUT", "DRINK_HYDRATION"];
export const CATEGORY_LABEL: Record<FoodCategory, string> = {
  PROTEIN: "Protein",
  CARBS: "Carbs",
  VEGETABLES: "Vegetables",
  FRUIT: "Fruit",
  FATS: "Fats",
  DISHES: "Dishes",
  PRE_POST_WORKOUT: "Around training",
  DRINK_HYDRATION: "Drinks",
};
export const LEVEL_LABEL: Record<Level, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
export const SOURCE_LABEL: Record<FoodSource, string> = {
  TKPI: "Tabel Komposisi Pangan Indonesia (Kemenkes RI)",
  USDA: "USDA FoodData Central",
  ESTIMATE: "Estimate from a typical recipe",
};
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
