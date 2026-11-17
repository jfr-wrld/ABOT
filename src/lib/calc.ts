import type {
  PersonalRecord,
  PRKind,
  WorkoutSession,
  WorkoutSet,
  ExerciseHistoryPoint,
  MuscleGroup,
  Exercise,
  LoadMode,
} from "@/types/workout";
import { currentT, type T } from "@/i18n";

const KG_PER_LB = 0.45359237;

export const kgToLbs = (kg: number) => kg / KG_PER_LB;
export const lbsToKg = (lbs: number) => lbs * KG_PER_LB;

/**
 * Epley formula: 1RM = w × (1 + r / 30).
 * For 1 rep the lift *is* the 1RM. Returns 0 for incomplete/invalid sets.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Completed, non-warm-up sets with reps are working sets (they count toward muscle sets).
 * Weight may be empty or 0 for bodyweight work; such sets add no volume and set no load PR.
 */
export function isWorkingSet(set: WorkoutSet): boolean {
  return set.completed && set.type !== "warmup" && set.reps !== null && set.reps > 0;
}

/**
 * The load a set moved, in kg. A bodyweight set adds the body weight it lifted (taken when it was
 * ticked) to the added load, or takes off the assistance (negative weight), never below 0.
 * Older bodyweight sets have no body weight on record and count their added load only.
 */
export function setLoadKg(set: WorkoutSet): number | null {
  if (set.bodyLoadKg !== undefined) return Math.max(0, set.bodyLoadKg + (set.weightKg ?? 0));
  return set.weightKg;
}

/** A working set that also carries load, the only kind that can set a weight-based record. */
function isLoadedSet(set: WorkoutSet): boolean {
  const load = setLoadKg(set);
  return isWorkingSet(set) && load !== null && load > 0;
}

/**
 * Per-hand and one-side-at-a-time numbers are one side's load and reps; both sides moved it,
 * so tonnage counts twice (owner decision 2026-11-08).
 */
export function volumeFactor(mode: LoadMode): 1 | 2 {
  return mode === "total" ? 1 : 2;
}

export function setVolume(set: WorkoutSet, mode: LoadMode = "total"): number {
  if (!isLoadedSet(set)) return 0;
  return (setLoadKg(set) as number) * (set.reps as number) * volumeFactor(mode);
}

/** With `byId`, each exercise's load mode applies; without it every load counts once. */
export function sessionVolume(session: WorkoutSession, byId?: Record<string, Exercise>): number {
  return session.exercises.reduce((sum, ex) => {
    const mode = byId?.[ex.exerciseId]?.loadMode ?? "total";
    return sum + ex.sets.reduce((s, set) => s + setVolume(set, mode), 0);
  }, 0);
}

/**
 * Records and "previous" are compared within a variant: machine and cable exercises are
 * split per gym (a 60 kg stack differs between buildings), free weights are shared.
 */
export function variantKey(exerciseId: string, exercise: Exercise | undefined, locationId: string | undefined): string {
  return exercise?.isMachineDependent && locationId ? `${exerciseId}@${locationId}` : exerciseId;
}

function keyFor(exerciseId: string, session: WorkoutSession, byId?: Record<string, Exercise>, allGyms = false): string {
  return byId && !allGyms ? variantKey(exerciseId, byId[exerciseId], session.locationId) : exerciseId;
}

export interface VariantOptions {
  byId?: Record<string, Exercise>;
  /** Gym to compare within; machine exercises only match sessions at this gym. */
  locationId?: string;
  /** Ignore gyms (one combined view) while still applying load modes from `byId`. */
  allGyms?: boolean;
}

export function matchesVariant(exerciseId: string, session: WorkoutSession, opts?: VariantOptions): boolean {
  if (!opts?.byId || opts.allGyms) return true;
  const target = variantKey(exerciseId, opts.byId[exerciseId], opts.locationId);
  return keyFor(exerciseId, session, opts.byId) === target;
}

