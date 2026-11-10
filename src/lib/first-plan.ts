import { ROUTINE_TEMPLATES, type RoutineTemplate } from "./seed-routines";

export type Goal = "muscle" | "strength" | "fat_loss" | "fitness";
export type Level = "new" | "some" | "experienced";
export type Days = 2 | 3 | 4 | 5;

/**
 * The first workout for a new lifter, from three answers. Two or three days a week (or a lifter
 * who is new and wants to lose fat) start with a full-body day: every muscle each session, the
 * usual advice for beginners and low frequency. Four days make an upper/lower split; five or
 * more a push/pull/legs split for anyone past their first months. All are Template Vault days
 * (lib/seed-routines), so the lifter can save, edit or swap them later.
 */
export function firstTemplate(a: { goal: Goal; level: Level; days: Days }): RoutineTemplate {
  const id =
    a.days <= 3 || (a.level === "new" && a.goal === "fat_loss")
      ? "tpl-fb-1"
      : a.days === 4 || a.level === "new"
        ? "tpl-upper"
        : "tpl-push-a";
  return ROUTINE_TEMPLATES.find((t) => t.id === id) ?? ROUTINE_TEMPLATES[0]!;
}
