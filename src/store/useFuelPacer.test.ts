import { beforeEach, describe, expect, it } from "vitest";
import { addProtein, addWater, migrateFuelTally } from "./useFuelPacer";
import { dayOf, isWater, useFoodLog } from "./useFoodLog";
import { parseBackup } from "@/data/backup";

beforeEach(() => useFoodLog.setState({ entries: [] }));

const memory = (v: string | null) => {
  let value = v;
  return { getItem: () => value, removeItem: () => void (value = null), get: () => value };
};

describe("protein and water live in the food log", () => {
  it("a protein tap is a food entry, so a logged meal and a tap add up once", () => {
    addProtein(25);
    const [e] = useFoodLog.getState().entries;
    expect(e).toMatchObject({ name: "Protein", protein: 25, kcal: 100, carbs: 0, fat: 0 });
  });

  it("water is an entry with no calories, kept out of copying a day", () => {
    addWater(500);
    const today = dayOf(Date.now());
    const [w] = useFoodLog.getState().entries;
    expect(isWater(w!)).toBe(true);
    expect(w).toMatchObject({ kcal: 0, waterMl: 500 });
    expect(useFoodLog.getState().copyDay(today, "2099-01-01")).toBe(0);
  });

  it("water survives a backup file", () => {
    addWater(750);
    const file = JSON.stringify({ app: "ABOT", schemaVersion: 1, exportedAt: "", data: { foodLog: useFoodLog.getState().entries } });
    const parsed = parseBackup(file);
    expect(parsed.ok && parsed.backup.data.foodLog?.[0]?.waterMl).toBe(750);
  });

  it("moves today's old per-device taps into the log once, and drops older days", () => {
    const today = memory(JSON.stringify({ day: dayOf(Date.now()), proteinG: 50, waterMl: 1000 }));
    migrateFuelTally(today);
    expect(today.get()).toBeNull();
    const e = useFoodLog.getState().entries;
    expect(e.reduce((n, x) => n + x.protein, 0)).toBe(50);
    expect(e.reduce((n, x) => n + (x.waterMl ?? 0), 0)).toBe(1000);

    useFoodLog.setState({ entries: [] });
    migrateFuelTally(memory(JSON.stringify({ day: "2020-01-01", proteinG: 50, waterMl: 1000 })));
    expect(useFoodLog.getState().entries).toEqual([]);
  });
});