/** Time trained: start to finish (or now), minus every pause, including one still running. */
export function sessionDurationSec(session: WorkoutSession, now = Date.now()): number {
  const end = session.finishedAt ?? now;
  const paused = (session.pausedMs ?? 0) + (session.pausedAt !== undefined ? Math.max(0, end - session.pausedAt) : 0);
  return Math.max(0, Math.floor((end - session.startedAt - paused) / 1000));
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

export type PRTable = Record<string, Partial<Record<PRKind, PersonalRecord>>>;

/** `factor` is the load-mode volume factor: set volume for a pair of dumbbells counts both. */
function prValue(kind: PRKind, weightKg: number, reps: number, factor: 1 | 2 = 1): number {
  switch (kind) {
    case "heaviest_weight":
      return weightKg;
    case "best_1rm":
      return estimate1RM(weightKg, reps);
    case "best_set_volume":
      return weightKg * reps * factor;
  }
}

const PR_KINDS: PRKind[] = ["heaviest_weight", "best_1rm", "best_set_volume"];

/**
 * Build the all-time PR table from completed sessions, ordered by time.
 * Ties do NOT create a new PR (first achiever keeps it).
 */
/**
 * Keys are exercise ids, or variant keys ("id@location") when `byId` is given and the
 * exercise is machine dependent. Use `variantKey` to look a record up.
 */
export function buildPRTable(
  sessions: WorkoutSession[],
  byId?: Record<string, Exercise>,
  opts?: { allGyms?: boolean },
): PRTable {
  const table: PRTable = {};
  const ordered = [...sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const session of ordered) addToPRTable(table, session, byId, opts?.allGyms);
  return table;
}

/** Folds one session's sets into `table`, in place. Sessions must come oldest first. */
function addToPRTable(table: PRTable, session: WorkoutSession, byId?: Record<string, Exercise>, allGyms?: boolean): void {
  {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (!isLoadedSet(set)) continue;
        const w = setLoadKg(set) as number;
        const r = set.reps as number;
        const bucket = (table[keyFor(ex.exerciseId, session, byId, allGyms)] ??= {});
        for (const kind of PR_KINDS) {
          const value = prValue(kind, w, r, volumeFactor(byId?.[ex.exerciseId]?.loadMode ?? "total"));
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
}

/**
 * The records `session` is measured against: every other completed session that started before
 * it. The logger works this out once per workout instead of on every keystroke.
 */
export function priorPRTable(
  session: Pick<WorkoutSession, "id" | "startedAt">,
  allSessions: WorkoutSession[],
  byId?: Record<string, Exercise>,
): PRTable {
  const prior = allSessions.filter(
    (s) => s.id !== session.id && s.status === "completed" && s.startedAt < session.startedAt,
  );
  return buildPRTable(prior, byId);
}

/**
 * PRs achieved in `session`, compared against all *other* completed sessions
 * that started before it. Works for both active and finished sessions so the
 * logger can show a live "🏆" badge as soon as a set is ticked.
 */
export function detectSessionPRs(
  session: WorkoutSession,
  allSessions: WorkoutSession[],
  byId?: Record<string, Exercise>,
  baseline: PRTable = priorPRTable(session, allSessions, byId),
): PersonalRecord[] {
  const found: PersonalRecord[] = [];
  // Track best within this session so only the single best set per kind gets the badge.
  const best: PRTable = {};

  for (const ex of session.exercises) {
    const key = keyFor(ex.exerciseId, session, byId);
    for (const set of ex.sets) {
      if (!isLoadedSet(set)) continue;
      const w = setLoadKg(set) as number;
      const r = set.reps as number;
      for (const kind of PR_KINDS) {
        const value = prValue(kind, w, r, volumeFactor(byId?.[ex.exerciseId]?.loadMode ?? "total"));
        const prev = baseline[key]?.[kind]?.value ?? 0;
        if (value <= prev) continue;
        const bucket = (best[key] ??= {});
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

/**
 * Records that beat a value already on the books. A first leg press at a second gym, or a first
 * pull-up after importing ones with no load, has nothing to beat there: it sets a starting
 * point, not a record worth a badge or a count.
 */
export function recordsBeaten(
  session: WorkoutSession,
  allSessions: WorkoutSession[],
  byId?: Record<string, Exercise>,
  baseline: PRTable = priorPRTable(session, allSessions, byId),
): PersonalRecord[] {
  return detectSessionPRs(session, allSessions, byId, baseline).filter(
    (p) => baseline[keyFor(p.exerciseId, session, byId)]?.[p.kind] !== undefined,
  );
}

const beatenCache = new WeakMap<WorkoutSession[], { byId?: Record<string, Exercise>; counts: Record<string, number> }>();

/**
 * Lifts with a beaten record, per finished session, in one pass from oldest to newest with a
 * running table. Measuring each session against a table rebuilt from everything before it grew
 * with the square of the history. Cached per sessions array.
 */
export function beatenCounts(sessions: WorkoutSession[], byId?: Record<string, Exercise>): Record<string, number> {
  const hit = beatenCache.get(sessions);
  if (hit && hit.byId === byId) return hit.counts;
  const table: PRTable = {};
  const counts: Record<string, number> = {};
  const ordered = sessions.filter((s) => s.status === "completed").sort((a, b) => a.startedAt - b.startedAt);
  for (const s of ordered) {
    counts[s.id] = new Set(recordsBeaten(s, [], byId, table).map((p) => p.exerciseId)).size;
    addToPRTable(table, s, byId);
  }
  beatenCache.set(sessions, { byId, counts });
  return counts;
}

/* ------------------------------------------------------------------ */
/* History / analytics helpers                                         */
/* ------------------------------------------------------------------ */

/** Most recent completed sets for an exercise, used for the "Previous" column. */
export function previousSets(
  exerciseId: string,
  sessions: WorkoutSession[],
  excludeSessionId?: string,
  opts?: VariantOptions,
): WorkoutSet[] | null {
  const ordered = [...sessions]
    .filter((s) => s.status === "completed" && s.id !== excludeSessionId && matchesVariant(exerciseId, s, opts))
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

/**
 * Last time's set that matches set `i` of today: warm-ups line up with warm-ups and working
 * sets with working sets, each by its place among its own kind. By plain position, two warm-ups
 * last time would put 40 and 60 kg against today's first working sets.
 */
export function previousFor(
  sets: readonly Pick<WorkoutSet, "type">[],
  i: number,
  previous: readonly WorkoutSet[] | null | undefined,
): WorkoutSet | undefined {
  const set = sets[i];
  if (!set || !previous?.length) return undefined;
  const warm = (x: Pick<WorkoutSet, "type">) => x.type === "warmup";
  const kind = warm(set);
  let k = 0;
  for (let j = 0; j < i; j++) if (warm(sets[j]!) === kind) k++;
  return previous.filter((p) => warm(p) === kind)[k];
}

export function exerciseHistory(
  exerciseId: string,
  sessions: WorkoutSession[],
  opts?: VariantOptions,
): ExerciseHistoryPoint[] {
  const points: ExerciseHistoryPoint[] = [];
  for (const s of sessions) {
    if (s.status !== "completed" || !matchesVariant(exerciseId, s, opts)) continue;
    let bestW = 0,
      bestR = 0,
      best1rm = 0,
      vol = 0;
    let seen = false;
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (!isLoadedSet(set)) continue;
        seen = true;
        const w = setLoadKg(set) as number;
        const r = set.reps as number;
        vol += w * r * volumeFactor(opts?.byId?.[exerciseId]?.loadMode ?? "total");
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
      for (const m of def.primaryMuscles) out[m] = (out[m] ?? 0) + n;
      for (const m of def.secondaryMuscles) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  }
  return out;
}

/** "1h 5m", "5m 03s"; in Indonesian "1 j 5 mnt", where a bare "m" reads as metres. */
export function formatDuration(sec: number, t: T = currentT()): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return t("{h}h {m}m", { h, m });
  if (m > 0) return t("{m}m {s}s", { m, s: s.toString().padStart(2, "0") });
  return t("{s}s", { s });
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
