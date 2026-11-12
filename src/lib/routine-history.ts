import type { WorkoutSession } from "@/types/workout";
import type { T } from "@/i18n";

const DAY = 86_400_000;
const midnight = (at: number) => {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** When each routine was last trained (a finished workout started from it), by routine id. */
export function lastDoneByRoutine(sessions: WorkoutSession[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    if (s.status !== "completed" || !s.routineId) continue;
    if (s.startedAt > (out[s.routineId] ?? 0)) out[s.routineId] = s.startedAt;
  }
  return out;
}

/** "Last done today", "yesterday", "3 days ago", counted in calendar days; or "Not done yet". */
export function lastDoneText(at: number | undefined, now: number, t: T): string {
  if (at === undefined) return t("Not done yet");
  const days = Math.round((midnight(now) - midnight(at)) / DAY);
  const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(t.locale, { numeric: "auto" }) : null;
  const when = rtf ? rtf.format(-days, "day") : t("{n} days ago", { n: days });
  return t("Last done {when}", { when });
}
