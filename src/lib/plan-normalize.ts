import type { Goal, Level } from "@/lib/first-plan";
import type { Weekday } from "@/lib/notifications/schedule";
import type { Place, PlanDays, PlanSplit, TrainingPlan } from "./training-plan";

/*
 * Apart from training-plan.ts, which builds plans from the exercise catalogue: backups only
 * check a stored plan, and importing the builder pulled about 180 KB of catalogue into Settings.
 * Keep the lists here in step with SPLIT_LABEL and PLAN_DAYS there (training-plan.test.ts checks).
 */

/** A stored plan, checked field by field (backups and sync can hand over anything). */
export function normalizePlan(raw: unknown): TrainingPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const goals: Goal[] = ["muscle", "strength", "fat_loss", "fitness"];
  const levels: Level[] = ["new", "some", "experienced"];
  const places: Place[] = ["gym", "home", "bodyweight"];
  const splits: PlanSplit[] = ["full_body", "upper_lower", "ppl_ul", "ppl", "bodyweight"];
  if (!goals.includes(p.goal as Goal) || !levels.includes(p.level as Level) || !places.includes(p.place as Place) || !splits.includes(p.split as PlanSplit)) return null;
  if (![2, 3, 4, 5, 6].includes(p.days as PlanDays)) return null;
  const weekdays = Array.isArray(p.weekdays) ? [...new Set(p.weekdays.filter((d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  if (weekdays.length === 0) return null;
  const time = typeof p.time === "string" && /^\d{1,2}:\d{2}$/.test(p.time) ? p.time : "17:30";
  const strMap = (v: unknown) =>
    v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k, x]) => typeof k === "string" && typeof x === "string").slice(0, 12)) as Record<string, string> : {};
  const numMap = (v: unknown) =>
    v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "number" && Number.isFinite(x)).slice(0, 12)) as Record<string, number> : {};
  return {
    goal: p.goal as Goal,
    level: p.level as Level,
    days: p.days as PlanDays,
    weekdays,
    place: p.place as Place,
    split: p.split as PlanSplit,
    time,
    routineIds: strMap(p.routineIds),
    routineStamps: numMap(p.routineStamps),
    createdAt: typeof p.createdAt === "number" ? p.createdAt : 0,
  };
}
