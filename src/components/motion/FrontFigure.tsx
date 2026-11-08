import type { Exercise, MuscleGroup } from "@/types/workout";
import type { Vec } from "./ik";
import { frontPoseAt, type FrontPattern, type FrontPose } from "./front";

const NEAR = "#d4d4d8";
const ACCENT = "var(--color-accent)";
const PROP = "#3f3f46";
const PAD = "#52525b";
const GROUND = 180;

type Part = "torso" | "arms" | "thigh" | "shin";
const LIT: Partial<Record<MuscleGroup, Part[]>> = {
  abs: ["torso"],
  lower_back: ["torso"],
  glutes: ["thigh"],
  abductors: ["thigh"],
  adductors: ["thigh"],
  quads: ["thigh"],
  hamstrings: ["thigh"],
  shoulders: ["arms"],
  full_body: ["torso", "arms", "thigh", "shin"],
};

const line = (from: Vec, to: Vec, width: number, color: string) => (
  <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={color} strokeWidth={width} strokeLinecap="round" />
);

/** Square viewBox around the figure, for thumbnails. */
export function frontFitBox(j: FrontPose): string {
  const pts = Object.values(j);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 16;
  const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  const side = Math.max(x1 - x0, y1 - y0);
  return `${(x0 + x1 - side) / 2} ${(y0 + y1 - side) / 2} ${side} ${side}`;
}

/** The front-view figure at `progress` (0 = start pose, 1 = other end). */
export function FrontScene({
  pattern,
  progress,
  exercise,
  title,
  fit = false,
}: {
  pattern: FrontPattern;
  progress: number;
  exercise: Pick<Exercise, "equipment" | "primaryMuscles">;
  title?: string;
  fit?: boolean;
}) {
  const j = frontPoseAt(pattern, progress);
  const lit = new Set(exercise.primaryMuscles.flatMap((m) => LIT[m] ?? []));
  const c = (part: Part) => (lit.has(part) ? ACCENT : NEAR);
  const pad = (knee: Vec, side: -1 | 1) => {
    // side -1: viewer's left knee. Outside pads sit away from the centre line, inside pads toward it.
    const out = pattern.pads === "outside" ? side : -side;
    const x = knee[0] + out * 10 - 4;
    return <rect x={x} y={knee[1] - 12} width={8} height={22} rx={3} fill={PAD} />;
  };
  return (
    <svg
      viewBox={fit ? frontFitBox(j) : "0 -20 240 220"}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="block h-auto w-full"
    >
      {title && <title>{title}</title>}
      <line x1={0} y1={GROUND} x2={240} y2={GROUND} stroke={PROP} strokeWidth={2} />
      {pattern.seat === "machine" && (
        <g>
          {/* backrest, seat, frame and footrests */}
          <rect x={97} y={62} width={46} height={58} rx={4} fill="#27272a" />
          <rect x={92} y={118} width={56} height={9} rx={2} fill={PROP} />
          <line x1={120} y1={127} x2={120} y2={GROUND} stroke={PROP} strokeWidth={4} />
          <line x1={84} y1={174} x2={156} y2={174} stroke={PROP} strokeWidth={3} strokeLinecap="round" />
        </g>
      )}
      {/* torso as a tapered block, then neck and head */}
      <polygon points={[j.hipL, j.hipR, j.shR, j.shL].map((p) => p.join(",")).join(" ")} fill={c("torso")} stroke={c("torso")} strokeWidth={4} strokeLinejoin="round" />
      {line(j.neck, j.head, 4, NEAR)}
      <circle cx={j.head[0]} cy={j.head[1]} r={8} fill={NEAR} />
      {/* legs */}
      {line(j.hipL, j.knL, 9, c("thigh"))}
      {line(j.hipR, j.knR, 9, c("thigh"))}
      {line(j.knL, j.ftL, 7, c("shin"))}
      {line(j.knR, j.ftR, 7, c("shin"))}
      {line(j.ftL, [j.ftL[0] - 6, j.ftL[1] + 2], 5, NEAR)}
      {line(j.ftR, [j.ftR[0] + 6, j.ftR[1] + 2], 5, NEAR)}
      {pattern.pads && (
        <g>
          {pad(j.knL, -1)}
          {pad(j.knR, 1)}
        </g>
      )}
      {/* arms */}
      {line(j.shL, j.elL, 6.5, c("arms"))}
      {line(j.elL, j.haL, 5.5, c("arms"))}
      {line(j.shR, j.elR, 6.5, c("arms"))}
      {line(j.elR, j.haR, 5.5, c("arms"))}
      {/* a plate held in both hands, when the exercise uses one */}
      {(exercise.equipment === "dumbbell" || exercise.equipment === "kettlebell" || exercise.equipment === "other") &&
        pattern.seat === "floor" && (
          <circle cx={(j.haL[0] + j.haR[0]) / 2} cy={(j.haL[1] + j.haR[1]) / 2} r={7} fill="#27272a" stroke="#a1a1aa" strokeWidth={2} />
        )}
    </svg>
  );
}
