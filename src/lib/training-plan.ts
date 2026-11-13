import type { Equipment, Exercise, Routine } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";
import { ROUTINE_TEMPLATES, templateToRoutine, type RoutineTemplate } from "@/lib/seed-routines";
import { swapCandidates, swapInRoutine } from "@/lib/exercise-swapper";
import { DEFAULT_SCHEDULE, type Weekday, type WorkoutSchedule } from "@/lib/notifications/schedule";
import type { Goal, Level } from "@/lib/first-plan";

/**
 * A training week from a few answers: how many days, which days, where, and the split. Pure, so
 * the setup screens, Home and the tests share it; lib/apply-plan writes the result to the stores.
 * Every workout is a Template Vault day (lib/seed-routines), adapted to the equipment at hand.
 */

export type PlanDays = 2 | 3 | 4 | 5 | 6;
export type PlanSplit = "full_body" | "upper_lower" | "ppl_ul" | "ppl" | "bodyweight";
export type Place = "gym" | "home" | "bodyweight";

export interface PlanAnswers {
  goal: Goal;
  level: Level;
  days: PlanDays;
  /** The training days, as many as `days`, Date#getDay numbering. */
  weekdays: Weekday[];
  place: Place;
  split: PlanSplit;
  /** "HH:MM", local. */
  time: string;
}

export interface TrainingPlan extends PlanAnswers {
  /** Template id → the routine saved for it. */
  routineIds: Record<string, string>;
  /** Routine id → its updatedAt when the plan made it; a different value means the lifter edited it. */
  routineStamps: Record<string, number>;
  createdAt: number;
}

export const PLAN_DAYS: PlanDays[] = [2, 3, 4, 5, 6];

export const SPLIT_LABEL: Record<PlanSplit, string> = {
  full_body: "Full Body",
  upper_lower: "Upper / Lower",
  ppl_ul: "Push / Pull / Legs + Upper / Lower",
  ppl: "Push / Pull / Legs",
  bodyweight: "No equipment",
};

export const SPLIT_BLURB: Record<PlanSplit, string> = {
  full_body: "Every muscle each session. Best for 2 or 3 days a week.",
  upper_lower: "Upper body one day, legs the next. Each muscle twice a week.",
  ppl_ul: "Push, pull and legs, then upper and lower. Five days, each muscle twice.",
  ppl: "Push, pull and legs, twice through. Six days for experienced lifters.",
  bodyweight: "Upper and lower body days with no equipment beyond a bar.",
};

export const PLACE_LABEL: Record<Place, string> = {
  gym: "Gym",
  home: "At home",
  bodyweight: "No equipment",
};

export const PLACE_BLURB: Record<Place, string> = {
  gym: "Barbells, machines and cables",
  home: "Dumbbells, kettlebells and bands",
  bodyweight: "Push-ups, pull-ups and squats. A bar helps",
};

/** The equipment each place has; null for anything. */
export const PLACE_EQUIPMENT: Record<Place, readonly Equipment[] | null> = {
  gym: null,
  home: ["dumbbell", "kettlebell", "bodyweight", "band"],
  bodyweight: ["bodyweight", "band"],
};

/** The splits that fit a number of days, the recommended one first. */
export function splitsFor(days: PlanDays, level: Level, place: Place): PlanSplit[] {
  if (place === "bodyweight") return ["bodyweight"];
  const all: PlanSplit[] = days <= 3 ? ["full_body", "upper_lower"] : days === 4 ? ["upper_lower", "full_body"] : ["ppl_ul", "ppl", "upper_lower", "full_body"];
  const rec = recommendSplit(days, level, place);
  return [rec, ...all.filter((s) => s !== rec)];
}

/**
 * Full body for 2 or 3 days (every muscle each time), upper/lower for 4, push/pull/legs plus
 * upper/lower for 5 and push/pull/legs twice for 6. A new lifter stays on upper/lower past 4
 * days: fewer exercises to learn, the same muscle twice a week.
 */
