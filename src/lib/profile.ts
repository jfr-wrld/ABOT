import { PROFILE_LIMITS } from "@/types/workout";
import type { Exercise, PersonalRecord, WorkoutSession } from "@/types/workout";
import { buildPRTable, estimate1RM, isWorkingSet, sessionDurationSec, sessionVolume } from "./calc";
import { weekStreak } from "./analytics";

export interface ProfileStats {
  workouts: number;
  /** Completed working sets (warm-ups left out). */
  sets: number;
  volumeKg: number;
  trainingSec: number;
  firstWorkoutAt: number | null;
  weekStreak: number;
}

/** Lifetime numbers for the profile, from finished workouts only. */
export function profileStats(
  sessions: WorkoutSession[],
  byId: Record<string, Exercise>,
  now: number,
  firstDay: 0 | 1,
): ProfileStats {
  const done = sessions.filter((s) => s.status === "completed");
  let sets = 0;
  let volumeKg = 0;
  let trainingSec = 0;
  let firstWorkoutAt: number | null = null;
  for (const s of done) {
    for (const ex of s.exercises) for (const set of ex.sets) if (set.completed && isWorkingSet(set)) sets++;
    volumeKg += sessionVolume(s, byId);
    trainingSec += sessionDurationSec(s);
    if (firstWorkoutAt === null || s.startedAt < firstWorkoutAt) firstWorkoutAt = s.startedAt;
  }


  return {
    workouts: done.length,
    sets,
    volumeKg,
    trainingSec,
    firstWorkoutAt,
    weekStreak: weekStreak(done, now, firstDay),
  };
}

/** "Jafar Shodiq Akram" -> "JA"; empty -> null (the avatar then shows the plate mark). */
/**
 * A handle as social apps write it: no leading "@", no spaces, only letters, digits, dots and
 * underscores, at most 30 characters.
 */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, PROFILE_LIMITS.handleMax);
}

export function initials(name: string): string | null {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}

export interface LiftRow {
  exercise: Exercise;
  /** Best estimated 1RM across gyms, with the set it came from. */
  best: PersonalRecord;
  /** Best e1RM per workout, oldest first, last twelve. */
  points: { date: number; e1rmKg: number }[];
  /** e1RM change against four weeks earlier, %; null without that history. */
  changePct: number | null;
  /** Records (heaviest, best 1RM, best set volume) this lift holds, all time. */
  records: number;
  lastDone: number;
}

const DAY = 86_400_000;

/**
 * Every weighted lift you have done, strongest first: best e1RM, the last twelve workouts as a
 * line, the change against four weeks before, and when it was last done. One list for the Lifts
 * tab, in place of a top three on one tab and "main lifts" on another.
 */
export function liftBoard(sessions: WorkoutSession[], byId: Record<string, Exercise>): LiftRow[] {
  const done = sessions.filter((s) => s.status === "completed").sort((a, b) => a.startedAt - b.startedAt);
  const table = buildPRTable(done, byId, { allGyms: true });
  const rows: LiftRow[] = [];
  for (const [id, prs] of Object.entries(table)) {
    const exercise = byId[id];
    const best = prs.best_1rm;
    if (!exercise || !best || exercise.isBodyweight) continue;
    const points: { date: number; e1rmKg: number }[] = [];
    for (const s of done) {
      let top = 0;
      for (const e of s.exercises) {
        if (e.exerciseId !== id) continue;
        for (const st of e.sets) {
          if (!st.completed || !isWorkingSet(st) || !st.weightKg || !st.reps) continue;
          top = Math.max(top, estimate1RM(st.weightKg, st.reps));
        }
      }
      if (top > 0) points.push({ date: s.startedAt, e1rmKg: Math.round(top * 10) / 10 });
    }
    if (points.length === 0) continue;
    const latest = points[points.length - 1]!;
    const before = [...points].reverse().find((p) => p.date <= latest.date - 28 * DAY);
    rows.push({
      exercise,
      best,
      points: points.slice(-12),
      changePct: before ? Math.round(((latest.e1rmKg - before.e1rmKg) / before.e1rmKg) * 1000) / 10 : null,
      records: Object.values(prs).filter(Boolean).length,
      lastDone: latest.date,
    });
  }
  return rows.sort((a, b) => b.best.value - a.best.value);
}
