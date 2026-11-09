import type { BodyweightEntry, Exercise, WorkoutSession } from "@/types/workout";
import { estimate1RM, isWorkingSet } from "./calc";
import { tunables } from "./tunables";

/**
 * Body phase protocols: a block of weeks with one goal (cut, lean bulk, recomp, strength peak).
 * The active phase sets the daily calorie and macro targets, the trend the scale should follow,
 * and shifts other parts of ABOT: the Coach Pill (lib/progressive-overload), the recovery map
 * (lib/muscle-recovery) and the rest after compound sets while peaking. Every number that tunes
 * this lives in tunables().phase, so Mission Control can change it.
 *
 * The targets are estimates from published formulas (Mifflin-St Jeor, MET), not medical advice.
 */

export type BodyPhaseType = "CUTTING" | "BULKING" | "RECOMP" | "STRENGTH_PEAK";
export type BiologicalSex = "male" | "female";

export interface ActivePhaseConfig {
  id: string;
  phaseType: BodyPhaseType;
  /** "LEAN BULK // 8 WEEKS", made at setup. */
  title: string;
  /** Local start day, "YYYY-MM-DD". */
  startDate: string;
  durationWeeks: number;
  startWeightKg: number;
  targetWeightKg: number;
  heightCm: number;
  age: number;
  biologicalSex: BiologicalSex;
  /** Daily activity outside training, 1.2 (desk) to 1.9; training calories are added on top. */
  activityMultiplier: number;
  /** Planned change of body weight per week, % (negative when cutting). */
  weeklyRatePercent: number;
  isActive: boolean;
}

export const PHASE_TYPES: BodyPhaseType[] = ["CUTTING", "BULKING", "RECOMP", "STRENGTH_PEAK"];
export const PHASE_DURATIONS = [4, 6, 8, 12, 16] as const;

/** English names; the UI translates them. */
export const PHASE_LABEL: Record<BodyPhaseType, string> = {
  CUTTING: "Cut",
  BULKING: "Lean bulk",
  RECOMP: "Recomp",
  STRENGTH_PEAK: "Strength peak",
};
export const PHASE_BLURB: Record<BodyPhaseType, string> = {
  CUTTING: "Lose fat at a steady pace and keep your strength.",
  BULKING: "Gain muscle with a small surplus and keep adding weight to the bar.",
  RECOMP: "Hold your weight: more food on training days, less on rest days.",
  STRENGTH_PEAK: "Heavy compounds in sets of 3 to 5 with long rests.",
};
/** What each phase changes in the rest of ABOT, shown before saving. */
export const PHASE_CALIBRATION: Record<BodyPhaseType, string[]> = {
  CUTTING: ["Coach: hold the weight when sets get hard; drop a set instead of weight when tired", "Recovery map: 15% slower recovery in a deficit"],
  BULKING: ["Coach: add weight after every clean compound session, and a set when the muscle is fresh", "Recovery map: 10% faster recovery in a surplus"],
  RECOMP: ["Calories: a little more on training days, a little less on rest days", "Coach and recovery work as usual"],
  STRENGTH_PEAK: ["Coach: compounds in sets of 3 to 5", "Rest after compound sets: at least 3 minutes"],
};

export const RISK_LABEL = { low: "Muscle loss risk: low", moderate: "Muscle loss risk: moderate", high: "Muscle loss risk: high" } as const;
/** Planned change per week, % of body weight. */
export const DEFAULT_RATE: Record<BodyPhaseType, number> = { CUTTING: -0.5, BULKING: 0.3, RECOMP: 0, STRENGTH_PEAK: 0 };
/** Daily activity outside training. */
export const ACTIVITY_LEVELS: { value: number; label: string }[] = [
  { value: 1.2, label: "Desk job, little walking" },
  { value: 1.375, label: "On your feet some of the day" },
  { value: 1.55, label: "Active job or many steps" },
  { value: 1.725, label: "Physical work all day" },
];

const DAY = 86_400_000;

let source: () => ActivePhaseConfig | null = () => null;

