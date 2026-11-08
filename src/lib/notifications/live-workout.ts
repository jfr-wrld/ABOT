import type { Exercise, WorkoutSession } from "@/types/workout";

/**
 * The status notification shown while a workout runs and ABOT is not on screen: the closest a
 * web app gets to a phone's live activity. iOS Dynamic Island and Android live updates are only
 * open to native apps, and a page in the background cannot tick a clock, so the text names fixed
 * times ("rest until 14:32") that stay true without updating.
 */

export const LIVE_TAG = "abot-live-workout";

export interface LiveRest {
  endsAt: number;
}

export interface LiveContent {
  title: string;
  body: string;
}

const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** The first exercise with an unticked set, and which set that is. */
export function nextUp(session: WorkoutSession, byId: Record<string, Exercise>): { name: string; set: number; of: number } | null {
  for (const ex of session.exercises) {
    const i = ex.sets.findIndex((s) => !s.completed);
    if (i >= 0) return { name: byId[ex.exerciseId]?.name ?? "Exercise", set: i + 1, of: ex.sets.length };
  }
  return null;
}

/** Workout name on the left of the title, the live figure on the right; the next set below. */
export function liveContent(
  session: WorkoutSession,
  byId: Record<string, Exercise>,
  rest: LiveRest | null,
  now: number,
): LiveContent {
  const next = nextUp(session, byId);
  const nextText = next ? `Next: ${next.name}, set ${next.set} of ${next.of}` : "All sets done. Tap to finish.";
  if (rest && rest.endsAt > now) {
    return { title: `${session.name} · rest until ${clock(rest.endsAt)}`, body: nextText };
  }
  if (rest) return { title: `${session.name} · rest over`, body: nextText };
  return { title: `${session.name} · since ${clock(session.startedAt)}`, body: nextText };
}

/** What the Android app's live notification shows; Android draws and ticks the clock itself. */
export interface NativeLive {
  title: string;
  text: string;
  /** The workout clock's zero: the start, moved later by the time spent paused. */
  clockStart: number;
  /** Set while paused: workout time so far, shown frozen under pausedTitle. */
  pausedElapsed?: number;
  pausedTitle: string;
  /** A running rest: countdown to restEndsAt under restTitle, then overTitle and overText. */
  restEndsAt?: number;
  restTitle?: string;
  overTitle?: string;
  overText?: string;
}

export function nativeLiveContent(session: WorkoutSession, byId: Record<string, Exercise>, rest: LiveRest | null, now: number): NativeLive {
  const next = nextUp(session, byId);
  const lift = next ? `${next.name}, set ${next.set}/${next.of}` : null;
  const clockStart = session.startedAt + (session.pausedMs ?? 0);
  const base: NativeLive = {
    title: lift ?? "All sets done",
    text: lift ? session.name : `${session.name} · tap to finish`,
    clockStart,
    pausedTitle: lift ? `Paused · ${lift}` : "Paused",
  };
  if (session.pausedAt !== undefined) return { ...base, pausedElapsed: Math.max(0, session.pausedAt - clockStart) };
  if (!rest || rest.endsAt <= now || !lift) return base;
  return {
    ...base,
    restEndsAt: rest.endsAt,
    restTitle: `Rest · next ${lift}`,
    overTitle: `Rest over · ${lift}`,
    overText: session.name,
  };
}
