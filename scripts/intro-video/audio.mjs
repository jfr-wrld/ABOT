/**
 * The intro's soundtrack, synthesised offline (no samples, nothing licensed): every cue in
 * timeline.mjs as a sound effect, over a 120 BPM bed (kick, hats, bass, pad, claps at the streak
 * drop), mixed with headroom and a soft limiter, written as a 48 kHz stereo WAV. The latch, tick
 * and streak sounds follow the app's own (src/lib/sound-effects.ts).
 */
import { writeFileSync } from "node:fs";
import { BEAT, DURATION, SCENES, T, cues } from "./timeline.mjs";

const SR = 48_000;
const N = Math.ceil((DURATION + 0.5) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

/* ------------------------------------------------------------------ */
/* Voices                                                              */
/* ------------------------------------------------------------------ */

let seed = 0x9e3779b9;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const wave = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  tri: (p) => 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5),
  saw: (p) => 2 * (p % 1) - 1,
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
};

/** Adds one sample run to the mix with gain and pan (-1 left .. 1 right). */
function put(at, samples, gain = 1, pan = 0) {
  const s = Math.round(at * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length; i++) {
    const j = s + i;
    if (j < 0 || j >= N) continue;
    L[j] += samples[i] * gl;
    R[j] += samples[i] * gr;
  }
}

/**
 * A pitched tone: `from` gliding to `to` (exponential) over `dur`, a fast attack and an
 * exponential release, like the app's Web Audio tones.
 */
function tone({ type = "sine", from, to = from, dur, attack = 0.003, curve = 5 }) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const f = from * Math.pow(to / from, k);
    ph += f / SR;
    const env = Math.min(1, i / (attack * SR)) * Math.exp(-curve * k);
    out[i] = wave[type](ph) * env;
  }
  return out;
}

/** Noise through a band-pass that sweeps from `f0` to `f1`, shaped by `shape(k)`. */
function noiseSweep({ dur, f0, f1, q = 1.2, shape = (k) => Math.sin(Math.PI * k) }) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let lp = 0;
  let bp = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const f = f0 * Math.pow(f1 / f0, k);
    // State-variable filter, band-pass output.
    const fc = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR);
    const x = rand() * 2 - 1;
    lp += fc * bp;
    const hp = x - lp - bp / q;
    bp += fc * hp;
    out[i] = bp * shape(k);
  }
  return out;
}

/** A short burst of filtered noise: a click, a hat, a snap. */
function burst({ dur, hp = 0.0, lp = 1.0, curve = 30 }) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let a = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const x = rand() * 2 - 1;
    a += lp * (x - a);
    const h = a - prev * hp;
    prev = a;
    out[i] = h * Math.exp((-curve * i) / n);
  }
  return out;
}

