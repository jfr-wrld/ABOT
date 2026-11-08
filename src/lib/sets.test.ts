import { describe, expect, it } from "vitest";
import { buildExerciseIndex, setNumbers } from "./sets";
import type { Exercise, SetType } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const t = (...types: SetType[]) => types.map((type) => ({ type }));

describe("setNumbers", () => {
  it("skips warm-ups and counts every other type in order", () => {
    expect(setNumbers(t("warmup", "normal", "normal", "dropset", "failure"))).toEqual([null, 1, 2, 3, 4]);
  });
  it("handles an empty list", () => {
    expect(setNumbers([])).toEqual([]);
  });
  it("numbers from 1 even when warm-ups come between", () => {
    expect(setNumbers(t("normal", "warmup", "normal"))).toEqual([1, null, 2]);
  });
});

describe("buildExerciseIndex", () => {
  it("contains every seed exercise sorted by name", () => {
    const { list, byId } = buildExerciseIndex([]);
    expect(list).toHaveLength(SEED_EXERCISES.length);
    expect(Object.keys(byId)).toHaveLength(SEED_EXERCISES.length);
    const names = list.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("includes custom exercises in both list and lookup", () => {
    const custom: Exercise = {
      id: "custom-1",
      name: "Pendlay Row",
      primaryMuscles: ["back"],
      category: "compound",
      instructions: [],
      formCues: [],
      media: {},
      secondaryMuscles: [],
      equipment: "barbell",
      isCustom: true,
      loadMode: "total",
      logType: "weight_reps",
      isMachineDependent: false,
    };
    const { list, byId } = buildExerciseIndex([custom]);
    expect(list).toHaveLength(SEED_EXERCISES.length + 1);
    expect(byId["custom-1"]).toBe(custom);
  });
});

describe("buildExerciseIndex with the catalog", () => {
  const cat = (id: string, name: string): Exercise => ({
    ...SEED_EXERCISES[0]!,
    id,
    name,
    sourceId: id.replace("fedb-", ""),
    isCatalog: true,
  });
  it("adds catalog entries after seeds and owned ones, owned copies win", () => {
    const a = cat("fedb-Zercher_Squats", "Zercher Squats");
    const b = cat("fedb-Bicycling", "Bicycling");
    const ownedB = { ...b, name: "Bicycling (mine)" };
    const { list, byId } = buildExerciseIndex([ownedB], [a, b]);
    expect(list).toHaveLength(SEED_EXERCISES.length + 2);
    expect(byId["fedb-Bicycling"]!.name).toBe("Bicycling (mine)");
    expect(byId["fedb-Zercher_Squats"]).toBe(a);
  });
});
