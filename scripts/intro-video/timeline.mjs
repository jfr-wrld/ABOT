/**
 * The intro's one source of truth: scene times, and every sound cue, on a 120 BPM grid (a beat is
 * 0.5 s), so picture (film.js) and sound (audio.mjs) hit the same instants. Moments are set
 * relative to their scene's start, so scenes can be reordered or resized here alone. Read by both
 * the browser (film) and Node (audio).
 */

export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;

/** Scene lengths in order; starts follow from them. */
const LENGTHS = [
  ["problem", 10],
  ["hook", 4.5],
  ["log", 7],
  ["bar", 6.5],
  ["routines", 7],
  ["exercises", 6.5],
  ["progress", 6.5],
  ["history", 6],
  ["streak", 9.5],
  ["story", 7.5],
  ["share", 7],
  ["phase", 6.5],
  ["settings", 5],
  ["trust", 5.5],
  ["outro", 6],
];

export const SCENES = {};
let start = 0;
for (const [name, len] of LENGTHS) {
  SCENES[name] = [start, start + len];
  start += len;
}
export const DURATION = start;

/** A moment `off` seconds into a scene, and `off` seconds before it ends. */
export const at = (scene, off) => SCENES[scene][0] + off;
export const before = (scene, off) => SCENES[scene][1] - off;
const every = (scene, from, step, n) => Array.from({ length: n }, (_, i) => at(scene, from + i * step));

/** The moments the picture is built around. */
export const T = {
  // The problem, meme style: a lifter who cannot remember last week.
  scratch: at("problem", 0),
  caption: at("problem", 0.25),
  guesses: every("problem", 2.0, 0.5, 3),
  boom: at("problem", 4.0),
  notes: at("problem", 5.5),
  trombone: at("problem", 6.5),
  better: at("problem", 8.5),
  spark: at("hook", 0),
  ignite: at("hook", 0.6),
  lock: at("hook", 1.3),
  sweep: at("hook", 1.5),
  letters: at("hook", 1.8),
  tag1: at("hook", 2.5),
  tag2: at("hook", 3.0),
  logIn: at("log", 0.1),
  ticks: every("log", 2.5, 0.5, 3),
  rest: every("bar", 1.5, 0.5, 3),
  go: at("bar", 3),
  barOpen: at("bar", 3.5),
  routinesIn: at("routines", 0.3),
  vault: at("routines", 3.5),
  splits: every("routines", 4.0, 0.25, 4),
  exercisesIn: at("exercises", 0.3),
  exerciseDetail: at("exercises", 3.0),
  bars: every("progress", 1.5, 0.5, 8),
  historyIn: at("history", 0.3),
  records: at("history", 1.5),
  bodyMap: at("history", 3.0),
  ember: at("streak", 0.5),
  flame: at("streak", 1),
  roll: at("streak", 2),
  plates: every("streak", 3, 0.25, 12),
  keepFire: at("streak", 6.5),
  layouts: every("story", 1.0, 0.5, 11),
  cards: every("share", 0.5, 0.25, 12),
  gather: at("share", 4.0),
  phaseWords: every("phase", 0.5, 0.5, 4),
  phaseIn: at("phase", 2.5),
  settingsIn: at("settings", 0.3),
  settingsLines: every("settings", 1.5, 0.5, 3),
  trustLines: every("trust", 0.5, 1, 4),
  outroHit: at("outro", 0.5),
  outroUrl: at("outro", 2),
  end: DURATION,
};