/** Set once by the settings store, so this module stays free of store imports. */
export function setPhaseSource(fn: () => ActivePhaseConfig | null): void {
  source = fn;
}

/** The phase in force, or null. */
export function activePhase(): ActivePhaseConfig | null {
  const p = source();
  return p && p.isActive ? p : null;
}

/* ---------------------------------------------------------------- trend weight */

export interface TrendPoint {
  date: number;
  weightKg: number;
  /** Exponential moving average: today × 0.25 + yesterday's average × 0.75. */
  emaKg: number;
}

/** The scale's trend, free of day-to-day water swings; oldest first. */
export function trendWeight(entries: BodyweightEntry[]): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date - b.date);
  const out: TrendPoint[] = [];
  let ema: number | null = null;
  for (const e of sorted) {
    ema = ema === null ? e.weightKg : e.weightKg * 0.25 + ema * 0.75;
    out.push({ date: e.date, weightKg: e.weightKg, emaKg: Math.round(ema * 100) / 100 });
  }
  return out;
}

/** Trend change per week over the last two weeks, kg; null with too little data. */
export function trendRatePerWeek(points: TrendPoint[], now: number): number | null {
  const recent = points.filter((p) => p.date >= now - 14 * DAY);
  if (recent.length < 2) return null;
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const weeks = (last.date - first.date) / (7 * DAY);
  if (weeks < 3 / 7) return null;
  return Math.round(((last.emaKg - first.emaKg) / weeks) * 100) / 100;
}

/* ---------------------------------------------------------------- energy */

