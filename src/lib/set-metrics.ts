import type { LogType, WeightUnit, WorkoutSet } from "@/types/workout";
import { formatClock } from "@/lib/calc";
import { formatWeight } from "@/lib/units";

/**
 * Sets measured by time (plank, dead hang) or by distance and time (treadmill, rowing). Weight
 * and reps stay the default; the exercise's `logType` picks the columns.
 */
export function isTimed(logType: LogType | undefined): logType is "duration" | "distance_duration" {
  return logType === "duration" || logType === "distance_duration";
}

/**
 * "1:30" -> 90, "1:02:00" -> 3720. A plain number is seconds for a hold (45 means 0:45) and
 * minutes for a cardio set (30 means 30:00), the way people say them.
 */
export function parseClock(text: string, plain: "sec" | "min"): number | null {
  const s = text.trim();
  if (!s) return null;
  if (/^\d+(?:[.,]\d+)?$/.test(s)) {
    const n = Number(s.replace(",", "."));
    return Math.round(plain === "min" ? n * 60 : n);
  }
  const parts = s.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((total, n) => total * 60 + n, 0);
}

/** 90 -> "1:30", 3720 -> "1:02:00". */
export function clockText(sec: number): string {
  if (sec < 3600) return formatClock(sec);
  const h = Math.floor(sec / 3600);
  return `${h}:${formatClock(sec % 3600).padStart(5, "0")}`;
}

/** Kilometres when weights are in kg, miles when they are in lbs. */
export function distanceUnit(unit: WeightUnit): "km" | "mi" {
  return unit === "lbs" ? "mi" : "km";
}

const METRES_PER: Record<"km" | "mi", number> = { km: 1000, mi: 1609.344 };

export function toDistance(m: number, unit: WeightUnit): number {
  return Math.round((m / METRES_PER[distanceUnit(unit)]) * 100) / 100;
}

export function fromDistance(value: number, unit: WeightUnit): number {
  return Math.round(value * METRES_PER[distanceUnit(unit)]);
}

/** A set with what its exercise records: something to save when it is ticked. */
export function hasMeasure(set: Pick<WorkoutSet, "reps" | "durationSec" | "distanceM">, logType: LogType | undefined): boolean {
  if (logType === "duration") return (set.durationSec ?? 0) > 0;
  if (logType === "distance_duration") return (set.durationSec ?? 0) > 0 || (set.distanceM ?? 0) > 0;
  return set.reps !== null && set.reps > 0;
}

/**
 * One set as text, for history and lists: "1:30", "5 km · 28:10", "80 kg × 8", "12 reps".
 * `reps` is the caller's translated "{n} reps".
 */
export function setText(
  set: Pick<WorkoutSet, "weightKg" | "reps" | "durationSec" | "distanceM">,
  logType: LogType | undefined,
  unit: WeightUnit,
  opts: { isBodyweight?: boolean; reps: (n: number) => string },
): string {
  if (isTimed(logType) || (set.reps === null && (set.durationSec || set.distanceM))) {
    const parts: string[] = [];
    if (set.distanceM) parts.push(`${toDistance(set.distanceM, unit)} ${distanceUnit(unit)}`);
    if (set.durationSec) parts.push(clockText(set.durationSec));
    if (parts.length) return parts.join(" · ");
  }
  if (opts.isBodyweight || set.weightKg === null || set.weightKg <= 0) return opts.reps(set.reps ?? 0);
  return `${formatWeight(set.weightKg, unit)} × ${set.reps ?? 0}`;
}
