import type { Equipment, Exercise, WeightUnit } from "@/types/workout";
import { PLATE_SETS, calculatePlates } from "./plate-calculator";
import { fromDisplay, toDisplay } from "./units";

export interface WarmupSet {
  weightKg: number;
  reps: number;
}

/** Ramp for a barbell: the empty bar, then 40, 60 and 80% of the working weight. */
const BAR_RAMP: [number, number][] = [
  [0.4, 5],
  [0.6, 3],
  [0.8, 2],
];
/** Dumbbells, machines and cables: two lighter sets are enough. */
const LIGHT_RAMP: [number, number][] = [
  [0.5, 8],
  [0.75, 4],
];

const LOADED: Equipment[] = ["barbell", "smith_machine", "dumbbell", "machine", "cable", "kettlebell"];

/** Compound lifts with a load get warm-ups; light isolation work warms itself up (Fitbod's rule). */
export function warmsUp(ex: Exercise | undefined): boolean {
  return !!ex && ex.category === "compound" && LOADED.includes(ex.equipment) && ex.logType !== "duration" && ex.logType !== "distance_duration";
}

/**
 * Warm-up sets before a working weight, lightest first. Barbell steps are rounded down to what
 * the gym's plates can make on its bar; other equipment to the unit's usual step. Steps that
 * round to the same weight, or to nothing above the bar, are dropped.
 */
export function warmupSets(
  workKg: number,
  ex: Exercise,
  opts: { unit: WeightUnit; barKg?: number; platesKg?: number[] },
): WarmupSet[] {
  if (!warmsUp(ex) || workKg <= 0) return [];
  const barbell = ex.equipment === "barbell" || ex.equipment === "smith_machine";
  const unitSet = PLATE_SETS[opts.unit === "lbs" ? "lbs" : "kg"];
  const work = toDisplay(workKg, opts.unit);
  // A gym keeps its bar and plates in kg; in pounds the standard set is used.
  const bar = barbell ? (opts.unit === "kg" && opts.barKg !== undefined ? opts.barKg : unitSet.bars[0]!.weight) : 0;
  const plates = opts.unit === "kg" && opts.platesKg?.length ? opts.platesKg : unitSet.plates;
  const round = (w: number) =>
    barbell ? calculatePlates(w, bar, plates).loaded : Math.floor(w / unitSet.step) * unitSet.step;

  const out: { w: number; reps: number }[] = [];
  if (barbell && bar > 0 && work >= bar * 2) out.push({ w: bar, reps: 10 });
  for (const [pct, reps] of barbell ? BAR_RAMP : LIGHT_RAMP) {
    const w = round(work * pct);
    const prev = out[out.length - 1]?.w ?? 0;
    if (w <= prev || w <= 0 || w >= work || (barbell && w <= bar)) continue;
    out.push({ w, reps });
  }
  return out.map(({ w, reps }) => ({ weightKg: fromDisplay(w, opts.unit), reps }));
}
