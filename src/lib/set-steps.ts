import type { Exercise, WeightUnit } from "@/types/workout";

/**
 * How much one tap on the set's weight stepper moves the load, in the lifter's unit: 5 lb;
 * 1.25 kg on dumbbells and isolation work, where 2.5 kg is a big share of the load; 2.5 kg
 * (the smallest pair of plates) on everything else.
 */
export function weightStep(exercise: Pick<Exercise, "equipment" | "category"> | undefined, unit: WeightUnit): number {
  if (unit === "lbs") return 5;
  if (exercise && (exercise.equipment === "dumbbell" || exercise.category === "isolation")) return 1.25;
  return 2.5;
}

/** `value` moved by `delta`, never below zero, without float dust (2.5 + 1.25 + 1.25 = 5). */
export function stepped(value: number, delta: number): number {
  return Math.max(0, Math.round((value + delta) * 100) / 100);
}
