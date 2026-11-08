import type { Exercise } from "@/types/workout";
import { solveTwoBone, type Vec } from "./ik";

/**
 * Side-view lifter rig. Coordinates are SVG units (y down) in a 240 x 220 box whose ground
 * line is y = 180. Angles are degrees; torso 0 points straight up and positive leans forward
 * (toward +x, the direction the lifter faces).
 */
export const LEN = { torso: 48, neck: 7, head: 8, upperArm: 27, foreArm: 25, thigh: 40, shin: 38, foot: 11 } as const;
export const GROUND = 180;

type Bend = 1 | -1;
/** +1 puts a hanging elbow behind the body; -1 puts a knee in front of the hip-ankle line. */
const ELBOW_BACK: Bend = 1;
const KNEE_FWD: Bend = -1;

export interface Pose {
  pelvis: Vec;
  torso: number;
  torsoLen?: number;
  /** World position of the hands, or relative to the shoulder when `handRel` is set. */
  hand?: Vec;
  handRel?: Vec;
  farHand?: Vec;
  foot: Vec;
  farFoot?: Vec;
  elbow?: Bend;
  knee?: Bend;
  farKnee?: Bend;
  /** Toe pitch in degrees: 0 flat, positive lifts the heel (calf raise, back foot in a lunge). */
  heel?: number;
  farHeel?: number;
}

export type Prop = { kind: "poly"; points: Vec[] } | { kind: "line"; from: Vec; to: Vec; width?: number };

export interface Pattern {
  id: string;
  a: Pose;
  b: Pose;
  /** Which way is the lifting half: A to B, B to A, a static hold, or a walking loop. */
  concentric: "AtoB" | "BtoA" | "hold" | "loop";
  props?: Prop[];
  /** Cable stack pulley, drawn only for cable exercises. */
  anchor?: Vec;
  /** Draw the load at the feet (leg press sled) instead of the hands. */
  loadAtFeet?: boolean;
  /** Implement drawn at the hands whatever the exercise's equipment is (ab wheel). */
  tool?: "wheel";
}

export interface Joints {
  shoulder: Vec;
  elbow: Vec;
  hand: Vec;
  farElbow: Vec;
  farHand: Vec;
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  toe: Vec;
  farKnee: Vec;
  farAnkle: Vec;
  farToe: Vec;
  head: Vec;
}

const add = (p: Vec, q: Vec): Vec => [p[0] + q[0], p[1] + q[1]];
const rad = (d: number) => (d * Math.PI) / 180;

export function rig(p: Pose): Joints {
  const t = rad(p.torso);
  const dir: Vec = [Math.sin(t), -Math.cos(t)];
  const tl = p.torsoLen ?? LEN.torso;
  const shoulder: Vec = [p.pelvis[0] + dir[0] * tl, p.pelvis[1] + dir[1] * tl];
  const head: Vec = [shoulder[0] + dir[0] * (LEN.neck + LEN.head), shoulder[1] + dir[1] * (LEN.neck + LEN.head)];
  const handTarget = p.handRel ? add(shoulder, p.handRel) : (p.hand ?? add(shoulder, [2, 52]));
  const elbowBend = p.elbow ?? ELBOW_BACK;
  const arm = solveTwoBone(shoulder, handTarget, LEN.upperArm, LEN.foreArm, elbowBend);
  const farArm = p.farHand ? solveTwoBone(shoulder, p.farHand, LEN.upperArm, LEN.foreArm, elbowBend) : arm;
  const leg = solveTwoBone(p.pelvis, p.foot, LEN.thigh, LEN.shin, p.knee ?? KNEE_FWD);
  const farLeg = p.farFoot
    ? solveTwoBone(p.pelvis, p.farFoot, LEN.thigh, LEN.shin, p.farKnee ?? p.knee ?? KNEE_FWD)
    : leg;
  const toe = (ankle: Vec, heel = 0): Vec => [ankle[0] + LEN.foot * Math.cos(rad(heel)), ankle[1] + LEN.foot * Math.sin(rad(heel))];
  return {
    shoulder,
    elbow: arm.mid,
    hand: arm.end,
    farElbow: farArm.mid,
    farHand: farArm.end,
    hip: p.pelvis,
    knee: leg.mid,
    ankle: leg.end,
    toe: toe(leg.end, p.heel),
    farKnee: farLeg.mid,
    farAnkle: farLeg.end,
    farToe: toe(farLeg.end, p.farHeel ?? (p.farFoot ? p.farHeel : p.heel)),
    head,
  };
}

