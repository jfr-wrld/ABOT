import { describe, expect, it } from "vitest";
import { exerciseBucket, routineFocus, trainingFocus } from "./training-focus";
import { ROUTINE_TEMPLATES, templateToRoutine } from "./seed-routines";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { SEED_EXERCISES, SEED_EXERCISES_BY_ID } from "@/data/exercises";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
let n = 0;
const session = (lifts: [string, number][]): WorkoutSession => ({
  id: `w${n++}`,
  name: "W",
  startedAt: 0,
  status: "completed",
  exercises: lifts.map(([exerciseId, sets]) => ({
    id: `e${n++}`,
    exerciseId,
    restSeconds: 90,
    sets: Array.from({ length: sets }, () => ({ id: `s${n++}`, type: "normal" as const, weightKg: 50, reps: 8, rpe: null, completed: true })),
  })),
});

describe("trainingFocus", () => {
  it("names a push, pull or legs day by where the sets went", () => {
    expect(trainingFocus([session([["bench-press-barbell", 4], ["overhead-press-barbell", 3], ["triceps-rope-pushdown-cable", 3]])], byId)).toMatchObject({ label: "Push", muscle: "chest" });
    expect(trainingFocus([session([["bent-over-row-barbell", 4], ["lat-pulldown-cable", 3], ["bicep-curl-dumbbell", 3]])], byId)?.label).toBe("Pull");
    expect(trainingFocus([session([["squat-barbell", 4], ["leg-curl-machine", 3], ["standing-calf-raise-machine", 3]])], byId)).toMatchObject({ label: "Legs", muscle: "quads" });
  });

  it("calls a mixed upper day Upper and a mix of everything Full body", () => {
    expect(trainingFocus([session([["bench-press-barbell", 3], ["bent-over-row-barbell", 3]])], byId)?.label).toBe("Upper");
    expect(trainingFocus([session([["bench-press-barbell", 2], ["bent-over-row-barbell", 2], ["squat-barbell", 2]])], byId)?.label).toBe("Full body");
  });

  it("ignores warm-ups and sets not done, and returns null for an empty day", () => {
    const s = session([["bench-press-barbell", 2]]);
    s.exercises[0]!.sets[0]!.type = "warmup";
    s.exercises[0]!.sets[1]!.completed = false;
    expect(trainingFocus([s], byId)).toBeNull();
    expect(trainingFocus([], byId)).toBeNull();
  });
});

describe("exerciseBucket", () => {
  it("files an exercise under its first primary muscle", () => {
    expect(exerciseBucket(byId["bench-press-barbell"]!)).toBe("push");
    expect(exerciseBucket(byId["squat-barbell"]!)).toBe("legs");
  });
});

describe("routine focus", () => {
  it("reads a routine's planned sets: push for a push day, legs for a leg day", () => {
    const tpl = (id: string) => templateToRoutine(ROUTINE_TEMPLATES.find((t) => t.id === id)!);
    expect(routineFocus(tpl("tpl-push-a"), SEED_EXERCISES_BY_ID)?.label).toBe("Push");
    expect(routineFocus(tpl("tpl-legs-a"), SEED_EXERCISES_BY_ID)?.label).toBe("Legs");
    expect(routineFocus(tpl("tpl-upper"), SEED_EXERCISES_BY_ID)?.label).toBe("Upper");
    expect(routineFocus({ ...tpl("tpl-upper"), exercises: [] }, SEED_EXERCISES_BY_ID)).toBeNull();
  });
});
