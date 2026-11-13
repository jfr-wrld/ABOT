/**
 * Algorithm constants the founder can calibrate from Mission Control without a new APK. Each
 * module reads them at call time through `tunables()`, which returns the remote config's values
 * (Supabase row, or the local override) merged over these defaults. The defaults are the values
 * the modules shipped with, so nothing changes until someone edits them.
 *
 * Modules and what they read:
 * - lib/muscle-recovery.ts        recovery.*
 * - lib/calorie-estimator.ts      calories.*
 * - lib/progressive-overload.ts   coach.*
 * - lib/symmetry-analyzer.ts      symmetry.*
 * - components/share/StoryCardStudio.tsx  story.freePresets
 * - lib/gym-nearby.ts (AutoGym)   gyms.nearbyM
 */

export interface Tunables {
  recovery: { primaryPct: number; secondaryPct: number; bigHours: number; smallHours: number; readyAtPct: number };
  calories: { metMin: number; metMax: number; densityLow: number; densityHigh: number; fallbackKg: number };
  coach: { cleanRpe: number; grindRpe: number; deloadPct: number; repCeiling: number; repFloor: number };
  symmetry: { pushOverPull: number; quadHamMin: number; legsMinShare: number; minSets: number };
  story: { freePresets: number };
  gyms: { nearbyM: number };
  phase: {
    cutRecovery: number;
    bulkRecovery: number;
    cutDeficitMin: number;
    cutDeficitMax: number;
    bulkSurplusMin: number;
    bulkSurplusMax: number;
    recompCycle: number;
    cutProtein: number;
    bulkProtein: number;
    recompProtein: number;
    peakProtein: number;
    cutFat: number;
    bulkFat: number;
    recompFat: number;
    peakRestSec: number;
    deloadEvery: number;
  };
}

export const DEFAULT_TUNABLES: Tunables = {
  recovery: { primaryPct: 15, secondaryPct: 7.5, bigHours: 72, smallHours: 48, readyAtPct: 20 },
  calories: { metMin: 3.5, metMax: 6.5, densityLow: 40, densityHigh: 300, fallbackKg: 75 },
  coach: { cleanRpe: 8.5, grindRpe: 9.5, deloadPct: 10, repCeiling: 12, repFloor: 8 },
  symmetry: { pushOverPull: 1.25, quadHamMin: 0.75, legsMinShare: 0.25, minSets: 6 },
  story: { freePresets: 2 },
  gyms: { nearbyM: 300 },
  phase: {
    cutRecovery: 1.15,
    bulkRecovery: 0.9,
    cutDeficitMin: 350,
    cutDeficitMax: 500,
    bulkSurplusMin: 250,
    bulkSurplusMax: 350,
    recompCycle: 150,
    cutProtein: 2.2,
    bulkProtein: 1.8,
    recompProtein: 2.0,
    peakProtein: 2.0,
    cutFat: 0.8,
    bulkFat: 1.0,
    recompFat: 0.9,
    peakRestSec: 180,
    deloadEvery: 4,
  },
};

export interface TunableSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

