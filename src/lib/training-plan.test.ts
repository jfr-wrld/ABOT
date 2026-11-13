import { describe, expect, it } from "vitest";
import { SEED_EXERCISES, SEED_EXERCISES_BY_ID } from "@/data/exercises";
import type { Routine } from "@/types/workout";
import {
  adaptForPlace,
  buildPlan,
  defaultAnswers,
  defaultWeekdays,
  goalTweak,
  normalizePlan,
  orderWeekdays,
  PLACE_EQUIPMENT,
  planRoutinesToReplace,
  planSchedule,
  recommendSplit,
  splitDays,
  splitsFor,
  type PlanAnswers,
  type TrainingPlan,
} from "./training-plan";
import { ROUTINE_TEMPLATES, templateToRoutine } from "./seed-routines";

const answers = (p: Partial<PlanAnswers> = {}): PlanAnswers => ({ ...defaultAnswers(), ...p });

describe("training plan", () => {
  it("recommends a split by days and experience", () => {
    expect(recommendSplit(2, "some")).toBe("full_body");
    expect(recommendSplit(3, "experienced")).toBe("full_body");
    expect(recommendSplit(4, "some")).toBe("upper_lower");
    expect(recommendSplit(5, "some")).toBe("ppl_ul");
    expect(recommendSplit(6, "experienced")).toBe("ppl");
    expect(recommendSplit(5, "new")).toBe("upper_lower");
    expect(recommendSplit(5, "some", "bodyweight")).toBe("bodyweight");
    expect(splitsFor(5, "some", "gym")[0]).toBe("ppl_ul");
    expect(splitsFor(3, "some", "bodyweight")).toEqual(["bodyweight"]);
  });

  it("lays out the week: five days are push, pull, legs, upper, lower", () => {
    expect(splitDays("ppl_ul", 5)).toEqual(["tpl-push-a", "tpl-pull-a", "tpl-legs-a", "tpl-upper", "tpl-lower"]);
    expect(splitDays("upper_lower", 4)).toEqual(["tpl-upper", "tpl-lower", "tpl-upper", "tpl-lower"]);
    expect(splitDays("full_body", 2)).toEqual(["tpl-fb-1", "tpl-fb-2"]);
    expect(splitDays("ppl", 6)).toHaveLength(6);
  });

  it("spreads the training days and orders them by the week's first day", () => {
    expect(defaultWeekdays(3)).toEqual([1, 3, 5]);
    expect(defaultWeekdays(5)).toEqual([1, 2, 3, 4, 5]);
    expect(orderWeekdays([0, 5, 1], 1)).toEqual([1, 5, 0]);
    expect(orderWeekdays([0, 5, 1], 0)).toEqual([0, 1, 5]);
  });

  it("swaps out what home and bodyweight training lack", () => {
    for (const place of ["home", "bodyweight"] as const) {
      const allowed = PLACE_EQUIPMENT[place]!;
      // A bodyweight plan is built from the calisthenics days; home adapts every gym day.
      const days = new Set(splitDays(place === "bodyweight" ? "bodyweight" : "ppl", 6).concat(place === "home" ? splitDays("ppl_ul", 5).concat(splitDays("full_body", 3)) : []));
      for (const tpl of ROUTINE_TEMPLATES.filter((t) => days.has(t.id))) {
        const r = adaptForPlace(templateToRoutine(tpl), place, SEED_EXERCISES);
        const ids = r.exercises.map((e) => e.exerciseId);
        expect(new Set(ids).size, `${tpl.id} has no duplicate`).toBe(ids.length);
        expect(r.exercises.length, tpl.id).toBeGreaterThanOrEqual(3);
        for (const id of ids) expect(allowed, `${tpl.id}: ${id}`).toContain(SEED_EXERCISES_BY_ID[id]!.equipment);
      }
    }
    const upper = adaptForPlace(templateToRoutine(ROUTINE_TEMPLATES.find((t) => t.id === "tpl-upper")!), "home");
    expect(upper.exercises.map((e) => SEED_EXERCISES_BY_ID[e.exerciseId]!.equipment)).not.toContain("barbell");
  });

  it("tunes the first lift for strength and the rest for fat loss", () => {
    const r: Routine = templateToRoutine(ROUTINE_TEMPLATES.find((t) => t.id === "tpl-fb-1")!);
    const strong = goalTweak(r, "strength");
    expect(strong.exercises[0]!.sets.every((s) => s.targetReps === null || s.targetReps <= 5)).toBe(true);
    expect(strong.exercises[0]!.restSeconds).toBeGreaterThanOrEqual(180);
    const lean = goalTweak(r, "fat_loss");
    expect(lean.exercises.every((e, i) => e.restSeconds <= r.exercises[i]!.restSeconds)).toBe(true);
    expect(goalTweak(r, "muscle")).toBe(r);
  });

  it("builds one routine per distinct day and a schedule that names them", () => {
    const a = answers({ days: 4, weekdays: [1, 2, 4, 5], split: "upper_lower", time: "06:30" });
    const built = buildPlan(a);
    expect(built.routines.map((r) => r.templateId)).toEqual(["tpl-upper", "tpl-lower"]);
    expect(built.assignment).toEqual({ 1: "tpl-upper", 2: "tpl-lower", 4: "tpl-upper", 5: "tpl-lower" });
    const ids = { "tpl-upper": "U", "tpl-lower": "L" };
    const s = planSchedule(a, built.assignment, ids, true);
    expect(s.enabled).toBe(true);
    expect(s.time).toBe("06:30");
    expect(s.days[1]).toEqual({ on: true, routineId: "U" });
    expect(s.days[5]).toEqual({ on: true, routineId: "L" });
    expect(s.days[3]).toEqual({ on: false, routineId: null });
    expect(s.days[0]).toEqual({ on: false, routineId: null });
  });

  it("replaces only the plan routines the lifter has not edited", () => {
    const plan: TrainingPlan = { ...answers(), routineIds: { a: "r1", b: "r2", c: "gone" }, routineStamps: { r1: 10, r2: 10, gone: 10 }, createdAt: 1 };
    const routine = (id: string, updatedAt: number): Routine => ({ id, name: id, exercises: [], createdAt: 1, updatedAt });
    expect(planRoutinesToReplace(plan, [routine("r1", 10), routine("r2", 99), routine("x", 10)])).toEqual({ replace: ["r1"], kept: ["r2"] });
    expect(planRoutinesToReplace(null, [])).toEqual({ replace: [], kept: [] });
  });

  it("reads a stored plan defensively", () => {
    expect(normalizePlan(null)).toBeNull();
    expect(normalizePlan({ goal: "x" })).toBeNull();
    const ok = normalizePlan({ ...answers({ days: 3 }), routineIds: { a: "r", b: 3 }, routineStamps: { r: 5, q: "no" }, createdAt: 2 });
    expect(ok?.routineIds).toEqual({ a: "r" });
    expect(ok?.routineStamps).toEqual({ r: 5 });
  });
});
