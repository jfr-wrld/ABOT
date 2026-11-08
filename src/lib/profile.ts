import { PROFILE_LIMITS } from "@/types/workout";
import type { Exercise, PersonalRecord, WorkoutSession } from "@/types/workout";
import { buildPRTable, isWorkingSet, sessionDurationSec, sessionVolume } from "./calc";
import { weekStreak } from "./analytics";

export interface TopLift {
  exercise: Exercise;
  record: PersonalRecord;
}

export interface ProfileStats {
  workouts: number;
  /** Completed working sets (warm-ups left out). */
  sets: number;
  volumeKg: number;
  trainingSec: number;
  firstWorkoutAt: number | null;
  weekStreak: number;
  /** Best estimated 1RMs across all gyms, highest first, at most three. */
  topLifts: TopLift[];
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

  const table = buildPRTable(done, byId, { allGyms: true });
  const topLifts = Object.entries(table)
    .flatMap(([id, prs]) => {
      const exercise = byId[id];
      const record = prs.best_1rm;
      return exercise && record && !exercise.isBodyweight ? [{ exercise, record }] : [];
    })
    .sort((a, b) => b.record.value - a.record.value)
    .slice(0, 3);

  return {
    workouts: done.length,
    sets,
    volumeKg,
    trainingSec,
    firstWorkoutAt,
    weekStreak: weekStreak(done, now, firstDay),
    topLifts,
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
