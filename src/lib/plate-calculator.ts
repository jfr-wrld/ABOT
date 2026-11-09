/**
 * Barbell plate loading: which plates go on each sleeve for a target weight.
 *
 * Greedy from the heaviest plate down, per side: weightPerSide = (target - bar) / 2. Plates come
 * in pairs and every size in the inventory is assumed to be available in any number. Whatever
 * the plates cannot make is returned as `remainder` (total, both sides), so the lifter sees how
 * close the bar gets. Arithmetic runs in integer grams, so 1.25 kg steps never drift.
 */

export type PlateUnit = "kg" | "lbs";

export interface PlateCount {
  /** Plate weight in the calculator's unit. */
  plate: number;
  /** Plates of this size on ONE sleeve. */
  count: number;
}

export interface PlateLoad {
  /** Heaviest first: the order they go on, from the collar out. */
  perSide: PlateCount[];
  /** Plates on one sleeve, in the unit. */
  perSideWeight: number;
  /** Bar plus both sleeves: what is actually on the bar. */
  loaded: number;
  /** Target minus loaded; 0 when the target is met exactly. Never negative. */
  remainder: number;
  /** The target is lighter than the empty bar. */
  belowBar: boolean;
}

/** Default inventories and bar presets, per unit. */
export const PLATE_SETS: Record<PlateUnit, { plates: number[]; bars: { weight: number; label: string }[]; step: number }> = {
  kg: {
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    bars: [
      { weight: 20, label: "Olympic bar" },
      { weight: 15, label: "Women's / short bar" },
      { weight: 10, label: "EZ-curl bar" },
      { weight: 0, label: "Plate-loaded machine" },
    ],
    step: 2.5,
  },
  lbs: {
    plates: [45, 35, 25, 10, 5, 2.5],
    bars: [
      { weight: 45, label: "Olympic bar" },
      { weight: 35, label: "Women's / short bar" },
      { weight: 25, label: "EZ-curl bar" },
      { weight: 0, label: "Plate-loaded machine" },
    ],
    step: 5,
  },
};

const G = 1000;
const grams = (w: number) => Math.round(w * G);

export function calculatePlates(target: number, bar: number, inventory: number[]): PlateLoad {
  const sizes = [...new Set(inventory.filter((p) => Number.isFinite(p) && p > 0).map(grams))].sort((a, b) => b - a);
  const targetG = Math.max(0, grams(target));
  const barG = Math.max(0, grams(bar));
  if (targetG < barG) {
    return { perSide: [], perSideWeight: 0, loaded: bar, remainder: 0, belowBar: true };
  }
  let left = Math.floor((targetG - barG) / 2);
  const perSide: PlateCount[] = [];
  for (const size of sizes) {
    const count = Math.floor(left / size);
    if (count > 0) {
      perSide.push({ plate: size / G, count });
      left -= count * size;
    }
  }
  const sideG = perSide.reduce((s, p) => s + grams(p.plate) * p.count, 0);
  const loadedG = barG + 2 * sideG;
  return {
    perSide,
    perSideWeight: sideG / G,
    loaded: loadedG / G,
    remainder: Math.max(0, targetG - loadedG) / G,
    belowBar: false,
  };
}

/** Every plate on one sleeve in loading order (collar out), for drawing. */
export function sleeveStack(load: PlateLoad): number[] {
  return load.perSide.flatMap(({ plate, count }) => Array.from({ length: count }, () => plate));
}

/**
 * IWF-inspired colours for the dark theme, by rank in the kg set; lbs plates take the colour of
 * the same rank (45 lb as 25 kg, and so on). `edge` outlines plates that would vanish on black.
 */
export const PLATE_COLORS: { fill: string; edge?: string; name: string }[] = [
  { fill: "#ef4444", name: "Crimson Steel" },
  { fill: "#3b82f6", name: "Cyber Blue" },
  { fill: "#eab308", name: "Industrial Amber" },
  { fill: "#22c55e", name: "Tactical Green" },
  { fill: "#e4e4e7", name: "Brushed Titanium" },
  { fill: "#18181b", edge: "#ccff00", name: "Carbon Black" },
  { fill: "#71717a", edge: "#a1a1aa", name: "Micro Chrome" },
];

export function plateColor(plate: number, unit: PlateUnit) {
  const rank = PLATE_SETS[unit].plates.indexOf(plate);
  return PLATE_COLORS[rank >= 0 ? rank : PLATE_COLORS.length - 1];
}

/** Drawing size of a plate relative to a full-size bumper: [height 0..1, thickness in units]. */
export function plateShape(plate: number, unit: PlateUnit): { height: number; thickness: number } {
  const rank = PLATE_SETS[unit].plates.indexOf(plate);
  // Bumpers (the four heaviest) share the 450 mm diameter; change plates get smaller.
  const heights = [1, 1, 1, 1, 0.56, 0.47, 0.38];
  const thickness = [26, 22, 19, 15, 10, 8, 6];
  const r = rank >= 0 ? rank : heights.length - 1;
  return { height: heights[r], thickness: thickness[r] };
}