/** Sound cues: { t, kind, ...params }. audio.mjs knows each kind. */
export function cues() {
  const c = [];
  const add = (t, kind, p = {}) => c.push({ t, kind, ...p });
  const out = (scene) => add(before(scene, 0.35), "whoosh", { dur: 0.45 });
  // The problem.
  add(T.scratch, "scratch");
  add(T.caption + 0.15, "pop", { f: 420 });
  T.guesses.forEach((t, i) => add(t, "boing", { f: 300 + i * 90 }));
  add(T.boom, "boom");
  [0, 0.18, 0.36, 0.54, 0.72].forEach((d, i) => add(T.notes + d, "paper", { pan: i % 2 ? 0.4 : -0.4 }));
  add(T.trombone, "trombone");
  add(T.better - 0.15, "glitch");
  add(T.better + 0.2, "hit", { high: true });
  add(before("problem", 0.6), "riser", { dur: 0.6 });
  // Hook.
  add(T.ignite, "impact", { big: false });
  add(T.lock - 0.12, "whoosh", { dur: 0.25, up: true });
  add(T.lock, "clank");
  add(T.sweep, "sparkle");
  "ABOT".split("").forEach((_, i) => add(T.letters + i * 0.07, "pop", { f: 520 + i * 120 }));
  add(T.tag1, "hit");
  add(T.tag2, "hit", { high: true });
  out("hook");
  // Logging.
  add(T.logIn, "whoosh", { dur: 0.5, up: true });
  add(at("log", 1.1), "whoosh", { dur: 0.6, soft: true });
  T.ticks.forEach((t, i) => {
    add(t, "latch");
    add(t + 0.18, "count", { f: 880 + i * 220 });
  });
  out("log");
  // Workout bar.
  T.rest.forEach((t) => add(t, "pip"));
  add(T.go, "bell");
  add(T.barOpen, "pop", { f: 700 });
  add(T.barOpen + 0.08, "latch", { soft: true });
  out("bar");
  // Routines and the Template Vault.
  add(T.routinesIn, "whoosh", { dur: 0.5, up: true });
  add(T.vault, "swipe", { pan: 0.3 });
  add(T.vault + 0.05, "pop", { f: 760 });
  T.splits.forEach((t, i) => add(t, "tick", { f: 900 + i * 150 }));
  out("routines");
  // Exercises.
  add(T.exercisesIn, "whoosh", { dur: 0.5, up: true });
  add(T.exerciseDetail, "impact", { big: false });
  add(T.exerciseDetail + 0.1, "sparkle");
  out("exercises");
  // Progress.
  T.bars.forEach((t, i) => add(t, i === T.bars.length - 1 ? "pop" : "tick", { f: 600 + i * 90 }));
  add(T.bars.at(-1) + 0.05, "sparkle");
  out("progress");
  // Workout detail: records and the body map.
  add(T.historyIn, "whoosh", { dur: 0.5, up: true });
  add(T.records, "chord");
  add(T.bodyMap, "pop", { f: 640 });
  add(T.bodyMap + 0.1, "whoosh", { dur: 0.4, soft: true });
  add(before("history", 0.4), "riser", { dur: 0.4, soft: true });
  // Streak.
  add(T.ember, "riser", { dur: 0.5, soft: true });
  add(T.flame, "ignite");
  add(T.roll, "roll");
  T.plates.forEach((t, i) => add(t, "plate", { f: 520 + i * 45 }));
  add(T.plates.at(-1) + 0.3, "chord");
  add(T.keepFire, "hit", { high: true });
  out("streak");
  // Story Studio layouts.
  add(at("story", 0.3), "whoosh", { dur: 0.5, up: true });
  T.layouts.forEach((t, i) => add(t, "swipe", { pan: i % 2 ? 0.35 : -0.35 }));
  add(T.layouts.at(-1) + 0.1, "sparkle");
  out("story");
  // Streak themes.
  T.cards.forEach((t, i) => add(t, "swipe", { pan: i % 2 ? 0.4 : -0.4 }));
  add(T.gather, "impact", { big: false });
  add(T.gather + 0.1, "sparkle");
  out("share");
  // Body phase.
  // Quieter than other hits: four in two seconds over the kick stack up.
  T.phaseWords.forEach((t, i) => add(t, "hit", { high: i === 3, gain: 0.38 }));
  add(T.phaseIn, "whoosh", { dur: 0.5, up: true });
  out("phase");
  // Settings.
  add(T.settingsIn, "whoosh", { dur: 0.5, up: true });
  T.settingsLines.forEach((t, i) => add(t, "tick", { f: 1000 + i * 200 }));
  out("settings");
  // Trust.
  T.trustLines.forEach((t) => add(t, "tick", { f: 1200 }));
  add(at("trust", 2), "whoosh", { dur: 0.8, soft: true });
  add(before("trust", 0.9), "riser", { dur: 0.9 });
  // Outro.
  add(T.outroHit, "impact", { big: true });
  add(T.outroHit + 0.05, "clank");
  add(T.outroHit + 0.3, "shimmer");
  add(T.outroUrl, "pop", { f: 900 });
  return c.sort((a, b) => a.t - b.t);
}
