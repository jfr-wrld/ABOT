import type { WeightUnit } from "@/types/workout";
import { kgToLbs, lbsToKg } from "./calc";

/** kg from storage -> number in the user's unit, rounded for display. */
export function toDisplay(kg: number, unit: WeightUnit): number {
  const v = unit === "kg" ? kg : kgToLbs(kg);
  return Math.round(v * 100) / 100;
}

const CM_PER_INCH = 2.54;

/** Height for lbs users. Rounds to the nearest inch, carrying 12 inches into a foot. */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}

/** Feet and inches back to cm for storage, to 0.1 cm. */
export function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * CM_PER_INCH * 10) / 10;
}

/**
 * A stored weight as it fills an input box. kg keeps two decimals (1.25 kg plates); lbs keeps one,
 * so a weight logged in kg reads 220.5 lbs instead of 220.46, while 222.3 typed in lbs stays 222.3.
 */
export function toInput(kg: number, unit: WeightUnit): number {
  const v = unit === "kg" ? kg : kgToLbs(kg);
  return unit === "kg" ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
}

/** Where pounds are the everyday gym unit: the United States, Liberia and Myanmar. */
const LBS_REGIONS = new Set(["US", "LR", "MM"]);

/** The unit a new lifter most likely uses, from the phone's region ("en-US" gives lbs). */
export function guessUnit(locales: readonly string[]): WeightUnit {
  for (const l of locales) {
    const region = /[-_]([A-Za-z]{2})\b/.exec(l)?.[1]?.toUpperCase();
    if (region) return LBS_REGIONS.has(region) ? "lbs" : "kg";
  }
  return "kg";
}

/** Typed value in the user's unit -> kg for storage. */
export function fromDisplay(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : lbsToKg(value);
}

export function formatWeight(kg: number, unit: WeightUnit, withUnit = true): string {
  // The same rounding as the input boxes: 102.25 kg reads 102.25 (it read 102.3), 100 kg in lbs 220.5.
  const s = String(toInput(kg, unit));
  return withUnit ? `${s} ${unit}` : s;
}

/** Big numbers in the header: 12 345 -> "12.3k". */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = toDisplay(kg, unit);
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}
