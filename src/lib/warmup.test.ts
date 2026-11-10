import { describe, expect, it } from "vitest";
import { warmsUp, warmupSets } from "./warmup";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";

const bench = SEED_EXERCISES_BY_ID["bench-press-barbell"]!;
const dbBench = SEED_EXERCISES_BY_ID["bench-press-dumbbell"]!;

describe("warm-up sets", () => {
  it("ramps a barbell lift from the empty bar, on plates the gym has", () => {
    expect(warmupSets(100, bench, { unit: "kg" })).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 40, reps: 5 },
      { weightKg: 60, reps: 3 },
      { weightKg: 80, reps: 2 },
    ]);
    // No 2.5 or 1.25 plates: 60% of 70 (42) loads as 40.
    const sets = warmupSets(70, bench, { unit: "kg", barKg: 20, platesKg: [20, 10, 5] });
    expect(sets.map((s) => s.weightKg)).toEqual([20, 40, 50]);
  });

  it("gives light equipment two sets and skips steps that collapse", () => {
    expect(warmupSets(30, dbBench, { unit: "kg" })).toEqual([
      { weightKg: 15, reps: 8 },
      { weightKg: 22.5, reps: 4 },
    ]);
    expect(warmupSets(25, bench, { unit: "kg" })).toEqual([]);
  });

  it("leaves isolation lifts alone", () => {
    const curl = Object.values(SEED_EXERCISES_BY_ID).find((e) => e.category === "isolation")!;
    expect(warmsUp(curl)).toBe(false);
    expect(warmsUp(bench)).toBe(true);
  });
});
