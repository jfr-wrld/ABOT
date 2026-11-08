import { describe, expect, it } from "vitest";
import { buildExerciseIndex, setNumbers } from "./sets";
import type { Exercise, SetType } from "@/types/workout";

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
  it("contains the 44 seed exercises sorted by name", () => {
    const { list, byId } = buildExerciseIndex([]);
    expect(list).toHaveLength(44);
    expect(Object.keys(byId)).toHaveLength(44);
    const names = list.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("includes custom exercises in both list and lookup", () => {
    const custom: Exercise = {
      id: "custom-1",
      name: "Pendlay Row",
      primaryMuscle: "back",
      secondaryMuscles: [],
      equipment: "barbell",
      isCustom: true,
    };
    const { list, byId } = buildExerciseIndex([custom]);
    expect(list).toHaveLength(45);
    expect(byId["custom-1"]).toBe(custom);
  });
});
