import type { Exercise, MuscleGroup, WorkoutSession, WorkoutSet } from "@/types/workout";
import { REGIONS, regionsFor, type Region } from "@/components/anatomy/regions";

/**
 * Muscle fatigue over time, for the recovery map.
 *
 * Every working set adds fatigue to the muscles it trains: 15% to each primary muscle, 7.5% to
 * each secondary one, scaled by RPE when it was logged (RPE 8 counts as is, 10 as 1.25x, 6 as
 * 0.75x). Fatigue is capped at 100% and falls in a straight line: a big muscle is back to 0 in
 * 72 hours (about 1.4% an hour), a small one in 48. Nothing is stored; the state is worked out
 * from the history each time, so edited or imported workouts count straight away.
 *
 * Last night's sleep, when Health Connect has it, scales that speed: 8 hours is the normal
 * rate, less sleep slows recovery (down to 0.7x at 5h36m or less), more speeds it slightly (at
 * most 1.1x). Sleep that ended over a day ago is ignored.
 */

export const PRIMARY_FATIGUE = 15;
export const SECONDARY_FATIGUE = 7.5;
/** At or below this a muscle counts as ready to train. */
export const READY_AT = 20;

const BIG: ReadonlySet<MuscleGroup> = new Set(["chest", "back", "lats", "quads", "hamstrings", "glutes", "lower_back"]);

/** Hours for this muscle to go from 100% fatigue to none. */
export function recoveryHours(m: MuscleGroup): number {
  return BIG.has(m) ? 72 : 48;
}

const HOUR = 3_600_000;
/** Older sets cannot matter: even 100% is gone after 72 hours. Twice that covers any capping. */
const LOOKBACK = 144 * HOUR;

export interface Sleep {
  minutes: number;
  endAt: number;
}

/** How fast muscles recover after this sleep, against an 8 hour night. */
export function sleepFactor(sleep: Sleep | null | undefined, now: number): number {
  if (!sleep || now - sleep.endAt > 24 * HOUR || sleep.endAt > now) return 1;
  return Math.min(1.1, Math.max(0.7, sleep.minutes / 480));
}

/** RPE scales the load of a set: harder sets tire more. */
function rpeFactor(rpe: number | null): number {
  if (rpe === null) return 1;
  return Math.min(1.25, Math.max(0.75, rpe / 8));
}

/** Done and not a warm-up, with reps or a time: it loaded the muscle. */
function counts(set: WorkoutSet): boolean {
  return set.completed && set.type !== "warmup" && ((set.reps ?? 0) > 0 || (set.durationSec ?? 0) > 0);
}

/** Which muscles a set loads, and how hard. A full-body movement loads every muscle lightly. */
function loads(ex: Exercise | undefined): [MuscleGroup, number][] {
  if (!ex) return [];
  const out = new Map<MuscleGroup, number>();
  const add = (m: MuscleGroup, v: number) => {
    if (m === "cardio") return;
    if (m === "full_body") {
      for (const g of ALL_MUSCLES) out.set(g, Math.max(out.get(g) ?? 0, SECONDARY_FATIGUE));
      return;
    }
    out.set(m, Math.max(out.get(m) ?? 0, v));
  };
  for (const m of ex.secondaryMuscles) add(m, SECONDARY_FATIGUE);
  for (const m of ex.primaryMuscles) add(m, PRIMARY_FATIGUE);
  return [...out];
}

const ALL_MUSCLES: MuscleGroup[] = [
  "chest", "back", "lats", "traps", "lower_back", "shoulders", "biceps", "triceps", "forearms",
  "abs", "quads", "hamstrings", "glutes", "adductors", "abductors", "calves", "neck",
];

interface Hit {
  at: number;
  sessionId: string;
  loads: [MuscleGroup, number][];
}