/** Mifflin-St Jeor resting energy, kcal/day. */
export function bmr(weightKg: number, heightCm: number, age: number, sex: BiologicalSex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export interface FuelTarget {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Maintenance this target is based on. */
  tdee: number;
  /** Difference from maintenance, kcal. */
  delta: number;
}

/**
 * Maintenance: resting energy × daily activity, plus the training calories of the last four
 * weeks averaged per day (lib/calorie-estimator), so a heavy training week raises the target.
 */
export function maintenance(p: ActivePhaseConfig, weightKg: number, trainingKcalPerDay: number): number {
  return bmr(weightKg, p.heightCm, p.age, p.biologicalSex) * p.activityMultiplier + trainingKcalPerDay;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Calories that move the planned weekly rate, about 7700 kcal per kg, per day. */
function rateKcal(p: ActivePhaseConfig, weightKg: number): number {
  return Math.abs((weightKg * p.weeklyRatePercent) / 100) * (7700 / 7);
}

/** Daily calories and macros for the phase; recomp cycles calories on training days. */
export function fuelTarget(p: ActivePhaseConfig, weightKg: number, trainingKcalPerDay: number, trainingDay: boolean): FuelTarget {
  const t = tunables().phase;
  const tdee = maintenance(p, weightKg, trainingKcalPerDay);
  let delta = 0;
  let protein = t.peakProtein;
  let fat = t.recompFat;
  switch (p.phaseType) {
    case "CUTTING":
      delta = -clamp(rateKcal(p, weightKg), t.cutDeficitMin, t.cutDeficitMax);
      protein = t.cutProtein;
      fat = t.cutFat;
      break;
    case "BULKING":
      delta = clamp(rateKcal(p, weightKg), t.bulkSurplusMin, t.bulkSurplusMax);
      protein = t.bulkProtein;
      fat = t.bulkFat;
      break;
    case "RECOMP":
      delta = trainingDay ? t.recompCycle : -t.recompCycle;
      protein = t.recompProtein;
      break;
    case "STRENGTH_PEAK":
      break;
  }
  const kcal = Math.round(tdee + delta);
  const proteinG = Math.round(protein * weightKg);
  const fatG = Math.round(fat * weightKg);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal, proteinG, carbsG, fatG, tdee: Math.round(tdee), delta: Math.round(delta) };
}

/** How much the phase stretches recovery: a deficit slows it, a surplus speeds it up. */
export function recoveryModifier(p: ActivePhaseConfig | null = activePhase()): number {
  if (!p) return 1;
  const t = tunables().phase;
  return p.phaseType === "CUTTING" ? t.cutRecovery : p.phaseType === "BULKING" ? t.bulkRecovery : 1;
}

/* ---------------------------------------------------------------- mesocycle */

export interface MesocycleWeek {
  /** 1-based, capped at the length. */
  week: number;
  of: number;
  /** 0..1 through the block. */
  progress: number;
  deload: boolean;
  /** Days left, 0 once the block is over. */
  daysLeft: number;
  finished: boolean;
}

/** Local midnight of a "YYYY-MM-DD" day. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
}

/** Where the block is: week X of N, and whether this is a deload week (every N weeks). */
export function mesocycleWeek(p: ActivePhaseConfig, now: number): MesocycleWeek {
  const start = dayStart(p.startDate);
  const total = p.durationWeeks * 7 * DAY;
  const elapsed = Math.max(0, now - start);
  const week = Math.min(p.durationWeeks, Math.floor(elapsed / (7 * DAY)) + 1);
  const every = tunables().phase.deloadEvery;
  return {
    week,
    of: p.durationWeeks,
    progress: Math.min(1, elapsed / total),
    deload: p.durationWeeks >= every && week % every === 0,
    daysLeft: Math.max(0, Math.ceil((start + total - now) / DAY)),
    finished: elapsed >= total,
  };
}

/* ---------------------------------------------------------------- strength shield */

/** Compounds a strength ratio is read from: barbell or Smith machine, multi-joint. */
function isTopCompound(ex: Exercise | undefined): boolean {
  return !!ex && ex.category === "compound" && (ex.equipment === "barbell" || ex.equipment === "smith_machine");
}

/** Best estimated 1RM on a top compound between `from` and `to`, kg; null if none. */
export function topCompound1RM(sessions: WorkoutSession[], byId: Record<string, Exercise>, from: number, to: number): number | null {
  let best = 0;
  for (const s of sessions) {
    if (s.status !== "completed" || s.startedAt < from || s.startedAt >= to) continue;
    for (const e of s.exercises) {
      if (!isTopCompound(byId[e.exerciseId])) continue;
      for (const set of e.sets) {
        if (!set.completed || !isWorkingSet(set) || !set.weightKg || !set.reps || set.reps > 12) continue;
        best = Math.max(best, estimate1RM(set.weightKg, set.reps));
      }
    }
  }
  return best > 0 ? best : null;
}

export type RetentionRisk = "low" | "moderate" | "high";

export interface StrengthShield {
  /** Best compound e1RM ÷ trend weight, last 4 weeks. */
  ratio: number;
  /** Change against the 4 weeks before, %; null without that history. */
  changePct: number | null;
  /** While cutting: is strength holding as weight comes down? */
  risk: RetentionRisk | null;
}

/**
 * Relative strength: the best top-compound e1RM of the last four weeks per kg of trend weight,
 * against the four weeks before. While cutting, a ratio that holds or rises as weight drops
 * means muscle is being kept (low risk); one falling over 3% is high risk.
 */
export function strengthShield(
  sessions: WorkoutSession[],
  byId: Record<string, Exercise>,
  points: TrendPoint[],
  now: number,
  phase: ActivePhaseConfig | null,
): StrengthShield | null {
  const w = (at: number) => {
    const before = points.filter((p) => p.date <= at);
    return before.length ? before[before.length - 1]!.emaKg : null;
  };
  const nowW = w(now);
  const thenW = w(now - 28 * DAY);
  const recent = topCompound1RM(sessions, byId, now - 28 * DAY, now + 1);
  if (!recent || !nowW) return null;
  const ratio = Math.round((recent / nowW) * 100) / 100;
  const prior = topCompound1RM(sessions, byId, now - 56 * DAY, now - 28 * DAY);
  const priorRatio = prior && thenW ? prior / thenW : null;
  const changePct = priorRatio ? Math.round(((recent / nowW - priorRatio) / priorRatio) * 1000) / 10 : null;
  let risk: RetentionRisk | null = null;
  if (phase?.phaseType === "CUTTING" && changePct !== null) risk = changePct >= 0 ? "low" : changePct > -3 ? "moderate" : "high";
  return { ratio, changePct, risk };
}

/* ---------------------------------------------------------------- training */

/** Training calories per day over the last four weeks, from each workout's estimate. */
export function trainingKcalPerDay(sessions: WorkoutSession[], now: number, kcalOf: (s: WorkoutSession) => number): number {
  const from = now - 28 * DAY;
  const total = sessions.filter((s) => s.status === "completed" && s.startedAt >= from && s.startedAt <= now).reduce((n, s) => n + kcalOf(s), 0);
  return Math.round(total / 28);
}

/** Rest after a compound set while peaking (seconds), or null to keep the exercise's own. */
export function peakRestSec(ex: Pick<Exercise, "category"> | undefined, p: ActivePhaseConfig | null = activePhase()): number | null {
  if (!p || p.phaseType !== "STRENGTH_PEAK" || ex?.category !== "compound") return null;
  return tunables().phase.peakRestSec;
}

/** Title made at setup: "LEAN BULK // 8 WEEKS". */
export function phaseTitle(type: BodyPhaseType, weeks: number): string {
  return `${PHASE_LABEL[type].toUpperCase()} // ${weeks} WEEKS`;
}

/** Bounds a stored or imported phase; null when it is not one. */
export function normalizePhase(raw: unknown): ActivePhaseConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, fallback?: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return n === undefined ? null : clamp(n, lo, hi);
  };
  const type = PHASE_TYPES.includes(r.phaseType as BodyPhaseType) ? (r.phaseType as BodyPhaseType) : null;
  const start = typeof r.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate) ? r.startDate : null;
  const startW = num(r.startWeightKg, 20, 400);
  const targetW = num(r.targetWeightKg, 20, 400);
  const height = num(r.heightCm, 100, 250);
  const age = num(r.age, 13, 100);
  if (!type || !start || startW === null || targetW === null || height === null || age === null) return null;
  const weeks = Math.round(num(r.durationWeeks, 1, 52, 8)!);
  return {
    id: typeof r.id === "string" && r.id ? r.id : `phase-${start}`,
    phaseType: type,
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 60) : phaseTitle(type, weeks),
    startDate: start,
    durationWeeks: weeks,
    startWeightKg: startW,
    targetWeightKg: targetW,
    heightCm: height,
    age: Math.round(age),
    biologicalSex: r.biologicalSex === "female" ? "female" : "male",
    activityMultiplier: num(r.activityMultiplier, 1.2, 1.9, 1.375)!,
    weeklyRatePercent: num(r.weeklyRatePercent, -1.5, 1.5, DEFAULT_RATE[type])!,
    isActive: r.isActive !== false,
  };
}

