/**
 * The clock of a story card. A painter reads `time` (seconds into the clip) and asks how far
 * each beat has come; the still PNG is the same painter at STILL_TIME, so the picture and
 * the video can never disagree. Pure, so it is tested without a canvas.
 */

/** Length of a story video, and its frame rate. */
export const STORY_SECONDS = 7;
export const STORY_FPS = 30;
/** The moment a still is taken: every beat has landed, the closing card has not begun. */
export const STILL_TIME = 6;
/** The closing card (mark and @handle) runs from here to the end of the clip. */
export const END_CARD_AT = 6.2;

export type Ease = (x: number) => number;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const linear: Ease = (x) => x;
export const easeOut: Ease = (x) => 1 - (1 - x) ** 3;
export const easeInOut: Ease = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** Past the end and back: things that land (a stamp, a plate). */
export const backOut: Ease = (x) => {
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

/** How far a beat that starts at `start` and lasts `dur` seconds has come at `time`, eased. */
export function beat(time: number, start: number, dur: number, ease: Ease = easeOut): number {
  if (dur <= 0) return time >= start ? 1 : 0;
  return ease(clamp01((time - start) / dur));
}

/** The `i`th item of a list, each starting `each` seconds after the one before. */
export function stagger(time: number, i: number, start: number, each: number, dur: number, ease: Ease = easeOut): number {
  return beat(time, start + i * each, dur, ease);
}

/** A number counting up to `value` as `p` goes from 0 to 1, rounded like the final figure. */
export function countUp(value: number, p: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * clamp01(p) * f) / f;
}

/** Shown characters of `str` while typing it out. */
export function typed(str: string, p: number): string {
  return str.slice(0, Math.round(str.length * clamp01(p)));
}