export function recommendSplit(days: PlanDays, level: Level, place: Place = "gym"): PlanSplit {
  if (place === "bodyweight") return "bodyweight";
  if (days <= 3) return "full_body";
  if (days === 4 || level === "new") return "upper_lower";
  return days === 5 ? "ppl_ul" : "ppl";
}

/** The template for each training day of the week, in order. */
export function splitDays(split: PlanSplit, days: PlanDays): string[] {
  const cycle: Record<PlanSplit, string[]> = {
    full_body: ["tpl-fb-1", "tpl-fb-2", "tpl-fb-3"],
    upper_lower: ["tpl-upper", "tpl-lower"],
    ppl_ul: ["tpl-push-a", "tpl-pull-a", "tpl-legs-a", "tpl-upper", "tpl-lower"],
    ppl: ["tpl-push-a", "tpl-pull-a", "tpl-legs-a", "tpl-push-b", "tpl-pull-b", "tpl-legs-b"],
    bodyweight: ["tpl-cali-upper", "tpl-cali-lower"],
  };
  const c = cycle[split];
  return Array.from({ length: days }, (_, i) => c[i % c.length]!);
}

/** Training days spread for recovery: a rest day between full-body days, weekends free first. */
export function defaultWeekdays(days: PlanDays): Weekday[] {
  const map: Record<PlanDays, Weekday[]> = {
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
  };
  return map[days];
}

/** The training days in week order (Monday first when the week starts Monday). */
export function orderWeekdays(days: Weekday[], firstDay: 0 | 1): Weekday[] {
  return [...new Set(days)].sort((a, b) => ((a - firstDay + 7) % 7) - ((b - firstDay + 7) % 7));
}

/** At home a loaded version beats a bodyweight one: a goblet squat over an air squat. */
const EQUIPMENT_PREFERENCE: Partial<Record<Equipment, number>> = { dumbbell: 12, kettlebell: 10, band: 4 };
/** A swap below this match is a different exercise, not a stand-in (a box jump for a leg extension). */
const MIN_MATCH = 45;

/**
 * The routine with every exercise the place lacks swapped for the closest one it has (same
 * movement, then same muscle, loaded before bodyweight). One already in the routine is not picked
 * twice. With no close swap the exercise is dropped, so a home day never asks for a machine.
 */
export function adaptForPlace(routine: Routine, place: Place, library: Exercise[] = SEED_EXERCISES): Routine {
  const allowed = PLACE_EQUIPMENT[place];
  if (!allowed) return routine;
  const byId = new Map(library.map((e) => [e.id, e]));
  const pool = library.filter((e) => allowed.includes(e.equipment));
  let exercises = routine.exercises;
  for (const re of routine.exercises) {
    const from = byId.get(re.exerciseId);
    if (!from || allowed.includes(from.equipment)) continue;
    const used = new Set(exercises.map((e) => e.exerciseId));
    const pick = swapCandidates(from, pool, "all", 12)
      .filter((c) => !used.has(c.exercise.id) && c.match >= MIN_MATCH)
      .sort((a, b) => b.match + (EQUIPMENT_PREFERENCE[b.exercise.equipment] ?? 0) - (a.match + (EQUIPMENT_PREFERENCE[a.exercise.equipment] ?? 0)))[0];
    exercises = pick ? (swapInRoutine(exercises, from.id, pick.exercise.id, null) ?? exercises) : exercises.filter((e) => e.id !== re.id);
  }
  return exercises === routine.exercises ? routine : { ...routine, exercises };
}

/**
 * Small changes for the goal: strength keeps the first lift heavy (5 reps, 3 minutes' rest);
 * fat loss trims the rest so the session moves. Muscle and fitness keep the template.
 */
export function goalTweak(routine: Routine, goal: Goal): Routine {
  if (goal === "strength") {
    const [first, ...rest] = routine.exercises;
    if (!first) return routine;
    return {
      ...routine,
      exercises: [{ ...first, restSeconds: Math.max(first.restSeconds, 180), sets: first.sets.map((s) => (s.targetReps ? { ...s, targetReps: Math.min(s.targetReps, 5) } : s)) }, ...rest],
    };
  }
  if (goal === "fat_loss") {
    return { ...routine, exercises: routine.exercises.map((e) => ({ ...e, restSeconds: Math.max(45, Math.round((e.restSeconds * 0.67) / 15) * 15) })) };
  }
  return routine;
}

