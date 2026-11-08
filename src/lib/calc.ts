import type {
  PersonalRecord,
  PRKind,
  SessionSummary,
  WorkoutSession,
  WorkoutSet,
  ExerciseHistoryPoint,
  MuscleGroup,
  Exercise,
} from "@/types/workout";

const KG_PER_LB = 0.45359237;

export const kgToLbs = (kg: number) => kg / KG_PER_LB;
export const lbsToKg = (lbs: number) => lbs * KG_PER_LB;

/** Round to the nearest 0.5 for display. */
export const roundHalf = (n: number) => Math.round(n * 2) / 2;

/**
 * Epley formula: 1RM = w × (1 + r / 30).
 * For 1 rep the lift *is* the 1RM. Returns 0 for incomplete/invalid sets.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Only completed, non-warm-up sets with both weight and reps count toward volume/PRs. */
export function isWorkingSet(set: WorkoutSet): boolean {
  return (
    set.completed &&
    set.type !== "warmup" &&
    set.weightKg !== null &&
    set.reps !== null &&
    set.weightKg > 0 &&
    set.reps > 0
  );
}

export function setVolume(set: WorkoutSet): number {
  if (!isWorkingSet(set)) return 0;
  return (set.weightKg as number) * (set.reps as number);
}

export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + setVolume(set), 0),
    0,
  );
}

export function sessionDurationSec(session: WorkoutSession, now = Date.now()): number {
  const end = session.finishedAt ?? now;
  return Math.max(0, Math.floor((end - session.startedAt) / 1000));
}

export function countSets(session: WorkoutSession) {
  let total = 0;
  let completed = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      total++;
      if (set.completed) completed++;
    }
  }
  return { total, completed };
}

/* ------------------------------------------------------------------ */
/* Personal records                                                    */
/* ------------------------------------------------------------------ */

type PRTable = Record<string, Partial<Record<PRKind, PersonalRecord>>>;

function prValue(kind: PRKind, weightKg: number, reps: number): number {
  switch (kind) {
    case "heaviest_weight":
      return weightKg;
    case "best_1rm":
      return estimate1RM(weightKg, reps);
    case "best_set_volume":
      return weightKg * reps;
  }
}

const PR_KINDS: PRKind[] = ["heaviest_weight", "best_1rm", "best_set_volume"];

/**
 * Build the all-time PR table from completed sessions, ordered by time.
 * Ties do NOT create a new PR (first achiever keeps it).
 */
export function buildPRTable(sessions: WorkoutSession[]): PRTable {
  const table: PRTable = {};
  const ordered = [...sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.startedAt - b.startedAt);

  for (const session of ordered) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (!isWorkingSet(set)) continue;
        const w = set.weightKg as number;
        const r = set.reps as number;
        const bucket = (table[ex.exerciseId] ??= {});
        for (const kind of PR_KINDS) {
          const value = prValue(kind, w, r);
          const current = bucket[kind];
          if (!current || value > current.value) {
            bucket[kind] = {
              kind,
              exerciseId: ex.exerciseId,
              value,
              weightKg: w,
              reps: r,
              sessionId: session.id,
              setId: set.id,
              achievedAt: set.completedAt ?? session.startedAt,
            };
          }
        }
      }
    }
  }
  return table;
}

/**
 * PRs achieved in `session`, compared against all *other* completed sessions
 * that started before it. Works for both active and finished sessions so the
 * logger can show a live "🏆" badge as soon as a set is ticked.
 */
export function detectSessionPRs(
  session: WorkoutSession,
  allSessions: WorkoutSession[],
): PersonalRecord[] {
  const prior = allSessions.filter(
    (s) => s.id !== session.id && s.status === "completed" && s.startedAt < session.startedAt,
  );
  const baseline = buildPRTable(prior);
  const found: PersonalRecord[] = [];
  // Track best within this session so only the single best set per kind gets the badge.
  const best: PRTable = {};

  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      if (!isWorkingSet(set)) continue;
      const w = set.weightKg as number;
      const r = set.reps as number;
      for (const kind of PR_KINDS) {
        const value = prValue(kind, w, r);
        const prev = baseline[ex.exerciseId]?.[kind]?.value ?? 0;
        if (value <= prev) continue;
        const bucket = (best[ex.exerciseId] ??= {});
        if (!bucket[kind] || value > bucket[kind]!.value) {
          bucket[kind] = {
            kind,
            exerciseId: ex.exerciseId,
            value,
            weightKg: w,
            reps: r,
            sessionId: session.id,
            setId: set.id,
            achievedAt: set.completedAt ?? session.startedAt,
          };
        }
      }
    }
  }
  for (const byKind of Object.values(best)) {
    for (const pr of Object.values(byKind)) if (pr) found.push(pr);
  }
  return found;
}

export function summarizeSession(
  session: WorkoutSession,
  allSessions: WorkoutSession[],
  now = Date.now(),
): SessionSummary {
  const { total, completed } = countSets(session);
  return {
    totalVolumeKg: sessionVolume(session),
    totalSets: total,
    completedSets: completed,
    durationSec: sessionDurationSec(session, now),
    prs: detectSessionPRs(session, allSessions),
  };
}

/* ------------------------------------------------------------------ */
/* History / analytics helpers                                         */
/* ------------------------------------------------------------------ */

/** Most recent completed sets for an exercise, used for the "Previous" column. */
export function previousSets(
  exerciseId: string,
  sessions: WorkoutSession[],
  excludeSessionId?: string,
): WorkoutSet[] | null {
  const ordered = [...sessions]
    .filter((s) => s.status === "completed" && s.id !== excludeSessionId)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const s of ordered) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) {
      const done = ex.sets.filter((set) => set.completed);
      if (done.length) return done;
    }
  }
  return null;
}

export function exerciseHistory(
  exerciseId: string,
  sessions: WorkoutSession[],
): ExerciseHistoryPoint[] {
  const points: ExerciseHistoryPoint[] = [];
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    let bestW = 0,
      bestR = 0,
      best1rm = 0,
      vol = 0;
    let seen = false;
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (!isWorkingSet(set)) continue;
        seen = true;
        const w = set.weightKg as number;
        const r = set.reps as number;
        vol += w * r;
        const e = estimate1RM(w, r);
        if (e > best1rm) best1rm = e;
        if (w > bestW || (w === bestW && r > bestR)) {
          bestW = w;
          bestR = r;
        }
      }
    }
    if (seen)
      points.push({
        sessionId: s.id,
        date: s.startedAt,
        bestSetWeightKg: bestW,
        bestSetReps: bestR,
        estimated1RM: best1rm,
        volumeKg: vol,
      });
  }
  return points.sort((a, b) => a.date - b.date);
}

/**
 * Working-set count per muscle group. Primary muscle gets 1 set,
 * each secondary muscle gets 0.5 — the usual "fractional set" convention.
 */
export function muscleSplit(
  sessions: WorkoutSession[],
  exercisesById: Record<string, Exercise>,
): Partial<Record<MuscleGroup, number>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    for (const ex of s.exercises) {
      const def = exercisesById[ex.exerciseId];
      if (!def) continue;
      const n = ex.sets.filter(isWorkingSet).length;
      if (!n) continue;
      out[def.primaryMuscle] = (out[def.primaryMuscle] ?? 0) + n;
      for (const m of def.secondaryMuscles) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  }
  return out;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