const mix = (...parts) => {
  const n = Math.max(...parts.map(([s]) => s.length));
  const out = new Float32Array(n);
  for (const [s, g = 1, off = 0] of parts) {
    const o = Math.round(off * SR);
    for (let i = 0; i < s.length && i + o < n; i++) out[i + o] += s[i] * g;
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Sound effects                                                       */
/* ------------------------------------------------------------------ */

const SFX = {
  // A set ticked: the app's two-tone lock (600 then 900 Hz) with a wooden thock under it.
  latch: (c) =>
    put(c.t, mix([tone({ type: "tri", from: 600, dur: 0.05, curve: 6 }), 0.6], [tone({ type: "tri", from: 900, dur: 0.06, curve: 6 }), 0.6, 0.045], [tone({ from: 190, to: 120, dur: 0.09, curve: 7 }), 0.7], [burst({ dur: 0.008, hp: 0.9 }), 0.4]), c.soft ? 0.35 : 0.55),
  tick: (c) => put(c.t, mix([tone({ type: "tri", from: c.f ?? 1400, to: (c.f ?? 1400) * 0.35, dur: 0.03, curve: 8 }), 0.8], [burst({ dur: 0.006, hp: 0.95 }), 0.3]), 0.4),
  count: (c) => put(c.t, tone({ from: c.f, dur: 0.07, curve: 7 }), 0.18),
  pop: (c) => put(c.t, mix([tone({ from: (c.f ?? 700) * 1.7, to: c.f ?? 700, dur: 0.09, curve: 6 }), 1], [burst({ dur: 0.01, hp: 0.9 }), 0.2]), 0.38),
  pip: (c) => put(c.t, tone({ type: "tri", from: 800, dur: 0.08, curve: 4 }), 0.35),
  bell: (c) => put(c.t, mix([tone({ from: 1046.5, dur: 1.4, curve: 4 }), 0.6], [tone({ from: 2093, dur: 1.0, curve: 5 }), 0.3], [tone({ from: 3150, dur: 0.6, curve: 6 }), 0.15]), 0.4),
  // A plate locking on: inharmonic metal partials, a snap and a thud.
  clank: (c) =>
    put(
      c.t,
      mix(
        ...[523, 1243, 1897, 2731, 3612].map((f, i) => [tone({ from: f, dur: 0.7 - i * 0.1, curve: 6 + i }), 0.32 / (i + 1)]),
        [burst({ dur: 0.03, hp: 0.85, curve: 20 }), 0.6],
        [tone({ from: 95, to: 60, dur: 0.25, curve: 6 }), 0.8],
      ),
      0.6,
    ),
  impact: (c) => {
    const big = c.big ? 1.3 : 1;
    put(c.t, mix([tone({ from: 120 * big, to: 36, dur: 0.6 * big, curve: 4 }), 1], [burst({ dur: 0.35 * big, lp: 0.15, curve: 9 }), 0.7], [noiseSweep({ dur: 1.2 * big, f0: 3000, f1: 300, shape: (k) => Math.exp(-4 * k) }), 0.25]), 0.75 * big);
  },
  hit: (c) => put(c.t, mix([tone({ from: 140, to: 50, dur: 0.22, curve: 5 }), 0.9], [burst({ dur: 0.12, hp: 0.6, curve: 14 }), 0.45], [tone({ type: "tri", from: c.high ? 880 : 440, dur: 0.18, curve: 7 }), 0.25]), 0.55),
  whoosh: (c) => put(c.t, noiseSweep({ dur: c.dur, f0: c.up ? 300 : 2800, f1: c.up ? 3200 : 260, shape: (k) => Math.pow(Math.sin(Math.PI * k), 1.6) }), c.soft ? 0.18 : 0.32),
  swipe: (c) => put(c.t, noiseSweep({ dur: 0.22, f0: 900, f1: 4200, shape: (k) => Math.sin(Math.PI * k) }), 0.22, c.pan ?? 0),
  riser: (c) => put(c.t, mix([noiseSweep({ dur: c.dur, f0: 200, f1: 5000, shape: (k) => k * k }), 0.9], [tone({ type: "saw", from: 180, to: 720, dur: c.dur, attack: c.dur * 0.8, curve: 0.2 }), 0.08]), c.soft ? 0.18 : 0.3),
  sparkle: (c) => [2093, 2637, 3136, 4186, 3520].forEach((f, i) => put(c.t + i * 0.045, tone({ from: f, dur: 0.22, curve: 6 }), 0.09, (i % 2 ? 0.5 : -0.5) * 0.6)),
  // The streak catching: a thump, a short roar, crackles.
  ignite: (c) => {
    put(c.t, mix([tone({ from: 140, to: 45, dur: 0.45, curve: 4 }), 1], [noiseSweep({ dur: 0.7, f0: 200, f1: 1400, shape: (k) => Math.sin(Math.PI * k) }), 0.6]), 0.7);
    for (let i = 0; i < 14; i++) put(c.t + 0.08 + i * 0.09 + rand() * 0.05, burst({ dur: 0.012, hp: 0.95 }), 0.12 + rand() * 0.08, rand() - 0.5);
  },
  roll: (c) => {
    put(c.t, tone({ from: 587.33, dur: 0.12, curve: 6 }), 0.2);
    put(c.t + 0.09, tone({ from: 783.99, dur: 0.2, curve: 5 }), 0.22);
  },
  plate: (c) => put(c.t, mix([tone({ type: "tri", from: c.f, dur: 0.05, curve: 7 }), 0.7], [tone({ from: c.f * 2.71, dur: 0.12, curve: 8 }), 0.25]), 0.3),
  chord: (c) => [392, 493.88, 587.33, 783.99, 196].forEach((f, i) => put(c.t, tone({ type: i === 4 ? "tri" : "sine", from: f, dur: 1.8, attack: 0.01, curve: 2.5 }), i === 4 ? 0.14 : 0.1)),
  shimmer: (c) => [1567.98, 1975.53, 2349.32, 3135.96].forEach((f, i) => put(c.t + i * 0.06, tone({ from: f, dur: 2.6, attack: 0.05, curve: 2.2 }), 0.05, (i - 1.5) * 0.3)),
  // Meme-style cues for the problem scene, all synthesised here (no recorded memes).
  // A record scratch: band-passed noise whose pitch rocks back and forth, then a stop.
  scratch: (c) => {
    const dur = 0.42;
    const n = Math.round(dur * SR);
    const out = new Float32Array(n);
    let lp = 0;
    let bp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const f = 700 + 1800 * Math.abs(Math.sin(k * Math.PI * 3.2)) * (1 - k * 0.6);
      const fc = 2 * Math.sin((Math.PI * f) / SR);
      const x = rand() * 2 - 1;
      lp += fc * bp;
      bp += fc * (x - lp - bp / 0.8);
      out[i] = bp * Math.min(1, k * 40) * (k < 0.85 ? 1 : (1 - k) / 0.15);
    }
    put(c.t, mix([out, 1], [tone({ type: "saw", from: 220, to: 70, dur: 0.4, curve: 2 }), 0.12]), 0.5);
  },
  // A cartoon spring: a pitch that wobbles up and settles.
  boing: (c) => {
    const dur = 0.45;
    const n = Math.round(dur * SR);
    const out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const f = c.f * (1 + 0.9 * Math.exp(-5 * k) * Math.sin(k * Math.PI * 14)) * (1 + k * 0.6);
      ph += f / SR;
      out[i] = wave.sine(ph) * Math.exp(-4 * k) * Math.min(1, i / 60);
    }
    put(c.t, out, 0.4);
  },
  // A deep cinematic boom with a long tail, for the dramatic zoom.
  boom: (c) =>
    put(
      c.t,
      mix(
        [tone({ from: 90, to: 38, dur: 1.6, curve: 2.5 }).map((x) => Math.tanh(x * 2.4)), 1],
        [tone({ type: "tri", from: 60, to: 45, dur: 1.2, curve: 3 }), 0.4],
        [burst({ dur: 0.08, lp: 0.3, curve: 12 }), 0.5],
      ),
      0.85,
    ),
  // Paper flicking past.
  paper: (c) => put(c.t, noiseSweep({ dur: 0.16, f0: 2500, f1: 6000, q: 0.7, shape: (k) => Math.sin(Math.PI * k) * (1 - k * 0.5) }), 0.16, c.pan ?? 0),
  // The sad trombone: four falling notes, the last one long and wobbling.
  trombone: (c) => {
    const notes = [
      [196, 0.32],
      [185, 0.32],
      [174.6, 0.32],
      [164.8, 1.2],
    ];
    let t = c.t;
    notes.forEach(([f, d], i) => {
      const n = Math.round(d * SR);
      const out = new Float32Array(n);
      let ph = 0;
      let lp = 0;
      for (let j = 0; j < n; j++) {
        const k = j / n;
        const vib = i === 3 ? 1 + 0.035 * Math.sin(2 * Math.PI * 5.5 * (j / SR)) * Math.min(1, k * 3) : 1;
        ph += (f * vib) / SR;
        lp += 0.08 * (wave.saw(ph) - lp);
        const env = Math.min(1, j / (0.03 * SR)) * (i === 3 ? Math.exp(-1.6 * k) : 1 - k * 0.3);
        out[j] = lp * env;
      }
      put(t, out, 0.5);
      t += d * 0.95;
    });
  },
  // A digital glitch into the turn: crushed bursts.
  glitch: (c) => [0, 0.05, 0.09, 0.16].forEach((d, i) => put(c.t + d, burst({ dur: 0.04, hp: 0.5, curve: 4 }).map((x) => Math.round(x * 4) / 4), 0.25, i % 2 ? 0.5 : -0.5)),
};