const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
const lerpV = (p: Vec | undefined, q: Vec | undefined, t: number): Vec | undefined =>
  p && q ? [lerp(p[0], q[0], t), lerp(p[1], q[1], t)] : (p ?? q);

/** Pose at `t` between A (0) and B (1). */
export function poseAt(p: Pattern, t: number): Pose {
  const { a, b } = p;
  return {
    pelvis: lerpV(a.pelvis, b.pelvis, t)!,
    torso: lerp(a.torso, b.torso, t),
    torsoLen: lerp(a.torsoLen ?? LEN.torso, b.torsoLen ?? LEN.torso, t),
    hand: lerpV(a.hand, b.hand, t),
    handRel: lerpV(a.handRel, b.handRel, t),
    farHand: lerpV(a.farHand, b.farHand, t),
    foot: lerpV(a.foot, b.foot, t)!,
    farFoot: lerpV(a.farFoot, b.farFoot, t),
    elbow: t < 0.5 ? a.elbow : (b.elbow ?? a.elbow),
    knee: t < 0.5 ? a.knee : (b.knee ?? a.knee),
    farKnee: t < 0.5 ? a.farKnee : (b.farKnee ?? a.farKnee),
    heel: lerp(a.heel ?? 0, b.heel ?? 0, t),
    farHeel: a.farHeel !== undefined || b.farHeel !== undefined ? lerp(a.farHeel ?? 0, b.farHeel ?? 0, t) : undefined,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Tempo: concentric 1.0 s, eccentric 1.6 s, short pauses at both ends.                         */
/* ------------------------------------------------------------------------------------------ */

const CON = 1.0;
const ECC = 1.6;
const PAUSE_END = 0.25;
const PAUSE_START = 0.35;
export const CYCLE_SECONDS = CON + ECC + PAUSE_END + PAUSE_START;
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

export type PhaseLabel = "Concentric" | "Eccentric" | "Hold" | "Carry";

/** Where in the rep the animation is at cycle position `u` (0..1), and how far from A to B. */
export function phaseAt(p: Pattern, u: number): { label: PhaseLabel; progress: number } {
  const x = (((u % 1) + 1) % 1) * CYCLE_SECONDS;
  if (p.concentric === "hold") return { label: "Hold", progress: 0 };
  if (p.concentric === "loop") {
    const half = CYCLE_SECONDS / 2;
    return { label: "Carry", progress: x < half ? ease(x / half) : ease(1 - (x - half) / half) };
  }
  const out = p.concentric === "AtoB" ? CON : ECC;
  const back = p.concentric === "AtoB" ? ECC : CON;
  const outLabel: PhaseLabel = p.concentric === "AtoB" ? "Concentric" : "Eccentric";
  const backLabel: PhaseLabel = p.concentric === "AtoB" ? "Eccentric" : "Concentric";
  if (x < out) return { label: outLabel, progress: ease(x / out) };
  if (x < out + PAUSE_END) return { label: outLabel, progress: 1 };
  if (x < out + PAUSE_END + back) return { label: backLabel, progress: ease(1 - (x - out - PAUSE_END) / back) };
  return { label: backLabel, progress: 0 };
}

/* ------------------------------------------------------------------------------------------ */
/* Props                                                                                        */
/* ------------------------------------------------------------------------------------------ */

const rect = (x: number, y: number, w: number, h: number): Prop => ({
  kind: "poly",
  points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
});
const FLAT_BENCH: Prop[] = [rect(52, 112, 108, 7), { kind: "line", from: [62, 119], to: [62, GROUND] }, { kind: "line", from: [150, 119], to: [150, GROUND] }];
const SEAT = (x: number, y: number): Prop[] => [rect(x - 18, y + 2, 36, 6), { kind: "line", from: [x, y + 8], to: [x, GROUND] }];
const PULL_BAR: Prop[] = [{ kind: "line", from: [78, 10], to: [150, 10], width: 3 }];
const DIP_BARS: Prop[] = [{ kind: "line", from: [100, 96], to: [146, 96], width: 3 }, { kind: "line", from: [140, 96], to: [140, GROUND] }];

/* Standing reference: ankle y 176, hip y 98, shoulder y 50. */
const STAND = { pelvis: [110, 98] as Vec, torso: 0, foot: [114, 176] as Vec };
const HANG: Vec = [2, 52];

export const PATTERNS = {
  squat_back: {
    id: "squat_back",
    concentric: "BtoA",
    a: { ...STAND, foot: [116, 176], handRel: [-6, 4] },
    b: { pelvis: [88, 136], torso: 40, foot: [116, 176], handRel: [-6, 4] },
  },
  squat_front: {
    id: "squat_front",
    concentric: "BtoA",
    a: { ...STAND, foot: [116, 176], handRel: [12, -2], elbow: -1 },
    b: { pelvis: [92, 138], torso: 22, foot: [116, 176], handRel: [12, -2], elbow: -1 },
  },
  squat_goblet: {
    id: "squat_goblet",
    concentric: "BtoA",
    a: { ...STAND, foot: [116, 176], handRel: [14, 14] },
    b: { pelvis: [90, 138], torso: 26, foot: [116, 176], handRel: [14, 14] },
  },
  deadlift: {
    id: "deadlift",
    concentric: "AtoB",
    a: { pelvis: [96, 132], torso: 58, hand: [124, 158], foot: [116, 176] },
    b: { ...STAND, hand: [114, 102] },
  },
  rdl: {
    id: "rdl",
    concentric: "BtoA",
    a: { ...STAND, hand: [114, 102] },
    b: { pelvis: [98, 100], torso: 74, hand: [134, 140], foot: [114, 176] },
  },
  good_morning: {
    id: "good_morning",
    concentric: "BtoA",
    a: { ...STAND, handRel: [-6, 4] },
    b: { pelvis: [100, 100], torso: 76, handRel: [-6, 4], foot: [114, 176] },
  },
  bench_flat: {
    id: "bench_flat",
    concentric: "BtoA",
    props: FLAT_BENCH,
    a: { pelvis: [122, 106], torso: -90, hand: [76, 54], foot: [152, 176], elbow: 1 },
    b: { pelvis: [122, 106], torso: -90, hand: [80, 94], foot: [152, 176], elbow: 1 },
  },
  bench_incline: {
    id: "bench_incline",
    concentric: "BtoA",
    props: [{ kind: "poly", points: [[136, 124], [76, 82], [72, 88], [132, 130]] }, { kind: "line", from: [128, 128], to: [128, GROUND] }],
    a: { pelvis: [130, 118], torso: -55, hand: [94, 36], foot: [162, 176], elbow: 1 },
    b: { pelvis: [130, 118], torso: -55, hand: [98, 80], foot: [162, 176], elbow: 1 },
  },
  bench_decline: {
    id: "bench_decline",
    concentric: "BtoA",
    props: [{ kind: "poly", points: [[64, 120], [150, 96], [152, 103], [66, 127]] }, { kind: "line", from: [110, 112], to: [110, GROUND] }],
    a: { pelvis: [126, 98], torso: -112, hand: [82, 64], foot: [162, 128], elbow: 1 },
    b: { pelvis: [126, 98], torso: -112, hand: [84, 106], foot: [162, 128], elbow: 1 },
  },
  fly: {
    id: "fly",
    concentric: "BtoA",
    props: FLAT_BENCH,
    a: { pelvis: [122, 106], torso: -90, hand: [76, 56], foot: [152, 176], elbow: 1 },
    b: { pelvis: [122, 106], torso: -90, hand: [70, 112], foot: [152, 176], elbow: -1 },
  },
  fly_seated: {
    id: "fly_seated",
    concentric: "AtoB",
    props: SEAT(100, 124),
    a: { pelvis: [100, 124], torso: -2, hand: [90, 72], foot: [140, 176], elbow: -1 },
    b: { pelvis: [100, 124], torso: -2, hand: [146, 62], foot: [140, 176], elbow: -1 },
  },
  fly_cable: {
    id: "fly_cable",
    concentric: "AtoB",
    anchor: [74, -6],
    a: { ...STAND, torso: 12, hand: [96, 22], elbow: -1 },
    b: { ...STAND, torso: 12, hand: [150, 84], elbow: -1 },
  },
  push_up: {
    id: "push_up",
    concentric: "BtoA",
    a: { pelvis: [140, 150], torso: -64, hand: [96, 176], foot: [216, 176], elbow: 1, knee: 1 },
    b: { pelvis: [142, 164], torso: -82, hand: [96, 176], foot: [216, 176], elbow: 1, knee: 1 },
  },
  dip: {
    id: "dip",
    concentric: "BtoA",
    props: DIP_BARS,
    a: { pelvis: [108, 92], torso: 8, hand: [124, 96], foot: [86, 130], knee: -1 },
    b: { pelvis: [104, 122], torso: 14, hand: [124, 96], foot: [82, 160], knee: -1 },
  },
  pull_up: {
    id: "pull_up",
    concentric: "AtoB",
    props: PULL_BAR,
    a: { pelvis: [106, 114], torso: 3, hand: [113, 13], foot: [98, 188], knee: 1, elbow: -1 },
    b: { pelvis: [104, 72], torso: 6, hand: [113, 13], foot: [96, 146], knee: 1, elbow: -1 },
  },
  pulldown: {
    id: "pulldown",
    concentric: "AtoB",
    anchor: [104, -18],
    props: SEAT(100, 124),
    a: { pelvis: [100, 124], torso: -8, hand: [104, 26], foot: [144, 176], elbow: -1 },
    b: { pelvis: [100, 124], torso: -12, hand: [118, 72], foot: [144, 176], elbow: -1 },
  },
  row_seated: {
    id: "row_seated",
    concentric: "AtoB",
    anchor: [222, 138],
    props: [...SEAT(86, 124), { kind: "line", from: [160, 132], to: [160, GROUND], width: 3 }],
    a: { pelvis: [86, 124], torso: 8, hand: [138, 102], foot: [156, 150] },
    b: { pelvis: [86, 124], torso: -6, hand: [100, 104], foot: [156, 150] },
  },
  row_bent: {
    id: "row_bent",
    concentric: "AtoB",
    a: { pelvis: [100, 104], torso: 62, hand: [144, 138], foot: [114, 176] },
    b: { pelvis: [100, 104], torso: 62, hand: [124, 108], foot: [114, 176] },
  },
  straight_arm_pulldown: {
    id: "straight_arm_pulldown",
    concentric: "AtoB",
    anchor: [196, -18],
    a: { ...STAND, torso: 18, hand: [156, 16], elbow: -1 },
    b: { ...STAND, torso: 18, hand: [124, 104], elbow: -1 },
  },
  face_pull: {
    id: "face_pull",
    concentric: "AtoB",
    anchor: [228, 44],
    a: { ...STAND, torso: -6, hand: [157, 46], elbow: -1 },
    b: { ...STAND, torso: -6, hand: [118, 34], elbow: -1 },
  },
  ohp: {
    id: "ohp",
    concentric: "AtoB",
    a: { ...STAND, hand: [122, 48], elbow: 1 },
    b: { ...STAND, hand: [112, -2], elbow: 1 },
  },
  raise: {
    id: "raise",
    concentric: "AtoB",
    a: { ...STAND, hand: [114, 102], elbow: -1 },
    b: { ...STAND, hand: [162, 52], elbow: -1 },
  },
  rear_delt: {
    id: "rear_delt",
    concentric: "AtoB",
    a: { pelvis: [100, 100], torso: 70, hand: [148, 134], foot: [114, 176], elbow: -1 },
    b: { pelvis: [100, 100], torso: 70, hand: [140, 70], foot: [114, 176], elbow: -1 },
  },
  upright_row: {
    id: "upright_row",
    concentric: "AtoB",
    a: { ...STAND, hand: [116, 100], elbow: 1 },
    b: { ...STAND, hand: [124, 50], elbow: 1 },
  },
  shrug: {
    id: "shrug",
    concentric: "AtoB",
    a: { ...STAND, handRel: HANG },
    b: { ...STAND, torsoLen: 55, handRel: HANG },
  },
  curl: {
    id: "curl",
    concentric: "AtoB",
    a: { ...STAND, hand: [116, 102], elbow: 1 },
    b: { ...STAND, hand: [128, 56], elbow: 1 },
  },
  curl_preacher: {
    id: "curl_preacher",
    concentric: "AtoB",
    props: [...SEAT(100, 124), { kind: "poly", points: [[114, 92], [140, 106], [137, 112], [111, 98]] }],
    a: { pelvis: [100, 124], torso: 12, hand: [160, 108], foot: [140, 176], elbow: -1 },
    b: { pelvis: [100, 124], torso: 12, hand: [130, 70], foot: [140, 176], elbow: 1 },
  },
  pushdown: {
    id: "pushdown",
    concentric: "AtoB",
    anchor: [138, -18],
    a: { ...STAND, torso: 10, hand: [138, 72], elbow: 1 },
    b: { ...STAND, torso: 10, hand: [126, 102], elbow: 1 },
  },
  skullcrusher: {
    id: "skullcrusher",
    concentric: "BtoA",
    props: FLAT_BENCH,
    a: { pelvis: [122, 106], torso: -90, hand: [76, 54], foot: [152, 176], elbow: -1 },
    b: { pelvis: [122, 106], torso: -90, hand: [54, 86], foot: [152, 176], elbow: -1 },
  },
  overhead_ext: {
    id: "overhead_ext",
    concentric: "BtoA",
    a: { ...STAND, hand: [112, -2], elbow: -1 },
    b: { ...STAND, hand: [96, 34], elbow: -1 },
  },
  leg_press: {
    id: "leg_press",
    concentric: "BtoA",
    loadAtFeet: true,
    props: [{ kind: "poly", points: [[40, 150], [84, 120], [90, 128], [46, 158]] }, rect(56, 150, 40, 6)],
    a: { pelvis: [80, 140], torso: -58, handRel: [12, 38], foot: [160, 100], elbow: -1 },
    b: { pelvis: [80, 140], torso: -58, handRel: [12, 38], foot: [124, 112], elbow: -1 },
  },
  leg_ext: {
    id: "leg_ext",
    concentric: "AtoB",
    props: SEAT(100, 126),
    a: { pelvis: [100, 126], torso: -4, handRel: [6, 50], foot: [142, 168] },
    b: { pelvis: [100, 126], torso: -4, handRel: [6, 50], foot: [178, 126] },
  },
  leg_curl_lying: {
    id: "leg_curl_lying",
    concentric: "AtoB",
    props: FLAT_BENCH,
    a: { pelvis: [106, 106], torso: -90, hand: [44, 112], foot: [182, 108], knee: 1 },
    b: { pelvis: [106, 106], torso: -90, hand: [44, 112], foot: [140, 72], knee: 1 },
  },
  leg_curl_seated: {
    id: "leg_curl_seated",
    concentric: "AtoB",
    props: SEAT(100, 126),
    a: { pelvis: [100, 126], torso: -4, handRel: [6, 50], foot: [178, 126] },
    b: { pelvis: [100, 126], torso: -4, handRel: [6, 50], foot: [138, 166] },
  },
  lunge: {
    id: "lunge",
    concentric: "BtoA",
    a: { pelvis: [106, 100], torso: 0, handRel: HANG, foot: [140, 176], farFoot: [74, 176], farHeel: 40 },
    b: { pelvis: [106, 138], torso: 0, handRel: HANG, foot: [140, 176], farFoot: [74, 176], farHeel: 55 },
  },
  split_squat: {
    id: "split_squat",
    concentric: "BtoA",
    props: [rect(34, 128, 44, 7), { kind: "line", from: [56, 135], to: [56, GROUND] }],
    a: { pelvis: [104, 104], torso: 0, handRel: HANG, foot: [140, 176], farFoot: [62, 124], farHeel: 70 },
    b: { pelvis: [100, 140], torso: 4, handRel: HANG, foot: [140, 176], farFoot: [62, 124], farHeel: 70 },
  },
  step_up: {
    id: "step_up",
    concentric: "AtoB",
    props: [rect(124, 146, 52, GROUND - 146)],
    a: { pelvis: [106, 104], torso: 6, handRel: HANG, foot: [150, 142], farFoot: [98, 176] },
    b: { pelvis: [140, 66], torso: 2, handRel: HANG, foot: [150, 142], farFoot: [128, 134] },
  },
  hip_thrust: {
    id: "hip_thrust",
    concentric: "AtoB",
    props: [rect(28, 108, 52, 12), { kind: "line", from: [54, 120], to: [54, GROUND] }],
    a: { pelvis: [116, 158], torso: -42, hand: [118, 150], foot: [156, 176] },
    b: { pelvis: [124, 118], torso: -90, hand: [124, 110], foot: [156, 176] },
  },
  glute_bridge: {
    id: "glute_bridge",
    concentric: "AtoB",
    a: { pelvis: [112, 170], torso: -88, hand: [114, 162], foot: [150, 176] },
    b: { pelvis: [118, 142], torso: -118, hand: [120, 134], foot: [150, 176] },
  },
  calf_raise: {
    id: "calf_raise",
    concentric: "AtoB",
    a: { ...STAND, handRel: [-6, 4] },
    b: { pelvis: [110, 90], torso: 0, foot: [114, 168], heel: 40, handRel: [-6, 4] },
  },
  calf_seated: {
    id: "calf_seated",
    concentric: "AtoB",
    props: SEAT(96, 128),
    a: { pelvis: [96, 128], torso: 0, handRel: [26, 30], foot: [132, 176] },
    b: { pelvis: [96, 128], torso: 0, handRel: [26, 24], foot: [132, 168], heel: 40 },
  },
  plank: {
    id: "plank",
    concentric: "hold",
    a: { pelvis: [144, 158], torso: -78, hand: [100, 176], foot: [218, 176], elbow: 1, knee: 1 },
    b: { pelvis: [144, 158], torso: -78, hand: [100, 176], foot: [218, 176], elbow: 1, knee: 1 },
  },
  hanging_leg_raise: {
    id: "hanging_leg_raise",
    concentric: "AtoB",
    props: PULL_BAR,
    a: { pelvis: [106, 114], torso: 3, hand: [113, 13], foot: [104, 192], knee: -1 },
    b: { pelvis: [106, 114], torso: -6, hand: [113, 13], foot: [184, 108], knee: -1 },
  },
  crunch: {
    id: "crunch",
    concentric: "AtoB",
    a: { pelvis: [122, 170], torso: -90, handRel: [-10, -8], foot: [156, 176], elbow: -1 },
    b: { pelvis: [122, 170], torso: -60, handRel: [-10, -8], foot: [156, 176], elbow: -1 },
  },
  cable_crunch: {
    id: "cable_crunch",
    concentric: "AtoB",
    anchor: [116, -18],
    a: { pelvis: [104, 136], torso: 4, handRel: [6, -8], foot: [66, 176], knee: -1, elbow: -1 },
    b: { pelvis: [104, 136], torso: 76, handRel: [6, -8], foot: [66, 176], knee: -1, elbow: -1 },
  },
  rollout: {
    id: "rollout",
    concentric: "BtoA",
    tool: "wheel",
    a: { pelvis: [100, 136], torso: 36, hand: [134, 170], foot: [62, 176], knee: -1 },
    b: { pelvis: [110, 148], torso: 78, hand: [180, 170], foot: [62, 176], knee: -1 },
  },
  back_extension: {
    id: "back_extension",
    concentric: "AtoB",
    props: [{ kind: "poly", points: [[100, 126], [128, 108], [132, 114], [104, 132]] }, { kind: "line", from: [70, 178], to: [114, 130] }],
    a: { pelvis: [110, 118], torso: 128, handRel: [8, 10], foot: [66, 170], knee: -1 },
    b: { pelvis: [110, 118], torso: 42, handRel: [8, 10], foot: [66, 170], knee: -1 },
  },
  kb_swing: {
    id: "kb_swing",
    concentric: "AtoB",
    a: { pelvis: [100, 104], torso: 60, hand: [122, 140], foot: [116, 176] },
    b: { ...STAND, torso: -4, hand: [160, 48], foot: [116, 176], elbow: -1 },
  },
  farmer_walk: {
    id: "farmer_walk",
    concentric: "loop",
    a: { pelvis: [110, 98], torso: 2, handRel: HANG, foot: [92, 176], farFoot: [130, 176], heel: 0, farHeel: 20 },
    b: { pelvis: [110, 96], torso: 2, handRel: HANG, foot: [130, 176], farFoot: [92, 176], heel: 20, farHeel: 0 },
  },
} satisfies Record<string, Pattern>;

export type PatternId = keyof typeof PATTERNS;

/** Hand-checked pattern for every seed exercise (null: a side view cannot show it). */
const SEED: Record<string, PatternId | null> = {
  "bench-press-barbell": "bench_flat",
  "bench-press-dumbbell": "bench_flat",
  "incline-bench-press-barbell": "bench_incline",
  "incline-bench-press-dumbbell": "bench_incline",
  "chest-press-machine": "bench_flat",
  "cable-fly": "fly_cable",
  "push-up": "push_up",
  "diamond-push-up": "push_up",
  // Pike push-ups, woodchoppers, mountain climbers and the chest-supported row have no
  // accurate side-view pattern yet; photos (where the dataset has them) carry the Motion tab.
  "pike-push-up": null,
  "cable-woodchopper": null,
  "mountain-climber": null,
  "chest-supported-row-dumbbell": null,
  "bodyweight-squat": "squat_goblet",
  "single-leg-calf-raise": "calf_raise",
  "chest-dip": "dip",
  "deadlift-barbell": "deadlift",
  "pull-up": "pull_up",
  "lat-pulldown-cable": "pulldown",
  "bent-over-row-barbell": "row_bent",
  "seated-row-cable": "row_seated",
  "one-arm-row-dumbbell": "row_bent",
  "t-bar-row": "row_bent",
  "overhead-press-barbell": "ohp",
  "shoulder-press-dumbbell": "ohp",
  "lateral-raise-dumbbell": "raise",
  "face-pull-cable": "face_pull",
  "rear-delt-fly-machine": "rear_delt",
  "bicep-curl-barbell": "curl",
  "bicep-curl-dumbbell": "curl",
  "hammer-curl-dumbbell": "curl",
  "preacher-curl-machine": "curl_preacher",
  "triceps-pushdown-cable": "pushdown",
  "skullcrusher-barbell": "skullcrusher",
  "overhead-triceps-extension-dumbbell": "overhead_ext",
  "triceps-dip": "dip",
  "squat-barbell": "squat_back",
  "front-squat-barbell": "squat_front",
  "leg-press-machine": "leg_press",
  "leg-extension-machine": "leg_ext",
  "bulgarian-split-squat": "split_squat",
  "romanian-deadlift-barbell": "rdl",
  "leg-curl-machine": "leg_curl_lying",
  "hip-thrust-barbell": "hip_thrust",
  "walking-lunge-dumbbell": "lunge",
  "standing-calf-raise-machine": "calf_raise",
  "seated-calf-raise-machine": "calf_seated",
  plank: "plank",
  "hanging-leg-raise": "hanging_leg_raise",
  "cable-crunch": "cable_crunch",
  "shrug-barbell": "shrug",
  "kettlebell-swing": "kb_swing",
  "decline-bench-press-barbell": "bench_decline",
  "fly-dumbbell": "fly",
  "pec-deck-machine": "fly_seated",
  "close-grip-bench-press-barbell": "bench_flat",
  "chin-up": "pull_up",
  "straight-arm-pulldown-cable": "straight_arm_pulldown",
  "iso-row-machine": "row_seated",
  "rack-pull-barbell": "deadlift",
  "back-extension": "back_extension",
  "shrug-dumbbell": "shrug",
  "upright-row-barbell": "upright_row",
  "arnold-press-dumbbell": "ohp",
  "front-raise-dumbbell": "raise",
  "lateral-raise-cable": "raise",
  "reverse-fly-dumbbell": "rear_delt",
  "ez-bar-curl": "curl",
  "incline-curl-dumbbell": "curl",
  "concentration-curl-dumbbell": "curl",
  "bicep-curl-cable": "curl",
  "reverse-curl-barbell": "curl",
  "wrist-curl-barbell": "curl",
  "farmers-walk-dumbbell": "farmer_walk",
  "triceps-rope-pushdown-cable": "pushdown",
  "goblet-squat": "squat_goblet",
  "hack-squat-machine": "squat_back",
  "squat-smith-machine": "squat_back",
  "step-up-dumbbell": "step_up",
  "sumo-deadlift-barbell": "deadlift",
  "good-morning-barbell": "good_morning",
  "seated-leg-curl-machine": "leg_curl_seated",
  "glute-bridge-barbell": "glute_bridge",
  "hip-abduction-machine": null,
  "hip-adduction-machine": null,
  "bench-press-smith-machine": "bench_flat",
  crunch: "crunch",
  "russian-twist": null,
  "ab-wheel-rollout": "rollout",
};

/** Ordered keyword rules for catalog and custom exercises; the first match wins. */
const KEYWORDS: [RegExp, PatternId][] = [
  [/hip thrust/, "hip_thrust"],
  [/glute bridge|butt lift|bridge/, "glute_bridge"],
  [/leg press/, "leg_press"],
  [/leg extension/, "leg_ext"],
  [/seated leg curl/, "leg_curl_seated"],
  [/leg curl/, "leg_curl_lying"],
  [/seated calf/, "calf_seated"],
  [/calf/, "calf_raise"],
  [/split squat|bulgarian/, "split_squat"],
  [/step.?up/, "step_up"],
  [/lunge/, "lunge"],
  [/front squat/, "squat_front"],
  [/goblet/, "squat_goblet"],
  [/squat/, "squat_back"],
  [/romanian|stiff.?leg/, "rdl"],
  [/good morning/, "good_morning"],
  [/deadlift|rack pull/, "deadlift"],
  [/pull.?up|chin.?up/, "pull_up"],
  [/straight.?arm/, "straight_arm_pulldown"],
  [/pulldown|pull.?down/, "pulldown"],
  [/upright/, "upright_row"],
  [/face pull/, "face_pull"],
  [/seated.*row|cable.*row|machine.*row|iso row/, "row_seated"],
  [/row/, "row_bent"],
  [/shrug/, "shrug"],
  [/rear delt|reverse fl/, "rear_delt"],
  [/lateral raise|front raise|side raise|raise/, "raise"],
  [/cable cross|crossover|cable fly/, "fly_cable"],
  [/pec deck|butterfly/, "fly_seated"],
  [/fly|flye/, "fly"],
  [/incline.*(press|bench)/, "bench_incline"],
  [/decline.*(press|bench)/, "bench_decline"],
  [/bench press|chest press|floor press/, "bench_flat"],
  [/push.?up/, "push_up"],
  [/dip/, "dip"],
  [/military|shoulder press|overhead press|arnold|push press/, "ohp"],
  [/preacher/, "curl_preacher"],
  [/skull|lying triceps/, "skullcrusher"],
  [/triceps? extension|tricep extension|french press/, "overhead_ext"],
  [/pushdown|pressdown/, "pushdown"],
  [/curl/, "curl"],
  [/leg raise|knee raise/, "hanging_leg_raise"],
  [/cable crunch/, "cable_crunch"],
  [/crunch|sit.?up/, "crunch"],
  [/plank/, "plank"],
  [/hyperextension|back extension/, "back_extension"],
  [/rollout|ab roller|ab wheel/, "rollout"],
  [/swing/, "kb_swing"],
  [/farmer|carry/, "farmer_walk"],
];

export function patternFor(e: Pick<Exercise, "id" | "name" | "category">): Pattern | null {
  if (e.id in SEED) {
    const id = SEED[e.id];
    return id ? PATTERNS[id] : null;
  }
  if (e.category === "mobility" || e.category === "cardio") return null;
  const name = e.name.toLowerCase();
  for (const [re, id] of KEYWORDS) if (re.test(name)) return PATTERNS[id];
  return null;
}
