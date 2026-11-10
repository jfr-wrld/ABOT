import type { LogType } from "@/types/workout";

/**
 * Column template shared by the set header and every set row so they always align.
 * Fixed tracks are the narrowest that still fit "102.5" / "10" / "8.5" in 18px JetBrains Mono
 * (10.8px per digit) and a 44px tap target; whatever is left goes to Prev (about 58px on a
 * 360px phone with RPE on). A timed set has one wide Time column where weight and reps sit;
 * a cardio set has distance ("12.25") and time ("28:10").
 */
export function setGridColumns(showRpe: boolean, logType?: LogType): string {
  const rpe = showRpe ? "40px " : "";
  if (logType === "duration") return `44px minmax(0,1fr) 108px ${rpe}44px`;
  if (logType === "distance_duration") return `44px minmax(0,1fr) 52px 64px ${rpe}44px`;
  return `44px minmax(0,1fr) 60px 44px ${rpe}44px`;
}
