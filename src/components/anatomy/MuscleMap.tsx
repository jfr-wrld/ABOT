import { useId } from "react";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/types/workout";
import { regionLevels, type Region } from "./regions";

/**
 * Half-body shapes as [dx, y] points relative to the body's centre line; each is drawn on
 * both sides by mirroring dx. Flat polygons on purpose: a diagram, not an anatomy plate.
 */
type Pt = [number, number];
const FRONT: Partial<Record<Region, Pt[]>> = {
  traps: [[4, 32], [15, 36], [10, 40], [4, 38]],
  front_delts: [[16, 38], [25, 40], [27, 52], [20, 55], [16, 46]],
  side_delts: [[26, 40], [31, 44], [32, 56], [28, 52]],
  chest: [[3, 42], [15, 42], [20, 55], [15, 65], [3, 65]],
  biceps: [[22, 57], [30, 59], [30, 81], [23, 81]],
  forearms: [[23, 85], [31, 85], [32, 111], [26, 111]],
  abs: [[2, 69], [10, 69], [10, 113], [2, 113]],
  obliques: [[11, 69], [18, 67], [17, 105], [11, 111]],
  quads: [[4, 124], [18, 120], [19, 168], [8, 170]],
  calves: [[8, 178], [16, 176], [15, 214], [10, 214]],
};
const BACK: Partial<Record<Region, Pt[]>> = {
  traps: [[0, 30], [14, 36], [10, 56], [0, 74]],
  rear_delts: [[16, 38], [25, 40], [27, 52], [18, 51]],
  side_delts: [[26, 40], [31, 44], [32, 56], [28, 52]],
  lats: [[11, 58], [20, 56], [19, 90], [9, 100]],
  triceps: [[22, 57], [30, 59], [30, 81], [23, 81]],
  forearms: [[23, 85], [31, 85], [32, 111], [26, 111]],
  lower_back: [[1, 80], [8, 76], [8, 112], [1, 114]],
  glutes: [[2, 117], [17, 115], [19, 139], [4, 141]],
  hamstrings: [[5, 145], [18, 143], [18, 172], [8, 172]],
  calves: [[8, 178], [17, 176], [15, 212], [9, 212]],
};

const pts = (cx: number, shape: Pt[], side: 1 | -1) => shape.map(([dx, y]) => `${cx + side * dx},${y}`).join(" ");

function Figure({
  cx,
  shapes,
  levels,
  glowId,
  label,
}: {
  cx: number;
  shapes: Partial<Record<Region, Pt[]>>;
  levels: Partial<Record<Region, "primary" | "secondary">>;
  glowId: string;
  label: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={17} r={11} className="fill-surface-2 stroke-line" strokeWidth={1} />
      <rect x={cx - 4} y={27} width={8} height={6} className="fill-surface-2" />
      {(Object.entries(shapes) as [Region, Pt[]][]).map(([region, shape]) => {
        const level = levels[region];
        const fill = level ? "var(--color-accent)" : "var(--color-surface-2)";
        const props = {
          fill,
          fillOpacity: level === "secondary" ? 0.35 : 1,
          stroke: level ? "var(--color-accent)" : "var(--color-line)",
          strokeWidth: 0.75,
          filter: level === "primary" ? `url(#${glowId})` : undefined,
        };
        return (
          <g key={region} data-region={region} data-level={level ?? "none"}>
            <polygon points={pts(cx, shape, -1)} {...props} />
            <polygon points={pts(cx, shape, 1)} {...props} />
          </g>
        );
      })}
      <text x={cx} y={228} textAnchor="middle" className="fill-text-muted" fontSize={10}>
        {label}
      </text>
    </g>
  );
}

/** Front and back body with the exercise's primary muscles solid and secondary ones at 35%. */
export function MuscleMap({
  primary,
  secondary = [],
  width = 240,
}: {
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
  width?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const levels = regionLevels(primary, secondary);
  const names = (ms: MuscleGroup[]) => ms.map((m) => MUSCLE_GROUP_LABELS[m]).join(", ");
  const description = `Primary: ${names(primary) || "none"}. Secondary: ${names(secondary) || "none"}.`;
  return (
    <svg
      role="img"
      aria-labelledby={`${uid}-t`}
      viewBox="0 0 220 234"
      width={width}
      height={Math.round((width * 234) / 220)}
      className="mx-auto block max-w-full"
    >
      <title id={`${uid}-t`}>{description}</title>
      <defs>
        {/* Glow marks the primary muscles only: the focal point of the diagram. */}
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Figure cx={55} shapes={FRONT} levels={levels} glowId={`${uid}-glow`} label="Front" />
      <Figure cx={165} shapes={BACK} levels={levels} glowId={`${uid}-glow`} label="Back" />
    </svg>
  );
}
