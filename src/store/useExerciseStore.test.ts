import { beforeEach, describe, expect, it } from "vitest";
import { useExerciseStore } from "./useExerciseStore";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise } from "@/types/workout";

const initial = useExerciseStore.getState();
beforeEach(() => useExerciseStore.setState(initial, true));

const cat: Exercise = { ...SEED_EXERCISES[0]!, id: "fedb-Zercher_Squats", name: "Zercher Squats", isCatalog: true };

describe("adopt", () => {
  it("copies a catalog exercise into the owned list once", () => {
    useExerciseStore.getState().setCatalog([cat]);
    useExerciseStore.getState().adopt(cat);
    useExerciseStore.getState().adopt(cat);
    expect(useExerciseStore.getState().custom.map((e) => e.id)).toEqual([cat.id]);
    expect(useExerciseStore.getState().custom[0]!.isCatalog).toBe(true);
  });
  it("ignores seed and custom exercises", () => {
    useExerciseStore.getState().adopt(SEED_EXERCISES[0]!);
    expect(useExerciseStore.getState().custom).toEqual([]);
  });
});
