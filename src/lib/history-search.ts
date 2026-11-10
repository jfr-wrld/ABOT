import type { Exercise, WorkoutSession } from "@/types/workout";
import { trainingFocus, type FocusLabel } from "./training-focus";

export interface HistoryFilter {
  /** Matches the workout's name or any of its exercises' names, ignoring case. */
  query: string;
  focus: FocusLabel | "";
  /** Gym id; "" for any. */
  gym: string;
}

/**
 * Every finished workout, newest first, narrowed by the filter. Home shows the last ten; this
 * is the rest of the log, kept on the phone with no limit.
 */
export function filterHistory(sessions: WorkoutSession[], byId: Record<string, Exercise>, f: HistoryFilter): WorkoutSession[] {
  const q = f.query.trim().toLowerCase();
  return sessions
    .filter((s) => s.status === "completed")
    .filter((s) => !f.gym || s.locationId === f.gym)
    .filter((s) => !f.focus || trainingFocus([s], byId)?.label === f.focus)
    .filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.exercises.some((e) => (byId[e.exerciseId]?.name ?? "").toLowerCase().includes(q)),
    )
    .sort((a, b) => b.startedAt - a.startedAt);
}

/** The focus labels that occur in the log, in the usual order, for the filter chips. */
export function focusesIn(sessions: WorkoutSession[], byId: Record<string, Exercise>): FocusLabel[] {
  const order: FocusLabel[] = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body", "Core", "Cardio"];
  const seen = new Set(sessions.filter((s) => s.status === "completed").map((s) => trainingFocus([s], byId)?.label));
  return order.filter((l) => seen.has(l));
}

/** Workouts grouped by calendar month (local time), keeping their order. */
export function byMonth(sessions: WorkoutSession[]): { month: number; sessions: WorkoutSession[] }[] {
  const out: { month: number; sessions: WorkoutSession[] }[] = [];
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const month = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const last = out[out.length - 1];
    if (last && last.month === month) last.sessions.push(s);
    else out.push({ month, sessions: [s] });
  }
  return out;
}
