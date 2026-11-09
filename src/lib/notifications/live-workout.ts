import type { Exercise, WorkoutSession } from "@/types/workout";
import { currentT, type T } from "@/i18n";

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

const clock = (ts: number, t: T) => new Date(ts).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" });

/** The first exercise with an unticked set, and which set that is. */
export function nextUp(
  session: WorkoutSession,
  byId: Record<string, Exercise>,
  t: T = currentT(),
): { name: string; set: number; of: number } | null {
  for (const ex of session.exercises) {
    const i = ex.sets.findIndex((s) => !s.completed);
    if (i >= 0) return { name: byId[ex.exerciseId]?.name ?? t("Exercise"), set: i + 1, of: ex.sets.length };
  }
  return null;
}

/** Workout name on the left of the title, the live figure on the right; the next set below. */
export function liveContent(
  session: WorkoutSession,
  byId: Record<string, Exercise>,
  rest: LiveRest | null,
  now: number,
  t: T = currentT(),
): LiveContent {
  const next = nextUp(session, byId, t);
  const nextText = next
    ? t("Next: {name}, set {set} of {of}", { name: next.name, set: next.set, of: next.of })
    : t("All sets done. Tap to finish.");
  if (rest && rest.endsAt > now) {
    return { title: `${session.name} · ${t("rest until {time}", { time: clock(rest.endsAt, t) })}`, body: nextText };
  }
  if (rest) return { title: `${session.name} · ${t("rest over")}`, body: nextText };
  return { title: `${session.name} · ${t("since {time}", { time: clock(session.startedAt, t) })}`, body: nextText };
}

/** What the Android app's live notification shows (built in src/lib/live-capsule.ts). */
export interface NativeLive {
  title: string;
  text: string;
  /** The workout clock's zero: the start, moved later by the time spent paused. */
  clockStart: number;
  /** Set while paused: workout time so far, shown frozen under pausedTitle. */
  pausedElapsed?: number;
  pausedTitle: string;
  /** A running rest: countdown to restEndsAt under restTitle and restText, then overTitle and overText. */
  restEndsAt?: number;
  restTitle?: string;
  restText?: string;
  overTitle?: string;
  overText?: string;
  /** Rest alert: whether the end of a rest rings. Unset means it rings. */
  ring?: boolean;
  /** Shown only while a rest counts down. */
  restOnly?: boolean;
  /** The next set has weight and reps, so the Log set button can tick it. */
  canLog?: boolean;
  /** The rest Android starts when Log set is tapped while ABOT is frozen. */
  logRestSec?: number;
  loggedTitle?: string;
  loggedText?: string;
  addLabel?: string;
  skipLabel?: string;
  logLabel?: string;
  pauseLabel?: string;
  resumeLabel?: string;
  /** Short text for the status bar chip while paused, when no clock runs (Android 16). */
  pausedChip?: string;
  /** Sets per exercise, and sets done: a segmented progress bar (Android 16 ProgressStyle). */
  progressSegments?: number[];
  progressDone?: number;
  /** Which exercise `photo` shows; the photo is sent only when it changes. */
  photoKey?: string;
  /** The next exercise's photo, base64 (WebP or JPEG), shown as the large icon. */
  photo?: string;
}
