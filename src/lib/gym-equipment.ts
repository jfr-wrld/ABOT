import type { GymLocation, WeightUnit } from "@/types/workout";
import { PLATE_SETS } from "./plate-calculator";

/**
 * A gym's bar and plates in the unit they are marked in. They are stored in kg like every
 * weight in ABOT; a 45 lb bar is kept as 20.41 kg and shown as 45 lb again.
 */

const LB = 0.45359237;
/** The key a plate size is counted under in platePairs: its weight in grams. */
export const plateKey = (kg: number) => String(Math.round(kg * 1000));

export const equipmentUnit = (gym: GymLocation): WeightUnit => gym.equipmentUnit ?? "kg";

/** kg to the gym's unit, rounded to what a plate or bar is marked with. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? Math.round(kg * 1000) / 1000 : Math.round((kg / LB) * 100) / 100;
}

export function toKg(v: number, unit: WeightUnit): number {
  return unit === "kg" ? v : Math.round(v * LB * 10000) / 10000;
}

export interface GymSetup {
  bar: number;
  /** Heaviest first, in the unit. */
  plates: number[];
  /** Pairs per plate, aligned with `plates`; undefined = enough. */
  pairs: (number | undefined)[];
}

/**
 * The gym's bar and plates in `unit`, or null when the gym's equipment is marked in the other
 * unit (a 20 kg plate cannot be loaded as a whole number of pounds).
 */
export function gymSetup(gym: GymLocation, unit: WeightUnit): GymSetup | null {
  if (equipmentUnit(gym) !== unit) return null;
  const plates = [...gym.plateInventoryKg].sort((a, b) => b - a);
  return {
    bar: fromKg(gym.barWeightKg, unit),
    plates: plates.map((kg) => fromKg(kg, unit)),
    pairs: plates.map((kg) => gym.platePairs?.[plateKey(kg)]),
  };
}

/** The stored form of a setup in `unit`; pair counts follow their plate. */
export function setupPatch(setup: GymSetup, unit: WeightUnit): Pick<GymLocation, "barWeightKg" | "plateInventoryKg" | "platePairs" | "equipmentUnit"> {
  const pairs: Record<string, number> = {};
  const plateInventoryKg = setup.plates.map((p, i) => {
    const kg = toKg(p, unit);
    const n = setup.pairs[i];
    if (n !== undefined) pairs[plateKey(kg)] = n;
    return kg;
  });
  return { barWeightKg: toKg(setup.bar, unit), plateInventoryKg: plateInventoryKg.sort((a, b) => b - a), platePairs: pairs, equipmentUnit: unit };
}

/** Switching what the gym is marked in starts from that unit's standard bar and plates. */
export function standardSetup(unit: WeightUnit): GymSetup {
  const set = PLATE_SETS[unit];
  return { bar: set.bars[0]!.weight, plates: [...set.plates], pairs: set.plates.map(() => undefined) };
}
