import { describe, expect, it } from "vitest";
import { defaultLoadMode, normalizeExercise, normalizeRoutine, normalizeSession, DEFAULT_PLATES_KG } from "./normalize";
import { SEED_EXERCISES } from "./exercises";

describe("defaultLoadMode", () => {
  it("treats two-hand dumbbell work as per hand", () => {
    expect(defaultLoadMode("dumbbell", "Bench Press (Dumbbell)")).toBe("per_hand");
  });
  it("treats one-arm and split-stance work as unilateral", () => {
    expect(defaultLoadMode("dumbbell", "One Arm Row (Dumbbell)")).toBe("unilateral");
    expect(defaultLoadMode("dumbbell", "Bulgarian Split Squat")).toBe("unilateral");
  });
  it("treats barbell work as total", () => {
    expect(defaultLoadMode("barbell", "Squat (Barbell)")).toBe("total");
  });
});

describe("normalizeExercise", () => {
  it("derives machine dependence from equipment", () => {
    const base = { id: "x", name: "X", primaryMuscle: "back" as const, secondaryMuscles: [] };
    expect(normalizeExercise({ ...base, equipment: "machine" }).isMachineDependent).toBe(true);
    expect(normalizeExercise({ ...base, equipment: "cable" }).isMachineDependent).toBe(true);
    expect(normalizeExercise({ ...base, equipment: "barbell" }).isMachineDependent).toBe(false);
  });
  it("derives log type from bodyweight and plank", () => {
    const base = { primaryMuscle: "abs" as const, secondaryMuscles: [], equipment: "bodyweight" as const, isBodyweight: true };
    expect(normalizeExercise({ ...base, id: "push-up", name: "Push Up" }).logType).toBe("reps_only");
    expect(normalizeExercise({ ...base, id: "plank", name: "Plank" }).logType).toBe("duration");
    expect(
      normalizeExercise({ id: "b", name: "Bench", primaryMuscle: "chest", equipment: "barbell" }).logType,
    ).toBe("weight_reps");
  });
  it("keeps explicit values over derived defaults", () => {
    const e = normalizeExercise({
      id: "x",
      name: "X",
      primaryMuscle: "back",
      equipment: "machine",
      isMachineDependent: false,
      loadMode: "unilateral",
    });
    expect(e.isMachineDependent).toBe(false);
    expect(e.loadMode).toBe("unilateral");
    expect(e.secondaryMuscles).toEqual([]);
  });
  it("seed exercises are all normalized with stable ids", () => {
    expect(SEED_EXERCISES).toHaveLength(81);
    for (const e of SEED_EXERCISES) {
      expect(e.loadMode).toBeDefined();
      expect(e.logType).toBeDefined();
      expect(typeof e.isMachineDependent).toBe("boolean");
    }
    expect(SEED_EXERCISES.find((e) => e.id === "bench-press-dumbbell")!.loadMode).toBe("per_hand");
    expect(SEED_EXERCISES.find((e) => e.id === "lat-pulldown-cable")!.isMachineDependent).toBe(true);
  });
});

describe("normalizeSession", () => {
  const legacy = {
    id: "s1",
    name: "Old",
    startedAt: 1000,
    finishedAt: 2000,
    status: "completed",
    exercises: [
      {
        id: "e1",
        exerciseId: "squat-barbell",
        restSeconds: 90,
        sets: [
          { id: "a", type: "normal", weightKg: 100, reps: 5, rpe: null, completed: true },
          { id: "b", type: "normal", weightKg: 100, reps: "five", rpe: null, completed: true },
        ],
      },
    ],
  };
  it("keeps a legacy session and drops sets with non-numeric reps", () => {
    const s = normalizeSession(legacy)!;
    expect(s.id).toBe("s1");
    expect(s.exercises[0]!.sets.map((x) => x.id)).toEqual(["a"]);
    expect(s.locationId).toBeUndefined();
  });
  it("rejects rows without id or startedAt", () => {
    expect(normalizeSession({ ...legacy, id: undefined })).toBeNull();
    expect(normalizeSession({ ...legacy, startedAt: "yesterday" })).toBeNull();
    expect(normalizeSession(null)).toBeNull();
    expect(normalizeSession("x")).toBeNull();
  });
  it("defaults an unknown set type to normal and an unknown status to completed", () => {
    const s = normalizeSession({
      ...legacy,
      status: "weird",
      exercises: [{ ...legacy.exercises[0], sets: [{ ...legacy.exercises[0]!.sets[0], type: "zzz" }] }],
    })!;
    expect(s.status).toBe("completed");
    expect(s.exercises[0]!.sets[0]!.type).toBe("normal");
  });
});

