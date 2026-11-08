import { describe, expect, it } from "vitest";
import { ROUTINE_TEMPLATES, TEMPLATE_PROGRAMS, hasTemplate, templateExercises, templateSetCount } from "./routine-templates";
import { SEED_EXERCISES_BY_ID } from "./exercises";

describe("routine templates", () => {
  it("use only exercises from the seed library, logged by weight or reps", () => {
    for (const t of ROUTINE_TEMPLATES)
      for (const e of t.exercises) {
        const def = SEED_EXERCISES_BY_ID[e.exerciseId];
        expect(def, `${t.id}: ${e.exerciseId}`).toBeDefined();
        expect(["weight_reps", "reps_only"]).toContain(def.logType);
      }
  });

  it("belong to a listed program and have unique ids", () => {
    const programs = new Set(TEMPLATE_PROGRAMS.map((p) => p.name));
    expect(ROUTINE_TEMPLATES.every((t) => programs.has(t.program))).toBe(true);
    expect(new Set(ROUTINE_TEMPLATES.map((t) => t.id)).size).toBe(ROUTINE_TEMPLATES.length);
  });

  it("become routine exercises with target reps and no weight", () => {
    const push = ROUTINE_TEMPLATES.find((t) => t.id === "ppl-push")!;
    const ex = templateExercises(push);
    expect(ex).toHaveLength(push.exercises.length);
    expect(ex[0].sets).toHaveLength(4);
    expect(ex[0].sets.every((s) => s.targetReps === 6 && s.targetWeightKg === null && s.type === "normal")).toBe(true);
    expect(new Set(ex.flatMap((e) => e.sets.map((s) => s.id))).size).toBe(templateSetCount(push));
  });

  it("knows when a template is already in the user's routines", () => {
    const push = ROUTINE_TEMPLATES[0];
    const routine = { id: "r", name: push.name, folder: push.program, exercises: [], createdAt: 0, updatedAt: 0 };
    expect(hasTemplate([routine], push)).toBe(true);
    expect(hasTemplate([{ ...routine, folder: undefined }], push)).toBe(false);
  });
});