/** Bounds keep a typo in Mission Control from breaking the app for everyone. */
export const TUNABLE_SPECS: { [G in keyof Tunables]: { title: string; fields: { [K in keyof Tunables[G]]: TunableSpec } } } = {
  recovery: {
    title: "Thermal recovery",
    fields: {
      primaryPct: { label: "Fatigue per set, primary muscle", min: 1, max: 50, step: 0.5, unit: "%" },
      secondaryPct: { label: "Fatigue per set, secondary muscle", min: 0, max: 50, step: 0.5, unit: "%" },
      bigHours: { label: "Full recovery, big muscles", min: 12, max: 168, step: 1, unit: "h" },
      smallHours: { label: "Full recovery, small muscles", min: 12, max: 168, step: 1, unit: "h" },
      readyAtPct: { label: "Ready at or below", min: 0, max: 60, step: 1, unit: "%" },
    },
  },
  calories: {
    title: "Calorie estimator (MET)",
    fields: {
      metMin: { label: "MET floor", min: 1, max: 10, step: 0.1 },
      metMax: { label: "MET ceiling", min: 1, max: 12, step: 0.1 },
      densityLow: { label: "Density for the floor", min: 0, max: 500, step: 5, unit: "kg/min" },
      densityHigh: { label: "Density for MET 6", min: 10, max: 1000, step: 5, unit: "kg/min" },
      fallbackKg: { label: "Body weight when unknown", min: 30, max: 200, step: 1, unit: "kg" },
    },
  },
  coach: {
    title: "Coach Pill (progressive overload)",
    fields: {
      cleanRpe: { label: "Clean session: average RPE at most", min: 6, max: 10, step: 0.5 },
      grindRpe: { label: "Deload: two sessions at RPE", min: 7, max: 10, step: 0.5 },
      deloadPct: { label: "Deload size", min: 1, max: 40, step: 1, unit: "%" },
      repCeiling: { label: "Add weight at reps", min: 3, max: 30, step: 1 },
      repFloor: { label: "Start again at reps", min: 1, max: 20, step: 1 },
    },
  },
  symmetry: {
    title: "Symmetry radar",
    fields: {
      pushOverPull: { label: "Warn when push exceeds pull by", min: 1, max: 3, step: 0.05, unit: "x" },
      quadHamMin: { label: "Hamstring sets per quad set, at least", min: 0.1, max: 2, step: 0.05 },
      legsMinShare: { label: "Legs share of sets, at least", min: 0.05, max: 0.6, step: 0.01 },
      minSets: { label: "Sets before scoring", min: 1, max: 50, step: 1 },
    },
  },
  story: {
    title: "Story Studio",
    fields: {
      freePresets: { label: "Free layouts (the rest are PRO)", min: 0, max: 8, step: 1 },
    },
  },
  gyms: {
    title: "Auto gym",
    fields: {
      nearbyM: { label: "Gym counts as here within", min: 50, max: 2000, step: 10, unit: "m" },
    },
  },
  phase: {
    title: "Body phase protocols",
    fields: {
      cutRecovery: { label: "Recovery time while cutting", min: 0.5, max: 2, step: 0.05, unit: "x" },
      bulkRecovery: { label: "Recovery time while bulking", min: 0.5, max: 2, step: 0.05, unit: "x" },
      cutDeficitMin: { label: "Cut: smallest daily deficit", min: 0, max: 1500, step: 10, unit: "kcal" },
      cutDeficitMax: { label: "Cut: largest daily deficit", min: 0, max: 1500, step: 10, unit: "kcal" },
      bulkSurplusMin: { label: "Bulk: smallest daily surplus", min: 0, max: 1500, step: 10, unit: "kcal" },
      bulkSurplusMax: { label: "Bulk: largest daily surplus", min: 0, max: 1500, step: 10, unit: "kcal" },
      recompCycle: { label: "Recomp: training day + / rest day −", min: 0, max: 500, step: 10, unit: "kcal" },
      cutProtein: { label: "Cut: protein per kg", min: 0.8, max: 3.5, step: 0.1, unit: "g" },
      bulkProtein: { label: "Bulk: protein per kg", min: 0.8, max: 3.5, step: 0.1, unit: "g" },
      recompProtein: { label: "Recomp: protein per kg", min: 0.8, max: 3.5, step: 0.1, unit: "g" },
      peakProtein: { label: "Strength peak: protein per kg", min: 0.8, max: 3.5, step: 0.1, unit: "g" },
      cutFat: { label: "Cut: fat per kg", min: 0.3, max: 2, step: 0.05, unit: "g" },
      bulkFat: { label: "Bulk: fat per kg", min: 0.3, max: 2, step: 0.05, unit: "g" },
      recompFat: { label: "Recomp and peak: fat per kg", min: 0.3, max: 2, step: 0.05, unit: "g" },
      peakRestSec: { label: "Strength peak: rest after compounds", min: 60, max: 600, step: 15, unit: "s" },
      deloadEvery: { label: "Deload every", min: 2, max: 12, step: 1, unit: "weeks" },
    },
  },
};

const clamp = (v: unknown, s: TunableSpec, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(s.max, Math.max(s.min, n)) : fallback;
};

/** Any stored or fetched value, bounded field by field; missing fields keep the default. */
export function normalizeTunables(raw: unknown): Tunables {
  const src = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const out = {} as Record<string, Record<string, number>>;
  for (const group of Object.keys(DEFAULT_TUNABLES) as (keyof Tunables)[]) {
    const defaults = DEFAULT_TUNABLES[group] as Record<string, number>;
    const specs = TUNABLE_SPECS[group].fields as Record<string, TunableSpec>;
    out[group] = {};
    for (const k of Object.keys(defaults)) out[group]![k] = clamp(src[group]?.[k], specs[k]!, defaults[k]!);
  }
  const t = out as unknown as Tunables;
  // Pairs that only make sense in one order.
  if (t.calories.metMax < t.calories.metMin) t.calories.metMax = t.calories.metMin;
  if (t.calories.densityHigh <= t.calories.densityLow) t.calories.densityHigh = t.calories.densityLow + 10;
  if (t.coach.repFloor >= t.coach.repCeiling) t.coach.repFloor = Math.max(1, t.coach.repCeiling - 1);
  if (t.phase.cutDeficitMax < t.phase.cutDeficitMin) t.phase.cutDeficitMax = t.phase.cutDeficitMin;
  if (t.phase.bulkSurplusMax < t.phase.bulkSurplusMin) t.phase.bulkSurplusMax = t.phase.bulkSurplusMin;
  return t;
}

let source: () => Tunables = () => DEFAULT_TUNABLES;

/** Set once by lib/remote-config, so this module has no store import and stays easy to test. */
export function setTunablesSource(fn: () => Tunables): void {
  source = fn;
}

/** The values in force now. */
export function tunables(): Tunables {
  return source();
}
