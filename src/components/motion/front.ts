import type { Vec } from "./ik";

/**
 * Front-view figures, for movements that happen sideways or around the spine (hip abduction,
 * hip adduction, the Russian twist), which a side view cannot show. Limbs point at the camera
 * in these poses, so lengths change on screen as they would in a photo: joints are placed
 * directly rather than solved with fixed bone lengths. Same 240 x 220 box and ground line as
 * the side view; x = 120 is the body's centre line. L and R are the viewer's left and right.
 */
export interface FrontPose {
  head: Vec;
  neck: Vec;
  shL: Vec;
  shR: Vec;
  elL: Vec;
  elR: Vec;
  haL: Vec;
  haR: Vec;
  hipL: Vec;
  hipR: Vec;
  knL: Vec;
  knR: Vec;
  ftL: Vec;
  ftR: Vec;
}

export interface FrontPattern {
  id: string;
  view: "front";
  a: FrontPose;
  b: FrontPose;
  concentric: "AtoB" | "BtoA" | "alternate";
  /** Machine pads at the knees: outside for abduction, inside for adduction. */
  pads?: "outside" | "inside";
  /** Seated in a machine (seat and backrest) or on the floor. */
  seat?: "machine" | "floor";
}

/* Seated in the machine: hips on the seat at y 120, shoulders at y 72, hands on the side grips. */
const SEATED_UPPER = {
  head: [120, 56] as Vec,
  neck: [120, 68] as Vec,
  shL: [99, 74] as Vec,
  shR: [141, 74] as Vec,
  elL: [92, 98] as Vec,
  elR: [148, 98] as Vec,
  haL: [96, 120] as Vec,
  haR: [144, 120] as Vec,
  hipL: [109, 120] as Vec,
  hipR: [131, 120] as Vec,
};
/* Thighs point at the camera, so they look short; shins hang to the footrests. */
const KNEES_CLOSED = { knL: [111, 134] as Vec, knR: [129, 134] as Vec, ftL: [111, 170] as Vec, ftR: [129, 170] as Vec };
const KNEES_OPEN = { knL: [84, 132] as Vec, knR: [156, 132] as Vec, ftL: [96, 170] as Vec, ftR: [144, 170] as Vec };

/* Russian twist: sitting on the floor, leaning back (the torso looks short), feet raised. */
const twist = (side: -1 | 1): FrontPose => {
  const s = side * 8; // the shoulders turn toward the side the hands go
  const hands: Vec = [120 + side * 40, 160];
  return {
    head: [120 + s, 94],
    neck: [120 + s * 0.8, 106],
    shL: [101 + s, 112 + side * 3],
    shR: [139 + s, 112 - side * 3],
    elL: [102 + side * 24, 140],
    elR: [138 + side * 24, 140],
    haL: [hands[0] - 4, hands[1]],
    haR: [hands[0] + 4, hands[1]],
    hipL: [110, 174],
    hipR: [130, 174],
    knL: [108, 150],
    knR: [132, 150],
    ftL: [112, 168],
    ftR: [128, 168],
  };
};

export const FRONT_PATTERNS = {
  hip_abduction: {
    id: "hip_abduction",
    view: "front",
    concentric: "AtoB",
    pads: "outside",
    seat: "machine",
    a: { ...SEATED_UPPER, ...KNEES_CLOSED },
    b: { ...SEATED_UPPER, ...KNEES_OPEN },
  },
  hip_adduction: {
    id: "hip_adduction",
    view: "front",
    concentric: "AtoB",
    pads: "inside",
    seat: "machine",
    a: { ...SEATED_UPPER, ...KNEES_OPEN },
    b: { ...SEATED_UPPER, ...KNEES_CLOSED },
  },
  russian_twist: {
    id: "russian_twist",
    view: "front",
    concentric: "alternate",
    seat: "floor",
    a: twist(-1),
    b: twist(1),
  },
} satisfies Record<string, FrontPattern>;

export type FrontPatternId = keyof typeof FRONT_PATTERNS;

const lerp = (p: Vec, q: Vec, t: number): Vec => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/** Joints at `t` between A (0) and B (1). */
export function frontPoseAt(p: FrontPattern, t: number): FrontPose {
  const out = {} as FrontPose;
  for (const k of Object.keys(p.a) as (keyof FrontPose)[]) out[k] = lerp(p.a[k], p.b[k], t);
  return out;
}

/** Seed exercises drawn from the front, and catalog names that mean the same movement. */
export const FRONT_SEED: Record<string, FrontPatternId> = {
  "hip-abduction-machine": "hip_abduction",
  "hip-adduction-machine": "hip_adduction",
  "russian-twist": "russian_twist",
};
export const FRONT_KEYWORDS: [RegExp, FrontPatternId][] = [
  [/abduct/, "hip_abduction"],
  [/adduct/, "hip_adduction"],
  [/russian twist/, "russian_twist"],
];
