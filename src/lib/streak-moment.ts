import type { WorkoutSession } from "@/types/workout";
import { startOfWeek, weekStreak } from "./analytics";

/** How many weeks the streak screen draws as plates, the current week last. */
export const STREAK_WEEKS = 5;
/** A summary opened later (from History) is not the moment the streak grew. */
const FRESH_MS = 15 * 60_000;

export interface StreakMoment {
  before: number;
  after: number;
  /** Trained or not, oldest first; the last entry is this week. */
  weeks: boolean[];
}

/**
 * The week streak this workout grew, or null when it did not (a second workout in the same week,
 * a workout logged for an older date, or a summary opened long after Finish).
 */
export function streakMoment(
  sessions: WorkoutSession[],
  sessionId: string,
  now = Date.now(),
  firstDay: 0 | 1 = 1,
): StreakMoment | null {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session || session.status !== "completed") return null;
  if (now - (session.finishedAt ?? session.startedAt) > FRESH_MS) return null;
  const after = weekStreak(sessions, now, firstDay);
  const before = weekStreak(
    sessions.filter((s) => s.id !== sessionId),
    now,
    firstDay,
  );
  if (after <= before) return null;
  return { before, after, weeks: weekRow(sessions, now, firstDay) };
}

/** Trained or not for the last STREAK_WEEKS weeks, oldest first, this week last. */
function weekRow(sessions: WorkoutSession[], now: number, firstDay: 0 | 1): boolean[] {
  const trained = new Set(sessions.filter((s) => s.status === "completed").map((s) => startOfWeek(s.startedAt, firstDay)));
  const weeks: boolean[] = [];
  const cursor = new Date(startOfWeek(now, firstDay));
  for (let i = 0; i < STREAK_WEEKS; i++) {
    weeks.unshift(trained.has(cursor.getTime()));
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

/**
 * The streak as it stands, to play again from Home: the count rolls up from one less to the
 * current number. Null without a streak.
 */
export function currentStreak(sessions: WorkoutSession[], now = Date.now(), firstDay: 0 | 1 = 1): StreakMoment | null {
  const after = weekStreak(sessions, now, firstDay);
  if (after === 0) return null;
  return { before: after - 1, after, weeks: weekRow(sessions, now, firstDay) };
}

const SHOWN_KEY = "abot.streak-shown";

/** The screen plays once per workout, even if the summary is reloaded. */
export function streakAlreadyShown(sessionId: string): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === sessionId;
  } catch {
    return false;
  }
}

export function markStreakShown(sessionId: string): void {
  try {
    localStorage.setItem(SHOWN_KEY, sessionId);
  } catch {
    // Storage blocked: at worst the screen plays again on a reload.
  }
}
