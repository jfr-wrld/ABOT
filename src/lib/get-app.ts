import { UPDATE_REPO } from "@/lib/app-update";

/**
 * The web app's pitch for the Android app. The APK comes from GitHub Releases: CI uploads every
 * signed build also as abot.apk, so this one link is always the newest. The web app only links
 * to it and fetches nothing (zero-network rule).
 */
export const APK_URL = `https://github.com/${UPDATE_REPO}/releases/latest/download/abot.apk`;
/** minSdkVersion 26 (android/variables.gradle). */
export const MIN_ANDROID = "8.0";

export type GetAppPlatform = "native" | "android" | "ios" | "desktop";

/** Where the web app runs: Android and iPhone/iPad browsers, anything else counts as desktop. */
export function detectPlatform(ua: string, native: boolean, maxTouchPoints = 0): GetAppPlatform {
  if (native) return "native";
  if (/Android/i.test(ua)) return "android";
  // iPadOS 13+ says "Macintosh"; only touch tells it apart.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return "ios";
  return "desktop";
}

/** Moments the pitch may appear. Each contextual one shows at most once. */
export type NudgeTrigger = "banner" | "first-workout" | "reminders" | "rest-timer";

export interface NudgeMemory {
  /** The banner stays away until then (ms). */
  bannerUntil: number;
  /** "Don't show again": no nudge anywhere, ever (Settings still has the row). */
  never: boolean;
  /** Contextual nudges already shown. */
  shown: Partial<Record<NudgeTrigger, true>>;
}

export const BANNER_LATER_MS = 14 * 86_400_000;
const KEY = "abot.getApp";
const SESSION_KEY = "abot.getApp.session";

export const emptyMemory = (): NudgeMemory => ({ bannerUntil: 0, never: false, shown: {} });

/**
 * Whether a nudge may show: never after "Don't show again", once per trigger, and one kind per
 * visit. `sessionNudge` is the one already shown this visit: that same one may show again (Home
 * redraws when the language changes, and the banner must not hide itself).
 */
export function shouldNudge(m: NudgeMemory, trigger: NudgeTrigger, now: number, sessionNudge: SessionNudge | null): boolean {
  if (m.never || (sessionNudge !== null && sessionNudge !== trigger)) return false;
  if (trigger === "banner") return now >= m.bannerUntil;
  return !m.shown[trigger] || sessionNudge === trigger;
}

export function readMemory(): NudgeMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<NudgeMemory> | null;
    if (!raw || typeof raw !== "object") return emptyMemory();
    return {
      bannerUntil: typeof raw.bannerUntil === "number" ? raw.bannerUntil : 0,
      never: raw.never === true,
      shown: raw.shown && typeof raw.shown === "object" ? raw.shown : {},
    };
  } catch {
    return emptyMemory();
  }
}

export function writeMemory(m: NudgeMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Private mode or blocked storage: the nudge just comes back next time.
  }
}

/** The nudge shown this visit, or "closed" once the visitor closed it: then none comes back. */
export type SessionNudge = NudgeTrigger | "closed";
const SESSION_VALUES: SessionNudge[] = ["banner", "first-workout", "reminders", "rest-timer", "closed"];

/** The nudge already shown in this visit, if any. */
export function shownThisSession(): SessionNudge | null {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    return SESSION_VALUES.includes(v as SessionNudge) ? (v as SessionNudge) : null;
  } catch {
    return null;
  }
}

export function markSession(trigger: SessionNudge): void {
  try {
    sessionStorage.setItem(SESSION_KEY, trigger);
  } catch {
    // As above.
  }
}
