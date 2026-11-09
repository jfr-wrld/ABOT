import type { Exercise, MuscleGroup, WorkoutSession } from "@/types/workout";
import { isWorkingSet, setVolume } from "./calc";

/**
 * Muscle balance over a time window, on six axes, with the ratio checks coaches use.
 *
 * Each working set counts 1 for the axes its primary muscles belong to and 0.5 for its
 * secondary muscles (the same rule as the muscle split), once per axis per set. A muscle can sit
 * on two axes (biceps: Pull and Arms; lower back: Hip and Core); that is intended.
 *
 * Score: starts at 100 and loses 1.5 points per percentage point of total variation distance
 * between the share of sets per axis and a balanced program, and 5 more per diagnostic that
 * fires, so no pull work at all can never read as balanced. Suggestions add at least 2 sets.
 */

export type Axis = "push" | "pull" | "knee" | "hip" | "arms" | "core";
export const AXES: Axis[] = ["push", "pull", "knee", "hip", "arms", "core"];

const AXIS_MUSCLES: Record<Axis, MuscleGroup[]> = {
  push: ["chest", "shoulders", "triceps"],
  pull: ["lats", "back", "traps", "biceps"],
  knee: ["quads", "calves", "adductors"],
  hip: ["hamstrings", "glutes", "lower_back", "abductors"],
  arms: ["biceps", "triceps", "forearms"],
  core: ["abs", "lower_back"],
};

/** Shares of a balanced week: a little more pull than push, legs about a third. */
export const IDEAL_SHARE: Record<Axis, number> = { push: 0.2, pull: 0.22, knee: 0.17, hip: 0.17, arms: 0.14, core: 0.1 };

const LOWER: ReadonlySet<MuscleGroup> = new Set(["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"]);
const UPPER: ReadonlySet<MuscleGroup> = new Set(["chest", "shoulders", "triceps", "lats", "back", "traps", "biceps", "forearms"]);

export interface AxisValue {
  sets: number;
  volume: number;
  /** Share of all axis sets, 0..1. */
  share: number;
  /** share / ideal share: 1 is balanced. */
  ratio: number;
}

export type Grade = "OPTIMAL" | "BALANCED" | "IMBALANCED" | "CRITICAL";

export interface Diagnostic {
  /** Which check fired, for tests and styling. */
  code: "push-pull" | "pull-push" | "quad-ham" | "ham-quad" | "skip-legs" | "low-axis";
  /** English template with {placeholders}; the UI passes it through t() with `params`. */
  key: string;
  params: Record<string, string | number>;
  /** The template filled in, in English. */
  text: string;
  /** Sets to add this week to fix it. */
  addSets: number;
}

/** Every diagnostic template, so the translation coverage test can list them. */
export const DIAGNOSTIC_KEYS = {
  pushPull: "Push volume exceeds Pull by {pct}%. Add {n} sets of Rows or Rear Delt Flyes this week.",
  noPull: "No pull work in this range against {push} push sets. Add {n} sets of Rows or Rear Delt Flyes this week.",
  pullPush: "Pull is {pct}% ahead of Push. Add {n} sets of Presses or Push Ups.",
  quadHam: "Hamstrings get {ratio} sets per quad set (aim 0.75 to 1.0). Add {n} sets of Romanian Deadlifts or Leg Curls.",
  hamQuad: "Quads trail hamstrings ({ratio} to 1). Add {n} sets of Squats or Leg Press.",
  skipLegs: "Skip-leg-day pattern: legs are {pct}% of your sets (aim 25% or more). Add {n} sets of Squats or Romanian Deadlifts.",
  low: {
    push: "Push is at {pct}% of a balanced share. Add {n} sets of Presses.",
    pull: "Pull is at {pct}% of a balanced share. Add {n} sets of Rows.",
    knee: "Quads / Anterior is at {pct}% of a balanced share. Add {n} sets of Squats or Lunges.",
    hip: "Hams / Posterior is at {pct}% of a balanced share. Add {n} sets of Hip Thrusts or Romanian Deadlifts.",
    arms: "Arms is at {pct}% of a balanced share. Add {n} sets of Curls and Pushdowns.",
    core: "Core is at {pct}% of a balanced share. Add {n} sets of Planks or Cable Crunches.",
  } satisfies Record<Axis, string>,
};

const fill = (key: string, params: Record<string, string | number>) => key.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
const diag = (code: Diagnostic["code"], key: string, params: Record<string, string | number>, addSets: number): Diagnostic => ({
  code,
  key,
  params,
  text: fill(key, params),
  addSets,
});

export interface SymmetryReport {
  axes: Record<Axis, AxisValue>;
  totalSets: number;
  /** 0..100, null with too little data to judge. */
  score: number | null;
  grade: Grade | null;
  pushPull: number | null;
  /** hamstrings / quads */
  quadHam: number | null;
  /** Lower-body share of upper + lower muscle sets. */
  lowerShare: number | null;
  diagnostics: Diagnostic[];
}

/** Fewer working sets than this and the shape says more about chance than about training. */
export const MIN_SETS = 6;