/** Every counted set in the window, oldest first, with what it loaded. */
function hits(sessions: WorkoutSession[], byId: Record<string, Exercise>, now: number): Hit[] {
  const out: Hit[] = [];
  for (const s of sessions) {
    if (s.status === "discarded") continue;
    for (const ex of s.exercises) {
      const l = loads(byId[ex.exerciseId]);
      if (l.length === 0) continue;
      for (const set of ex.sets) {
        if (!counts(set)) continue;
        const at = set.completedAt ?? s.finishedAt ?? s.startedAt;
        if (at > now || now - at > LOOKBACK) continue;
        const f = rpeFactor(set.rpe);
        out.push({ at, sessionId: s.id, loads: l.map(([m, v]) => [m, v * f]) });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Fatigue per muscle (0 to 100) at `now`. */
export function muscleFatigue(
  sessions: WorkoutSession[],
  byId: Record<string, Exercise>,
  now: number,
  sleep?: Sleep | null,
): Partial<Record<MuscleGroup, number>> {
  const speed = sleepFactor(sleep, now);
  const rate = (m: MuscleGroup) => (100 / recoveryHours(m)) * speed;
  const level = new Map<MuscleGroup, { f: number; at: number }>();
  for (const h of hits(sessions, byId, now)) {
    for (const [m, v] of h.loads) {
      const prev = level.get(m);
      const decayed = prev ? Math.max(0, prev.f - ((h.at - prev.at) / HOUR) * rate(m)) : 0;
      level.set(m, { f: Math.min(100, decayed + v), at: h.at });
    }
  }
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const [m, { f, at }] of level) {
    const v = Math.max(0, f - ((now - at) / HOUR) * rate(m));
    if (v > 0) out[m] = v;
  }
  return out;
}

export type FatigueStage = "fresh" | "recovering" | "high" | "exhausted";

/** 0-20 fresh, 21-50 recovering, 51-80 high load, 81-100 exhausted. */
export function fatigueStage(f: number): FatigueStage {
  const p = Math.round(f);
  if (p <= READY_AT) return "fresh";
  if (p <= 50) return "recovering";
  if (p <= 80) return "high";
  return "exhausted";
}

export interface RegionTelemetry {
  /** 0 to 100, the most tired muscle drawn in this shape. */
  fatigue: number;
  stage: FatigueStage;
  /** Last set that trained it, or null if not in the last six days. */
  lastTrainedAt: number | null;
  /** Counted sets that trained it in that last session. */
  lastSets: number;
  /** Hours until it is back to READY_AT or below; 0 when ready. */
  readyInHours: number;
}

/** What each drawn shape shows: its fatigue, stage, last session and time to ready. */
export function regionTelemetry(
  sessions: WorkoutSession[],
  byId: Record<string, Exercise>,
  now: number,
  sleep?: Sleep | null,
): Record<Region, RegionTelemetry> {
  const speed = sleepFactor(sleep, now);
  const fatigue = muscleFatigue(sessions, byId, now, sleep);
  const all = hits(sessions, byId, now);
  const out = {} as Record<Region, RegionTelemetry>;
  for (const region of REGIONS) {
    const muscles = ALL_MUSCLES.filter((m) => regionsFor(m).includes(region));
    let f = 0;
    let ready = 0;
    for (const m of muscles) {
      const v = fatigue[m] ?? 0;
      f = Math.max(f, v);
      if (v > READY_AT) ready = Math.max(ready, Math.ceil((v - READY_AT) / ((100 / recoveryHours(m)) * speed)));
    }
    const touching = all.filter((h) => h.loads.some(([m]) => muscles.includes(m)));
    const last = touching[touching.length - 1];
    out[region] = {
      fatigue: f,
      stage: fatigueStage(f),
      lastTrainedAt: last?.at ?? null,
      lastSets: last ? touching.filter((h) => h.sessionId === last.sessionId).length : 0,
      readyInHours: ready,
    };
  }
  return out;
}

/** Spec colours for each stage; fresh is Carbon Steel with a thin light edge. */
export const STAGE_STYLE: Record<FatigueStage, { fill: string; opacity: number; stroke?: string }> = {
  fresh: { fill: "#27272a", opacity: 1, stroke: "rgb(255 255 255 / 0.35)" },
  recovering: { fill: "#ccff00", opacity: 0.5 },
  high: { fill: "#f59e0b", opacity: 1 },
  exhausted: { fill: "#ef4444", opacity: 1 },
};
