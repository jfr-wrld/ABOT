import { describe, expect, it } from "vitest";
import { filterExercises, matchScore } from "./exercise-search";
import { SEED_EXERCISES } from "@/data/exercises";
import { normalizeExercise } from "@/data/normalize";

const lib = SEED_EXERCISES;
const find = (q: string, f: Partial<Parameters<typeof filterExercises>[1]> = {}) => filterExercises(lib, { query: q, ...f }).map((e) => e.name);
const byName = (n: string) => lib.find((e) => e.name === n)!;

describe("exercise search", () => {
  it("reads gym short forms and partial words", () => {
    expect(find("db bench")).toContain("Bench Press (Dumbbell)");
    expect(find("db bench")).not.toContain("Bench Press (Barbell)");
    expect(find("lat pull")[0]).toMatch(/Lat Pulldown/);
    expect(find("ohp")).toContain("Overhead Press (Barbell)");
    expect(find("rdl")).toContain("Romanian Deadlift (Barbell)");
  });

  it("forgives one slip in a longer word, not in short ones", () => {
    expect(find("benhc")).toContain("Bench Press (Barbell)");
    expect(find("sqaut")).toContain("Squat (Barbell)");
    expect(find("rwo")).toEqual([]);
  });

  it("finds by muscle and tool in Indonesian", () => {
    const dada = find("dada");
    expect(dada).toContain("Bench Press (Barbell)");
    expect(dada.every((n) => byName(n).primaryMuscles.includes("chest") || byName(n).secondaryMuscles.includes("chest"))).toBe(true);
    expect(find("dumbel dada")).toContain("Bench Press (Dumbbell)");
    expect(find("betis")).toContain("Standing Calf Raise (Machine)");
  });

  it("puts a name that starts with the query before other matches, typos last", () => {
    expect(matchScore(byName("Bench Press (Barbell)"), "bench")).toBe(0);
    expect(matchScore(byName("Incline Bench Press (Barbell)"), "bench")).toBe(1);
    expect(matchScore(byName("Bench Press (Barbell)"), "benhc")).toBe(2);
    const order = find("bench");
    expect(order.indexOf("Bench Press (Barbell)")).toBeLessThan(order.indexOf("Incline Bench Press (Barbell)"));
  });

  it("ranks favourites, then the most used, within the same match", () => {
    const rows = ["Row A (Cable)", "Row B (Cable)", "Row C (Cable)"].map((name, i) =>
      normalizeExercise({ id: `r${i}`, name, equipment: "cable", primaryMuscles: ["back"] }),
    );
    const names = (rank: Parameters<typeof filterExercises>[2]) => filterExercises(rows, { query: "row" }, rank).map((e) => e.id);
    expect(names({})).toEqual(["r0", "r1", "r2"]);
    expect(names({ uses: { r2: 5, r1: 1 } })).toEqual(["r2", "r1", "r0"]);
    expect(names({ favorites: new Set(["r1"]), uses: { r2: 5 } })).toEqual(["r1", "r2", "r0"]);
  });

  it("filters by the muscle's area and by tool; no query keeps the list order", () => {
    const back = filterExercises(lib, { query: "", muscle: "back" });
    expect(back.length).toBeGreaterThan(5);
    expect(filterExercises(lib, { query: "", equipment: "cable" }).every((e) => e.equipment === "cable")).toBe(true);
    expect(filterExercises(lib, { query: "" })).toEqual(lib);
  });
});

describe("filterExercises with photos", () => {
  const photo = SEED_EXERCISES.find((e) => e.id === "bench-press-barbell")!;
  const atlas = { ...photo, id: "atlas-chest-press-machine", name: "Chest Press Machine", media: {} };
  const mine = { ...atlas, id: "custom-1", name: "My Chest Press", isCustom: true };
  const list = [atlas, photo, mine];

  it("browsing lists photos and the lifter's own exercises, plus the ids kept", () => {
    expect(filterExercises(list, { query: "", photos: {} }).map((e) => e.id)).toEqual(["bench-press-barbell", "custom-1"]);
    expect(filterExercises(list, { query: "", photos: { keep: new Set([atlas.id]) } })).toHaveLength(3);
  });

  it("a search finds the photoless ones too, after photos of equal match", () => {
    const found = filterExercises(list, { query: "chest press", photos: {} }).map((e) => e.id);
    expect(found).toContain("atlas-chest-press-machine");
    expect(filterExercises([atlas, { ...photo, name: "Chest Press Machine Photo" }], { query: "chest", photos: {} })[0]!.id).toBe("bench-press-barbell");
  });
});