/* ------------------------------------------------------------------ */
/* Music bed                                                           */
/* ------------------------------------------------------------------ */

const ROOTS = [55, 43.65, 65.41, 49]; // A, F, C, G: one bar (2 s) each.
const CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 261.63, 329.63],
  [196, 246.94, 293.66],
];

function kick(t, g = 0.7) {
  put(t, mix([tone({ from: 150, to: 42, dur: 0.32, curve: 5 }), 1], [burst({ dur: 0.01, hp: 0.9 }), 0.25]), g);
}
function hat(t, g = 0.08) {
  put(t, burst({ dur: 0.04, hp: 0.98, curve: 25 }), g, 0.25);
}
function clap(t, g = 0.22) {
  [0, 0.012, 0.024].forEach((d) => put(t + d, noiseSweep({ dur: 0.08, f0: 1500, f1: 1100, q: 2, shape: (k) => Math.exp(-6 * k) }), g, -0.15));
}
function bassNote(t, f, len, g = 0.22) {
  put(t, mix([tone({ type: "tri", from: f, dur: len, attack: 0.005, curve: 3 }), 1], [tone({ from: f * 2, dur: len * 0.6, curve: 6 }), 0.2]), g);
}
function pad(t, notes, len, g = 0.05) {
  notes.forEach((f, i) => {
    [-0.004, 0.004].forEach((det, j) => put(t, tone({ type: "saw", from: f * (1 + det), dur: len, attack: 0.35, curve: 1.2 }), g * 0.5, j ? 0.35 : -0.35));
    put(t, tone({ from: f * 2, dur: len, attack: 0.4, curve: 1.5 }), g * 0.4, (i - 1) * 0.3);
  });
}

