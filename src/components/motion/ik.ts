export type Vec = [number, number];

/**
 * Two-bone inverse kinematics (shoulder-elbow-hand, hip-knee-ankle). Returns the middle joint
 * and the end point. Bone lengths are always kept: an out-of-reach target is approached in a
 * straight line, a target too close folds the limb. `bend` (+1 / -1) picks the side the
 * middle joint goes to, measured counter-clockwise from the root-to-target direction.
 */
export function solveTwoBone(root: Vec, target: Vec, a: number, b: number, bend: 1 | -1): { mid: Vec; end: Vec } {
  let dx = target[0] - root[0];
  let dy = target[1] - root[1];
  let d = Math.hypot(dx, dy);
  if (d < 1e-6) {
    dx = 0;
    dy = 1;
    d = 1e-6;
  }
  const ux = dx / d;
  const uy = dy / d;
  const reach = Math.min(Math.max(d, Math.abs(a - b) + 1e-6), a + b - 1e-6);
  const cos = Math.min(1, Math.max(-1, (a * a + reach * reach - b * b) / (2 * a * reach)));
  const ang = Math.acos(cos) * bend;
  const mx = ux * Math.cos(ang) - uy * Math.sin(ang);
  const my = ux * Math.sin(ang) + uy * Math.cos(ang);
  const mid: Vec = [root[0] + mx * a, root[1] + my * a];
  const ex = root[0] + ux * reach - mid[0];
  const ey = root[1] + uy * reach - mid[1];
  const el = Math.hypot(ex, ey) || 1;
  return { mid, end: [mid[0] + (ex / el) * b, mid[1] + (ey / el) * b] };
}
