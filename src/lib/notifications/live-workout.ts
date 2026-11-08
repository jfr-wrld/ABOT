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

export function nativeLiveContent(
  session: WorkoutSession,
  byId: Record<string, Exercise>,
  rest: LiveRest | null,
  now: number,
  t: T = currentT(),
): NativeLive {
  const next = nextUp(session, byId, t);
  const lift = next ? t("{name}, set {set}/{of}", { name: next.name, set: next.set, of: next.of }) : null;
  const clockStart = session.startedAt + (session.pausedMs ?? 0);
  const base: NativeLive = {
    title: lift ?? t("All sets done"),
    text: lift ? session.name : `${session.name} · ${t("tap to finish")}`,
    clockStart,
    pausedTitle: lift ? `${t("Paused")} · ${lift}` : t("Paused"),
  };
  if (session.pausedAt !== undefined) return { ...base, pausedElapsed: Math.max(0, session.pausedAt - clockStart) };
  if (!rest || rest.endsAt <= now || !lift) return base;
  return {
    ...base,
    restEndsAt: rest.endsAt,
    restTitle: `${t("Rest")} · ${t("next {lift}", { lift })}`,
    overTitle: `${t("Rest over")} · ${lift}`,
    overText: session.name,
  };
}
