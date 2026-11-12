import { create } from "zustand";
import type { FoodLogEntry } from "@/types/workout";
import type { Food } from "@/lib/nutrition-guide";
import { nutrientsFor } from "@/lib/nutrition-calc";
import { newId } from "@/lib/id";

export type Meal = FoodLogEntry["meal"];

/** Local calendar day as "YYYY-MM-DD", the key the log groups by. */
export function dayOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The meal a time of day most likely is, so a quick add needs no choice. */
export function mealAt(ts: number): Meal {
  const h = new Date(ts).getHours();
  return h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 18 ? "snack" : "dinner";
}

export function entryFor(food: Food, grams: number, meal: Meal, at = Date.now()): FoodLogEntry {
  const n = nutrientsFor(food, grams);
  return { id: newId(), day: dayOf(at), at, meal, foodId: food.id, name: food.name, grams, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat };
}

/** A quick protein entry, as the protein tap logs it: 4 kcal a gram, nothing else. */
export function proteinEntry(grams: number, at = Date.now()): FoodLogEntry {
  return { id: newId(), day: dayOf(at), at, meal: mealAt(at), foodId: null, name: "Protein", grams, kcal: grams * 4, protein: grams, carbs: 0, fat: 0 };
}

/** A glass (or bottle) of water: counted in the log so it is backed up with the rest of the day. */
export function waterEntry(ml: number, at = Date.now()): FoodLogEntry {
  return { id: newId(), day: dayOf(at), at, meal: mealAt(at), foodId: null, name: "Water", grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: ml };
}

export const isWater = (e: FoodLogEntry) => (e.waterMl ?? 0) > 0;

interface FoodLogState {
  entries: FoodLogEntry[];
  add: (entries: FoodLogEntry[]) => void;
  /** A logged food at a new weight: its numbers follow from the guide again. */
  setGrams: (id: string, grams: number, food: Food | undefined) => void;
  remove: (id: string) => void;
  /** Copies one day's entries to another (today), as new entries. */
  copyDay: (from: string, to: string, at?: number) => number;
}

/** Old days are kept for a year: enough for any trend, small enough for a backup. */
const KEEP_DAYS = 366;

function prune(entries: FoodLogEntry[], now = Date.now()): FoodLogEntry[] {
  const oldest = dayOf(now - KEEP_DAYS * 86_400_000);
  return entries.filter((e) => e.day >= oldest);
}

export const useFoodLog = create<FoodLogState>()((set, get) => ({
  entries: [],
  add: (entries) => set({ entries: prune([...get().entries, ...entries]) }),
  setGrams: (id, grams, food) =>
    set({
      entries: get().entries.map((e) => {
        if (e.id !== id) return e;
        if (food) {
          const n = nutrientsFor(food, grams);
          return { ...e, grams, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat };
        }
        // A quick entry scales with its own numbers.
        const k = e.grams > 0 ? grams / e.grams : 1;
        const r1 = (x: number) => Math.round(x * k * 10) / 10;
        return { ...e, grams, kcal: Math.round(e.kcal * k), protein: r1(e.protein), carbs: r1(e.carbs), fat: r1(e.fat) };
      }),
    }),
  remove: (id) => set({ entries: get().entries.filter((e) => e.id !== id) }),
  copyDay: (from, to, at = Date.now()) => {
    const copies = get()
      // Water is drunk again on its own; copying a day copies the food.
      .entries.filter((e) => e.day === from && !isWater(e))
      .map((e, i) => ({ ...e, id: newId(), day: to, at: at + i }));
    if (copies.length) get().add(copies);
    return copies.length;
  },
}));

/** Totals of the given entries. */
export function dayTotals(entries: FoodLogEntry[]): { kcal: number; protein: number; carbs: number; fat: number } {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) {
    t.kcal += e.kcal;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
  }
  return { kcal: Math.round(t.kcal), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat) };
}
