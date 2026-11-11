import { beforeEach, describe, expect, it } from "vitest";
import { dayOf, dayTotals, entryFor, useFoodLog } from "./useFoodLog";
import { FOODS } from "@/lib/nutrition-guide";
import { parseBackup } from "@/data/backup";

const tempeh = FOODS.find((f) => f.id === "tempeh")!;
const rice = FOODS.find((f) => f.id === "white-rice")!;

beforeEach(() => useFoodLog.setState({ entries: [] }));

describe("food log", () => {
  it("logs foods with their numbers and totals a day", () => {
    const at = new Date(2026, 10, 11, 12).getTime();
    useFoodLog.getState().add([entryFor(tempeh, 100, "lunch", at), entryFor(rice, 200, "lunch", at)]);
    const day = useFoodLog.getState().entries.filter((e) => e.day === dayOf(at));
    expect(dayTotals(day)).toEqual({ kcal: 561, protein: 27, carbs: 93, fat: 9 });
  });

  it("changes a portion, copies a day and removes an entry", () => {
    const yesterday = new Date(2026, 10, 10, 8).getTime();
    useFoodLog.getState().add([entryFor(tempeh, 100, "breakfast", yesterday)]);
    const id = useFoodLog.getState().entries[0]!.id;
    useFoodLog.getState().setGrams(id, 50, tempeh);
    expect(useFoodLog.getState().entries[0]).toMatchObject({ grams: 50, kcal: 101 });
    expect(useFoodLog.getState().copyDay("2026-11-10", "2026-11-11")).toBe(1);
    expect(useFoodLog.getState().entries.map((e) => e.day)).toEqual(["2026-11-10", "2026-11-11"]);
    useFoodLog.getState().remove(id);
    expect(useFoodLog.getState().entries).toHaveLength(1);
  });

  it("survives a backup and drops rows that make no sense", () => {
    const file = JSON.stringify({
      app: "ABOT",
      schemaVersion: 1,
      data: {
        sessions: [],
        routines: [],
        exercises: [],
        locations: [],
        foodLog: [
          { id: "a", day: "2026-11-11", at: 1, meal: "lunch", foodId: "tempeh", name: "Tempeh", grams: 100, kcal: 201, protein: 20.8, carbs: 13.5, fat: 8.8 },
          { id: "b", day: "yesterday", grams: 100, kcal: 1, protein: 1, carbs: 1, fat: 1 },
          { id: "c", day: "2026-11-11", grams: -5, kcal: 1, protein: 1, carbs: 1, fat: 1 },
        ],
      },
    });
    const parsed = parseBackup(file);
    expect(parsed.ok && parsed.backup.data.foodLog?.map((e) => e.id)).toEqual(["a"]);
  });
});
