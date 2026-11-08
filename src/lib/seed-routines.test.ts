import { describe, expect, it } from "vitest";
import { ROUTINE_TEMPLATES, SPLITS, estimateMinutes, templateMuscles, templateToRoutine } from "./seed-routines";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";

describe("routine templates", () => {
  it("every exercise is a real seed exercise, so templates work offline with no catalog", () => {
    for (const t of ROUTINE_TEMPLATES) for (const e of t.exercises) expect(SEED_EXERCISES_BY_ID[e.exerciseId], `${t.id}: ${e.exerciseId}`).toBeDefined();
  });

  it("covers every split the owner listed, with the named variations", () => {
    const by = (split: string) => ROUTINE_TEMPLATES.filter((t) => t.split === split).map((t) => t.id);
    expect(by("ppl")).toEqual(["tpl-push-a", "tpl-push-b", "tpl-pull-a", "tpl-pull-b", "tpl-legs-a", "tpl-legs-b"]);
    expect(by("upper_lower")).toEqual(["tpl-upper", "tpl-lower"]);
    expect(by("full_body")).toEqual(["tpl-fb-1", "tpl-fb-2", "tpl-fb-3"]);
    expect(by("calisthenics")).toEqual(["tpl-cali-upper", "tpl-cali-lower"]);
    expect(by("core")).toEqual(["tpl-core"]);
    expect(by("specialized")).toEqual(["tpl-chest-tri", "tpl-back-bi", "tpl-shoulders-arms"]);
    expect(SPLITS.map((s) => s.label)).toEqual(["PPL", "Upper/Lower", "Full Body", "Calisthenics", "Core", "Specialized"]);
  });

  it("ids are unique and every template has sets and reps", () => {
    expect(new Set(ROUTINE_TEMPLATES.map((t) => t.id)).size).toBe(ROUTINE_TEMPLATES.length);
    for (const t of ROUTINE_TEMPLATES) {
      expect(t.exercises.length, t.id).toBeGreaterThanOrEqual(4);
      for (const e of t.exercises) {
        expect(e.sets, t.id).toBeGreaterThan(0);
        // Reps, or a hold time for timed exercises such as the plank.
        expect((e.reps ?? 0) > 0 || (e.holdSec ?? 0) > 0, `${t.id}: ${e.exerciseId}`).toBe(true);
      }
    }
  });

  it("estimates time from sets, rest and work: a five-exercise day lands near an hour", () => {
    const fb1 = ROUTINE_TEMPLATES.find((t) => t.id === "tpl-fb-1")!;
    const m = estimateMinutes(fb1);
    expect(m % 5).toBe(0);
    expect(m).toBeGreaterThanOrEqual(40);
    expect(m).toBeLessThanOrEqual(75);
  });

  it("lists the muscles a template trains, most-worked first", () => {
    const push = ROUTINE_TEMPLATES.find((t) => t.id === "tpl-push-a")!;
    expect(templateMuscles(push).slice(0, 3)).toEqual(["Chest", "Shoulders", "Triceps"]);
  });

  it("a copy for My Routines gets fresh ids, target reps and kept supersets", () => {
    const t = ROUTINE_TEMPLATES.find((x) => x.id === "tpl-shoulders-arms")!;
    const r1 = templateToRoutine(t, 1000);
    const r2 = templateToRoutine(t, 1000);
    expect(r1.id).not.toBe(r2.id);
    expect(r1.id.startsWith("tpl-")).toBe(false);
    expect(r1.name).toBe(t.name);
    expect(r1.exercises[0]!.sets[0]!.targetReps).toBe(t.exercises[0]!.reps);
    const core = templateToRoutine(ROUTINE_TEMPLATES.find((x) => x.id === "tpl-core")!, 1000);
    const plank = core.exercises.find((e) => e.exerciseId === "plank")!;
    expect(plank.sets[0]!.targetReps).toBeNull();
    expect(plank.notes).toBe("Hold 45 s each set");
    const ss = r1.exercises.filter((e) => e.supersetId);
    expect(ss).toHaveLength(2);
    expect(ss[0]!.supersetId).toBe(ss[1]!.supersetId);
  });
});