export interface BuiltPlan {
  /** One routine per distinct template, in the order they first appear in the week. */
  routines: { templateId: string; routine: Routine }[];
  /** Weekday → template id. */
  assignment: Partial<Record<Weekday, string>>;
}

const templateById = (id: string): RoutineTemplate => ROUTINE_TEMPLATES.find((t) => t.id === id) ?? ROUTINE_TEMPLATES[0]!;

/** The routines and the week for a set of answers. Fresh ids each call; nothing is saved. */
export function buildPlan(a: PlanAnswers, firstDay: 0 | 1 = 1, library: Exercise[] = SEED_EXERCISES, now = Date.now()): BuiltPlan {
  const weekdays = orderWeekdays(a.weekdays, firstDay);
  const order = splitDays(a.split, weekdays.length as PlanDays);
  const assignment: Partial<Record<Weekday, string>> = {};
  weekdays.forEach((wd, i) => (assignment[wd] = order[i]));
  const routines: BuiltPlan["routines"] = [];
  for (const id of order) {
    if (routines.some((r) => r.templateId === id)) continue;
    const base = templateToRoutine(templateById(id), now);
    routines.push({ templateId: id, routine: goalTweak(adaptForPlace(base, a.place, library), a.goal) });
  }
  return { routines, assignment };
}

/** The schedule for a plan: the chosen days on with their routine, the rest off. */
export function planSchedule(a: Pick<PlanAnswers, "weekdays" | "time">, assignment: Partial<Record<Weekday, string>>, routineIds: Record<string, string>, enabled: boolean): WorkoutSchedule {
  const days = { ...DEFAULT_SCHEDULE.days };
  for (const wd of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    const tpl = assignment[wd];
    days[wd] = tpl && a.weekdays.includes(wd) ? { on: true, routineId: routineIds[tpl] ?? null } : { on: false, routineId: null };
  }
  return { ...DEFAULT_SCHEDULE, enabled, time: a.time, days };
}

/**
 * The previous plan's routines that can go: still there and never edited since the plan made
 * them. An edited one is the lifter's now, and stays.
 */
export function planRoutinesToReplace(plan: TrainingPlan | null, routines: Routine[]): { replace: string[]; kept: string[] } {
  if (!plan) return { replace: [], kept: [] };
  const replace: string[] = [];
  const kept: string[] = [];
  for (const id of Object.values(plan.routineIds)) {
    const r = routines.find((x) => x.id === id);
    if (!r) continue;
    (plan.routineStamps[id] === r.updatedAt ? replace : kept).push(id);
  }
  return { replace, kept };
}

/** The folder plan routines are saved in, e.g. "My plan · 5 days". */
export function planFolder(days: number): string {
  return `My plan · ${days} days`;
}

/** Defaults for a first setup. */
export function defaultAnswers(): PlanAnswers {
  return { goal: "muscle", level: "new", days: 3, weekdays: defaultWeekdays(3), place: "gym", split: "full_body", time: "17:30" };
}

/** Answers from a saved plan, for adjusting it. */
export function answersOf(p: TrainingPlan): PlanAnswers {
  const { goal, level, days, weekdays, place, split, time } = p;
  return { goal, level, days, weekdays, place, split, time };
}

/** A stored plan, checked field by field (backups and sync can hand over anything). */
export function normalizePlan(raw: unknown): TrainingPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const goals: Goal[] = ["muscle", "strength", "fat_loss", "fitness"];
  const levels: Level[] = ["new", "some", "experienced"];
  const places: Place[] = ["gym", "home", "bodyweight"];
  const splits = Object.keys(SPLIT_LABEL) as PlanSplit[];
  if (!goals.includes(p.goal as Goal) || !levels.includes(p.level as Level) || !places.includes(p.place as Place) || !splits.includes(p.split as PlanSplit)) return null;
  if (!PLAN_DAYS.includes(p.days as PlanDays)) return null;
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
