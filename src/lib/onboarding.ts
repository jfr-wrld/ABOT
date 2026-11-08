/**
 * Whether this device has seen the intro. It is a per-device convenience, not training data, so it
 * lives in localStorage and is left out of backups. Storage that throws (private mode, blocked
 * site data) counts as "seen": the intro must never stand between a lifter and the logger.
 */
const KEY = "abot.onboarded";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Nothing to do: hasSeenOnboarding() already treats unusable storage as seen.
  }
}