export function analyzeSymmetry(sessions: WorkoutSession[], byId: Record<string, Exercise>, from: number, to = Infinity): SymmetryReport {
  const sets: Record<Axis, number> = { push: 0, pull: 0, knee: 0, hip: 0, arms: 0, core: 0 };
  const volume: Record<Axis, number> = { push: 0, pull: 0, knee: 0, hip: 0, arms: 0, core: 0 };
  const muscle = new Map<MuscleGroup, number>();
  for (const s of sessions) {
    if (s.status !== "completed" || s.startedAt < from || s.startedAt >= to) continue;
    for (const ex of s.exercises) {
      const e = byId[ex.exerciseId];
      if (!e) continue;
      const weight = new Map<MuscleGroup, number>();
      for (const m of e.secondaryMuscles) weight.set(m, 0.5);
      for (const m of e.primaryMuscles) weight.set(m, 1);
      if (weight.has("full_body")) for (const a of AXES) for (const m of AXIS_MUSCLES[a]) if (!weight.has(m)) weight.set(m, 0.5);
      for (const set of ex.sets) {
        if (!isWorkingSet(set)) continue;
        const v = setVolume(set, e.loadMode);
        for (const [m, w] of weight) muscle.set(m, (muscle.get(m) ?? 0) + w);
        for (const a of AXES) {
          const w = Math.max(0, ...AXIS_MUSCLES[a].map((m) => weight.get(m) ?? 0));
          sets[a] += w;
          volume[a] += v * w;
        }
      }
    }
  }
  const total = AXES.reduce((n, a) => n + sets[a], 0);
  const axes = Object.fromEntries(
    AXES.map((a) => {
      const share = total > 0 ? sets[a] / total : 0;
      return [a, { sets: sets[a], volume: volume[a], share, ratio: share / IDEAL_SHARE[a] }];
    }),
  ) as Record<Axis, AxisValue>;

  if (total < MIN_SETS) {
    return { axes, totalSets: total, score: null, grade: null, pushPull: null, quadHam: null, lowerShare: null, diagnostics: [] };
  }

  const tv = AXES.reduce((d, a) => d + Math.abs(axes[a].share - IDEAL_SHARE[a]), 0) / 2;
  const sum = (set: ReadonlySet<MuscleGroup>) => [...muscle].filter(([m]) => set.has(m)).reduce((n, [, v]) => n + v, 0);
  const lower = sum(LOWER);
  const upper = sum(UPPER);
  const lowerShare = lower + upper > 0 ? lower / (lower + upper) : null;
  const quads = muscle.get("quads") ?? 0;
  const hams = muscle.get("hamstrings") ?? 0;
  const pushPull = sets.pull > 0 ? sets.push / sets.pull : null;
  const quadHam = quads > 0 ? hams / quads : null;

  const diagnostics: Diagnostic[] = [];
  const pct = (n: number) => Math.round(n * 100);
  const atLeast2 = (n: number) => Math.max(2, Math.ceil(n));
  if (sets.push > 0 && sets.pull === 0) {
    const add = atLeast2(sets.push);
    diagnostics.push(diag("push-pull", DIAGNOSTIC_KEYS.noPull, { push: Math.round(sets.push * 10) / 10, n: add }, add));
  } else if (sets.push > sets.pull * 1.25) {
    const add = atLeast2(sets.push - sets.pull);
    diagnostics.push(diag("push-pull", DIAGNOSTIC_KEYS.pushPull, { pct: pct(sets.push / sets.pull - 1), n: add }, add));
  } else if (sets.pull > sets.push * 1.5 && sets.push > 0) {
    const add = atLeast2(sets.pull / 1.2 - sets.push);
    diagnostics.push(diag("pull-push", DIAGNOSTIC_KEYS.pullPush, { pct: pct(sets.pull / sets.push - 1), n: add }, add));
  }
  if (quadHam !== null && quads >= 3 && quadHam < 0.75) {
    const add = atLeast2(quads * 0.75 - hams);
    diagnostics.push(diag("quad-ham", DIAGNOSTIC_KEYS.quadHam, { ratio: quadHam.toFixed(2), n: add }, add));
  } else if (quadHam !== null && quads >= 3 && quadHam > 1.33) {
    const add = atLeast2(hams * 0.75 - quads);
    diagnostics.push(diag("ham-quad", DIAGNOSTIC_KEYS.hamQuad, { ratio: quadHam.toFixed(2), n: add }, add));
  }
  if (lowerShare !== null && lowerShare < 0.25) {
    // Sets of lower body that bring it to a quarter of upper + lower.
    const add = atLeast2(upper / 3 - lower);
    diagnostics.push(diag("skip-legs", DIAGNOSTIC_KEYS.skipLegs, { pct: pct(lowerShare), n: add }, add));
  }
  const weakest = AXES.filter((a) => a !== "push" && a !== "pull").sort((a, b) => axes[a].ratio - axes[b].ratio)[0]!;
  const coveredBy: Partial<Record<Axis, Diagnostic["code"][]>> = { knee: ["skip-legs", "ham-quad"], hip: ["skip-legs", "quad-ham"] };
  if (axes[weakest].ratio < 0.5 && !diagnostics.some((d) => coveredBy[weakest]?.includes(d.code))) {
    const add = atLeast2(IDEAL_SHARE[weakest] * total - sets[weakest]);
    diagnostics.push(diag("low-axis", DIAGNOSTIC_KEYS.low[weakest], { pct: pct(axes[weakest].ratio), n: add }, add));
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - 150 * tv - 5 * diagnostics.length)));
  const grade: Grade = score >= 85 ? "OPTIMAL" : score >= 70 ? "BALANCED" : score >= 50 ? "IMBALANCED" : "CRITICAL";
  return { axes, totalSets: total, score, grade, pushPull, quadHam, lowerShare, diagnostics };
}

export const AXIS_LABEL: Record<Axis, string> = {
  push: "Push",
  pull: "Pull",
  knee: "Quads / Anterior",
  hip: "Hams / Posterior",
  arms: "Arms",
  core: "Core",
};
