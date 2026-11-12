import type { MyFood } from "@/types/workout";
import type { Food } from "./nutrition-guide";
import { newId } from "./id";

/** The id a saved food has in the food list and the log. */
export const myFoodId = (m: Pick<MyFood, "id">) => `my-${m.id}`;
export const isMyFood = (f: Pick<Food, "id">) => f.id.startsWith("my-");

/**
 * A saved food as a Food, so it opens, scales and logs like any other: "100 g" stands for one
 * portion, so a half portion is 50 and the numbers per portion stay as entered.
 */
export function myFoodAsFood(m: MyFood): Food {
  return {
    id: myFoodId(m),
    name: m.name,
    category: "DISHES",
    macrosPer100g: { calories: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat },
    servingVisual: "1 portion",
    servingG: 100,
    bestForPhases: [],
    satietyIndex: "MEDIUM",
    digestSpeed: "MODERATE",
    tacticalNote: "",
    units: [
      { label: "1 portion", grams: 100 },
      { label: "1/2 portion", grams: 50 },
    ],
    source: "MINE",
  };
}

/** Adds a food to the saved list, newest first; one with the same name is replaced. At most 100. */
export function withMyFood(list: MyFood[], food: Omit<MyFood, "id">): MyFood[] {
  const name = food.name.trim().slice(0, 80);
  const kept = list.filter((m) => m.name.toLowerCase() !== name.toLowerCase());
  return [{ ...food, name, id: newId() }, ...kept].slice(0, 100);
}