/* ---------------------------------------------------------------- templates */

type TemplateShape = { split: string; exercises: { sets: number; reps?: number }[] };

/**
 * Whether a routine template suits the phase, for the Routines badge:
 * - strength peak: a main lift in sets of 5 or fewer;
 * - lean bulk: push/pull/legs or upper/lower with 18 sets or more (volume to grow);
 * - cut: full body or upper/lower, 20 sets or fewer, keeping a heavy lift (8 reps or fewer);
 * - recomp: full body or upper/lower.
 */
export function templateFitsPhase(tpl: TemplateShape, phase: BodyPhaseType): boolean {
  const lifting = ["ppl", "upper_lower", "full_body"].includes(tpl.split);
  if (!lifting) return false;
  const sets = tpl.exercises.reduce((n, e) => n + e.sets, 0);
  const reps = tpl.exercises.map((e) => e.reps).filter((r): r is number => typeof r === "number");
  const heaviest = reps.length ? Math.min(...reps) : Infinity;
  switch (phase) {
    case "STRENGTH_PEAK":
      return heaviest <= 5;
    case "BULKING":
      return (tpl.split === "ppl" || tpl.split === "upper_lower") && sets >= 18;
    case "CUTTING":
      return tpl.split !== "ppl" && sets <= 20 && heaviest <= 8;
    case "RECOMP":
      return tpl.split !== "ppl";
  }
}