describe("normalizeRoutine", () => {
  it("keeps a valid routine and rejects junk", () => {
    const r = normalizeRoutine({
      id: "r1",
      name: "Push",
      exercises: [{ id: "x", exerciseId: "bench-press-barbell", restSeconds: 90, sets: [{ id: "s", type: "normal", targetWeightKg: 60, targetReps: 8 }] }],
      createdAt: 1,
      updatedAt: 2,
    })!;
    expect(r.exercises[0]!.sets[0]!.targetReps).toBe(8);
    expect(normalizeRoutine({ name: "no id" })).toBeNull();
  });
});

describe("DEFAULT_PLATES_KG", () => {
  it("is the standard plate set, heaviest first", () => {
    expect(DEFAULT_PLATES_KG).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
  });
});

import { normalizeStoredExercise } from "./normalize";

describe("exercise model v2 (Task 18)", () => {
  it("turns a legacy single primaryMuscle into primaryMuscles", () => {
    const e = normalizeStoredExercise({ id: "c1", name: "Old", primaryMuscle: "chest", equipment: "barbell", secondaryMuscles: [] })!;
    expect(e.primaryMuscles).toEqual(["chest"]);
    expect("primaryMuscle" in e).toBe(false);
  });
  it("fills category, instructions, form cues and media defaults", () => {
    const e = normalizeExercise({ id: "x", name: "X", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: "barbell" });
    expect(e.category).toBe("compound");
    expect(e.instructions).toEqual([]);
    expect(e.formCues).toEqual([]);
    expect(e.media).toEqual({});
    const iso = normalizeExercise({ id: "y", name: "Y", primaryMuscles: ["biceps"], equipment: "dumbbell" });
    expect(iso.category).toBe("isolation");
  });
  it("smith machine is accepted and keeps records per gym", () => {
    const e = normalizeExercise({ id: "s", name: "Smith Squat", primaryMuscles: ["quads"], equipment: "smith_machine" });
    expect(e.isMachineDependent).toBe(true);
    expect(e.loadMode).toBe("total");
  });
  it("stored exercises from a file are validated, not trusted", () => {
    const e = normalizeStoredExercise({
      id: "c2",
      name: "Edited",
      primaryMuscles: ["chest", "wings"],
      secondaryMuscles: "triceps",
      equipment: "barbell",
      formCues: ["Keep elbows at 45 degrees", 7],
      media: { youtubeId: 5, customVideoUrl: "https://example.com/a.mp4" },
    })!;
    expect(e.primaryMuscles).toEqual(["chest"]);
    expect(e.secondaryMuscles).toEqual([]);
    expect(e.formCues).toEqual(["Keep elbows at 45 degrees"]);
    expect(e.media).toEqual({ customVideoUrl: "https://example.com/a.mp4" });
    expect(e.isCustom).toBe(true);
    expect(normalizeStoredExercise({ id: "c3", name: "No muscles", primaryMuscles: ["wings"], equipment: "barbell" })).toBeNull();
    expect(normalizeStoredExercise({ id: "c4", name: "Bad equipment", primaryMuscles: ["chest"], equipment: "rocket" })).toBeNull();
  });
  it("new muscle groups exist", () => {
    for (const m of ["lats", "adductors", "abductors", "neck"] as const) {
      expect(normalizeExercise({ id: m, name: m, primaryMuscles: [m], equipment: "machine" }).primaryMuscles).toEqual([m]);
    }
  });
});

describe("adopted catalog exercises", () => {
  it("keep their catalog flag instead of becoming custom", () => {
    const e = normalizeStoredExercise({ id: "fedb-X", name: "X", primaryMuscles: ["chest"], equipment: "barbell", isCatalog: true })!;
    expect(e.isCatalog).toBe(true);
    expect(e.isCustom).toBeUndefined();
  });
});
