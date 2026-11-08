import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "./exercises";
import type { MuscleGroup } from "@/types/workout";

const ORIGINAL_IDS = [
  "bench-press-barbell", "bench-press-dumbbell", "incline-bench-press-barbell", "incline-bench-press-dumbbell",
  "chest-press-machine", "cable-fly", "push-up", "chest-dip", "deadlift-barbell", "pull-up", "lat-pulldown-cable",
  "bent-over-row-barbell", "seated-row-cable", "one-arm-row-dumbbell", "t-bar-row", "overhead-press-barbell",
  "shoulder-press-dumbbell", "lateral-raise-dumbbell", "face-pull-cable", "rear-delt-fly-machine",
  "bicep-curl-barbell", "bicep-curl-dumbbell", "hammer-curl-dumbbell", "preacher-curl-machine",
  "triceps-pushdown-cable", "skullcrusher-barbell", "overhead-triceps-extension-dumbbell", "triceps-dip",
  "squat-barbell", "front-squat-barbell", "leg-press-machine", "leg-extension-machine", "bulgarian-split-squat",
  "romanian-deadlift-barbell", "leg-curl-machine", "hip-thrust-barbell", "walking-lunge-dumbbell",
  "standing-calf-raise-machine", "seated-calf-raise-machine", "plank", "hanging-leg-raise", "cable-crunch",
  "shrug-barbell", "kettlebell-swing",
];

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

describe("seed exercise library", () => {
  it("has at least 70 exercises with unique ids", () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(70);
    expect(new Set(SEED_EXERCISES.map((e) => e.id)).size).toBe(SEED_EXERCISES.length);
  });

  it("keeps every original id so logged history still resolves", () => {
    const ids = new Set(SEED_EXERCISES.map((e) => e.id));
    for (const id of ORIGINAL_IDS) expect(ids.has(id), id).toBe(true);
  });

  it("links every exercise to its free-exercise-db start and end frames", () => {
    for (const e of SEED_EXERCISES) {
      expect(e.sourceId, e.id).toBeTruthy();
      expect(e.media.motionUrls, e.id).toEqual([`${IMAGE_BASE}${e.sourceId}/0.jpg`, `${IMAGE_BASE}${e.sourceId}/1.jpg`]);
    }
  });

  it("gives every exercise at least 3 instruction steps and 2 form cues", () => {
    for (const e of SEED_EXERCISES) {
      expect(e.instructions.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.formCues.length, e.id).toBeGreaterThanOrEqual(2);
      for (const line of [...e.instructions, ...e.formCues]) expect(line, e.id).not.toMatch(/—/);
    }
  });

  it("covers every major muscle group as a primary muscle", () => {
    const covered = new Set(SEED_EXERCISES.flatMap((e) => e.primaryMuscles));
    const required: MuscleGroup[] = [
      "chest", "back", "lats", "traps", "shoulders", "biceps", "triceps", "forearms",
      "quads", "hamstrings", "glutes", "calves", "abs", "lower_back",
    ];
    for (const m of required) expect(covered.has(m), m).toBe(true);
  });

  it("ships no video ids (none could be verified); the UI offers a search instead", () => {
    for (const e of SEED_EXERCISES) {
      expect(e.media.youtubeId, e.id).toBeUndefined();
      expect(e.media.tiktokUrl, e.id).toBeUndefined();
    }
  });
});
