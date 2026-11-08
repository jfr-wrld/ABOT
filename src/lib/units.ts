import type { WeightUnit } from "@/types/workout";
import { kgToLbs, lbsToKg } from "./calc";

/** kg from storage -> number in the user's unit, rounded for display. */
export function toDisplay(kg: number, unit: WeightUnit): number {
  const v = unit === "kg" ? kg : kgToLbs(kg);
  return Math.round(v * 100) / 100;
}

/** Typed value in the user's unit -> kg for storage. */
export function fromDisplay(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : lbsToKg(value);
}

export function formatWeight(kg: number, unit: WeightUnit, withUnit = true): string {
  const v = toDisplay(kg, unit);
  const s = Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(/\.0$/, "");
  return withUnit ? `${s} ${unit}` : s;
}

/** Big numbers in the header: 12 345 -> "12.3k". */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = toDisplay(kg, unit);
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}
