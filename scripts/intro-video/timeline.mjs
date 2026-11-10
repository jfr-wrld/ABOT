/**
 * The intro's one source of truth: scene times, and every sound cue, on a 120 BPM grid (a beat is
 * 0.5 s), so picture (film.js) and sound (audio.mjs) hit the same instants. Read by both the
 * browser (film) and Node (audio).
 */

export const FPS = 30;
export const DURATION = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;

export const SCENES = {
  hook: [0, 4.5],
  log: [4.5, 11.5],
  bar: [11.5, 18],
  progress: [18, 24.5],
  streak: [24.5, 34],
  share: [34, 42],
  phase: [42, 48.5],
  trust: [48.5, 54],
  outro: [54, 60],
};

/** The moments the picture is built around. */
export const T = {
  spark: 0,
  ignite: 0.6,
  lock: 1.3,
  sweep: 1.5,
  letters: 1.8,
  tag1: 2.5,
  tag2: 3.0,
  logIn: 4.6,
  ticks: [7.0, 7.5, 8.0],
  rest: [13.0, 13.5, 14.0],
  go: 14.5,
  barOpen: 15.0,
  bars: [19.5, 20.0, 20.5, 21.0, 21.5, 22.0, 22.5, 23.0],
  ember: 25.0,
  flame: 25.5,
  roll: 26.5,
  plates: Array.from({ length: 12 }, (_, i) => 27.5 + i * 0.25),
  keepFire: 31.0,
  cards: Array.from({ length: 12 }, (_, i) => 34.5 + i * 0.5),
  gather: 40.5,
  phaseWords: [42.5, 43.0, 43.5, 44.0],
  phaseIn: 44.5,
  trustLines: [49.0, 50.0, 51.0, 52.0],
  outroHit: 54.5,
  outroUrl: 56.0,
  end: 60,
};

/** Sound cues: { t, kind, ...params }. audio.mjs knows each kind. */
export function cues() {
  const c = [];
  const add = (t, kind, p = {}) => c.push({ t, kind, ...p });
  // Hook.
  add(0, "riser", { dur: 0.6 });
  add(T.ignite, "impact", { big: false });
  add(T.lock - 0.12, "whoosh", { dur: 0.25, up: true });
  add(T.lock, "clank");
  add(T.sweep, "sparkle");
  "ABOT".split("").forEach((_, i) => add(T.letters + i * 0.07, "pop", { f: 520 + i * 120 }));
  add(T.tag1, "hit");
  add(T.tag2, "hit", { high: true });
  add(4.2, "whoosh", { dur: 0.45 });
  // Logging.
  add(T.logIn, "whoosh", { dur: 0.5, up: true });
  add(5.6, "whoosh", { dur: 0.6, soft: true });
  T.ticks.forEach((t, i) => {
    add(t, "latch");
    add(t + 0.18, "count", { f: 880 + i * 220 });
  });
  add(11.2, "whoosh", { dur: 0.45 });
  // Workout bar.
  T.rest.forEach((t) => add(t, "pip"));
  add(T.go, "bell");
  add(T.barOpen, "pop", { f: 700 });
  add(T.barOpen + 0.08, "latch", { soft: true });
  add(17.6, "whoosh", { dur: 0.45 });
  // Progress.
  T.bars.forEach((t, i) => add(t, i === T.bars.length - 1 ? "pop" : "tick", { f: 600 + i * 90 }));
  add(T.bars.at(-1) + 0.05, "sparkle");
  add(24.1, "whoosh", { dur: 0.45 });
  // Streak.
  add(T.ember, "riser", { dur: 0.5, soft: true });
  add(T.flame, "ignite");
  add(T.roll, "roll");
  T.plates.forEach((t, i) => add(t, "plate", { f: 520 + i * 45 }));
  add(T.plates.at(-1) + 0.3, "chord");
  add(T.keepFire, "hit", { high: true });
  add(33.6, "whoosh", { dur: 0.45 });
  // Share.
  T.cards.forEach((t, i) => add(t, "swipe", { pan: i % 2 ? 0.4 : -0.4 }));
  add(T.gather, "impact", { big: false });
  add(T.gather + 0.1, "sparkle");
  add(41.6, "whoosh", { dur: 0.45 });
  // Body phase.
  T.phaseWords.forEach((t, i) => add(t, "hit", { high: i === 3 }));
  add(T.phaseIn, "whoosh", { dur: 0.5, up: true });
  add(48.1, "whoosh", { dur: 0.5, soft: true });
  // Trust.
  T.trustLines.forEach((t) => add(t, "tick", { f: 1200 }));
  add(50.5, "whoosh", { dur: 0.8, soft: true });
  add(53.6, "riser", { dur: 0.9 });
  // Outro.
  add(T.outroHit, "impact", { big: true });
  add(T.outroHit + 0.05, "clank");
  add(T.outroHit + 0.3, "shimmer");
  add(T.outroUrl, "pop", { f: 900 });
  return c.sort((a, b) => a.t - b.t);
}