function musicBed() {
  const bars = Math.ceil(DURATION / (BEAT * 4));
  for (let b = 0; b < bars; b++) {
    const t0 = b * BEAT * 4;
    const idx = b % 4;
    const inS = (name) => t0 >= SCENES[name][0] - 0.01 && t0 < SCENES[name][1];
    const quiet = inS("trust");
    const drop = t0 >= T.flame - 0.01 && t0 < SCENES.streak[1];
    const intro = t0 >= SCENES.hook[0] - 0.01 && t0 < SCENES.log[0];
    // The problem plays over silence, so the meme cues land on their own.
    if (t0 < SCENES.hook[0] - 0.01) continue;
    const outro = inS("outro");
    pad(t0, CHORDS[idx], BEAT * 4 + 0.3, outro ? 0.07 : quiet ? 0.04 : drop ? 0.07 : 0.05);
    if (intro || outro) continue;
    // The break before the streak drop: only the pad.
    if (t0 >= SCENES.streak[0] - 0.01 && t0 < T.flame) continue;
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * BEAT;
      if (!quiet) kick(t, drop ? 0.8 : 0.62);
      hat(t + BEAT / 2, quiet ? 0.05 : 0.08);
      if (drop || inS("share") || inS("story")) hat(t + BEAT / 4, 0.035);
      if ((drop || inS("share") || inS("story")) && (q === 1 || q === 3)) clap(t);
      bassNote(t, ROOTS[idx], BEAT * 0.9, quiet ? 0.12 : 0.22);
      if (!quiet) bassNote(t + BEAT / 2, ROOTS[idx] * 2, BEAT * 0.4, 0.1);
    }
  }
  // The last chord rings out under the outro.
  pad(SCENES.outro[0] + 0.5, [220, 277.18, 329.63, 440], 5.5, 0.06);
}

/* ------------------------------------------------------------------ */
/* Mix and write                                                       */
/* ------------------------------------------------------------------ */

function writeWav(file) {
  // Normalise to -1 dBFS, then a gentle tanh limiter for the peaks.
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  const data = Buffer.alloc(44 + N * 4);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + N * 4, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(N * 4, 40);
  const fadeOut = Math.round(0.6 * SR);
  for (let i = 0; i < N; i++) {
    const fade = i > N - fadeOut ? (N - i) / fadeOut : 1;
    const l = Math.tanh(L[i] * g * 1.15) * fade;
    const r = Math.tanh(R[i] * g * 1.15) * fade;
    data.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  writeFileSync(file, data);
  return { peakDb: 20 * Math.log10(Math.tanh(1.15 * 0.89)) };
}

export function renderAudio(file) {
  L.fill(0);
  R.fill(0);
  musicBed();
  // Effects over the bed: scale the bed down so the hits read.
  for (let i = 0; i < N; i++) {
    L[i] *= 0.55;
    R[i] *= 0.55;
  }
  for (const c of cues()) {
    const f = SFX[c.kind];
    if (!f) throw new Error(`no sound for cue kind ${c.kind}`);
    f(c);
  }
  return writeWav(file);
}
