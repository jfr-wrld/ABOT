import { describe, expect, it } from "vitest";
import { exerciseKey } from "./exerciseKey.mjs";
import { isAtlas, loadAtlas, mergeCatalogs } from "./atlas";
import { SEED_EXERCISES } from "./exercises";
import { normalizeExercise } from "./normalize";

describe("exerciseKey", () => {
  it("matches the same lift named either way round", () => {
    expect(exerciseKey("Barbell Bench Press", "barbell")).toBe(exerciseKey("Bench Press (Barbell)", "barbell"));
    expect(exerciseKey("Push-Up", "bodyweight")).toBe(exerciseKey("Push Up", "bodyweight"));
    expect(exerciseKey("Dumbbell Biceps Curls", "dumbbell")).toBe(exerciseKey("Bicep Curl (Dumbbell)", "dumbbell"));
  });
  it("keeps different tools and different lifts apart", () => {
    expect(exerciseKey("Bench Press (Barbell)", "barbell")).not.toBe(exerciseKey("Bench Press (Dumbbell)", "dumbbell"));
    expect(exerciseKey("Incline Bench Press (Barbell)", "barbell")).not.toBe(exerciseKey("Bench Press (Barbell)", "barbell"));
  });
});

describe("the extended library (Open Exercise Atlas)", async () => {
  const atlas = await loadAtlas();
  const seedKeys = new Set(SEED_EXERCISES.map((e) => exerciseKey(e.name, e.equipment)));

  it("adds hundreds of exercises, each a catalog row with an atlas id and a muscle", () => {
    expect(atlas.length).toBeGreaterThan(350);
    expect(new Set(atlas.map((e) => e.id)).size).toBe(atlas.length);
    for (const e of atlas) {
      expect(isAtlas(e)).toBe(true);
      expect(e.isCatalog).toBe(true);
      expect(e.primaryMuscles.length).toBeGreaterThan(0);
    }
  });

  it("does not repeat a seed exercise", () => {
    expect(atlas.filter((e) => seedKeys.has(exerciseKey(e.name, e.equipment))).map((e) => e.name)).toEqual([]);
  });

  it("names a lift first and its tool in brackets, and logs cardio by distance and time", () => {
    const names = new Set(atlas.map((e) => e.name));
    expect(names).toContain("Bayesian Curl (Cable)");
    expect(names).toContain("Assisted Pull-Up (Machine)");
    expect(names).toContain("Treadmill Running");
    expect(atlas.find((e) => e.name === "Treadmill Running")!.logType).toBe("distance_duration");
    expect(atlas.find((e) => e.name === "Assisted Pull-Up (Machine)")!.isMachineDependent).toBe(true);
  });

  it("links every illustration to the pinned Atlas commit", () => {
    for (const e of atlas) for (const u of e.media.motionUrls ?? []) expect(u).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yagizerentunay\/open-exercise-atlas\/[0-9a-f]{40}\/media\//);
  });
});

describe("mergeCatalogs", () => {
  const row = (id: string, name: string, equipment: "barbell" | "cable") => ({ ...normalizeExercise({ id, name, equipment, primaryMuscles: ["chest"] }), isCatalog: true });
  it("drops a downloaded copy of an Atlas exercise and keeps the rest", () => {
    const atlas = [row("atlas-cable-fly-low", "Low to High Fly (Cable)", "cable")];
    const fedb = [row("fedb-Low_Cable_Fly", "Cable Low To High Fly", "cable"), row("fedb-Zercher", "Zercher Squats", "barbell")];
    expect(mergeCatalogs(atlas, fedb).map((e) => e.id)).toEqual(["atlas-cable-fly-low", "fedb-Zercher"]);
    expect(mergeCatalogs([], fedb)).toBe(fedb);
  });
});
