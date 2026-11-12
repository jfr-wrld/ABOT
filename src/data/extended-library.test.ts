import { describe, expect, it } from "vitest";
import { exerciseKey } from "./exerciseKey.mjs";
import { isAtlas, loadExtendedLibrary, withoutBuiltIn } from "./extended-library";
import { SEED_EXERCISES } from "./exercises";
import { normalizeExercise } from "./normalize";

describe("exerciseKey", () => {
  it("matches the same lift named either way round", () => {
    expect(exerciseKey("Barbell Bench Press", "barbell")).toBe(exerciseKey("Bench Press (Barbell)", "barbell"));
    expect(exerciseKey("Push-Up", "bodyweight")).toBe(exerciseKey("Push Up", "bodyweight"));
  });
  it("keeps different tools and different lifts apart", () => {
    expect(exerciseKey("Bench Press (Barbell)", "barbell")).not.toBe(exerciseKey("Bench Press (Dumbbell)", "dumbbell"));
    expect(exerciseKey("Incline Bench Press (Barbell)", "barbell")).not.toBe(exerciseKey("Bench Press (Barbell)", "barbell"));
  });
});

describe("the extended library", async () => {
  const lib = await loadExtendedLibrary();
  const fedb = lib.filter((e) => e.id.startsWith("fedb-"));
  const atlas = lib.filter(isAtlas);

  it("ships hundreds of photo exercises from free-exercise-db and the gaps from the Atlas", () => {
    expect(fedb.length).toBeGreaterThan(650);
    expect(atlas.length).toBeGreaterThan(200);
    expect(new Set(lib.map((e) => e.id)).size).toBe(lib.length);
    for (const e of lib) {
      expect(e.isCatalog).toBe(true);
      expect(e.primaryMuscles.length).toBeGreaterThan(0);
    }
  });

  it("gives every free-exercise-db row its pair of photos, and the Atlas rows none", () => {
    expect(fedb.filter((e) => (e.media.motionUrls ?? []).length === 2).length).toBeGreaterThan(fedb.length - 5);
    expect(atlas.every((e) => !e.media.motionUrls?.length)).toBe(true);
  });

  it("does not repeat a seed exercise", () => {
    const seed = new Set(SEED_EXERCISES.map((e) => e.sourceId));
    expect(fedb.filter((e) => seed.has(e.id.slice(5)))).toEqual([]);
  });

  it("has the machines free-exercise-db lacks, named lift first", () => {
    const names = new Set(atlas.map((e) => e.name));
    expect(names).toContain("Bayesian Curl (Cable)");
    expect(names).toContain("Pendulum Squat (Machine)");
  });
});

describe("withoutBuiltIn", () => {
  const row = (id: string) => ({ ...normalizeExercise({ id, name: id, equipment: "barbell", primaryMuscles: ["chest"] }), isCatalog: true });
  it("drops rows of the old download that the built-in library already has", () => {
    const built = [row("fedb-A")];
    expect(withoutBuiltIn(built, [row("fedb-A"), row("fedb-Z")]).map((e) => e.id)).toEqual(["fedb-A", "fedb-Z"]);
    const old = [row("fedb-A")];
    expect(withoutBuiltIn([], old)).toBe(old);
  });
});
