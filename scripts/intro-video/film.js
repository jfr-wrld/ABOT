/**
 * The ABOT intro, drawn on one 1080 x 1920 canvas by renderAt(t): a pure function of time, so
 * render.mjs can step it frame by frame and every frame is the same on every run. Scenes and hit
 * times come from timeline.mjs; real app screens, the logo and flame paths come in through
 * window.ASSETS (set by render.mjs).
 */
import { SCENES, T, at, before } from "./timeline.mjs";

const W = 1080;
const H = 1920;
const VOLT = "#ccff00";
const OBS = "#09090b";
const INK = "#f4f4f5";
const MUTED = "#a1a1aa";
const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

const A = window.ASSETS;
const cv = document.getElementById("film");
const ctx = cv.getContext("2d");

/* ------------------------------------------------------------------ */
/* Easing and time                                                     */
/* ------------------------------------------------------------------ */

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const outCubic = (k) => 1 - Math.pow(1 - k, 3);
const inCubic = (k) => k * k * k;
const inOutCubic = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const outExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
const outBack = (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
/** A pulse that peaks at `at` and fades over `len`. */
const pulse = (t, at, len = 0.35) => (t < at ? 0 : Math.max(0, 1 - (t - at) / len));
const inScene = (t, name) => t >= SCENES[name][0] && t < SCENES[name][1];
/** 0 to 1 entering a scene over `len`, and 1 to 0 leaving over `len`. */
function presence(t, name, len = 0.45) {
  const [a, b] = SCENES[name];
  return Math.min(outCubic(prog(t, a, a + len)), 1 - inCubic(prog(t, b - len, b)));
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

const img = {};
function load(name, src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => {
      img[name] = i;
      res();
    };
    i.onerror = rej;
    i.src = src;
  });
}

const P = {
  A: new Path2D(A.mark.A),
  BAR: new Path2D(A.mark.BAR),
  L: new Path2D(A.mark.L),
  R: new Path2D(A.mark.R),
  fo: new Path2D(A.flame.outer),
  fm: new Path2D(A.flame.middle),
  fc: new Path2D(A.flame.core),
  plate: new Path2D("M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z"),
};

/* ------------------------------------------------------------------ */
/* Drawing helpers                                                     */
/* ------------------------------------------------------------------ */

function font(size, weight = 800, family = SANS, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = `${tracking}px`;
}

function text(s, x, y, o = {}) {
  font(o.size ?? 64, o.weight ?? 800, o.family ?? SANS, o.tracking ?? 0);
  ctx.fillStyle = o.color ?? INK;
  ctx.textAlign = o.align ?? "center";
  ctx.textBaseline = o.baseline ?? "alphabetic";
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = "0px";
}

/** Words that rise out of a slot one after another from `at`, centred on x. */
function riseLine(t, at, s, x, y, o = {}) {
  const words = s.split(" ");
  // Measured and drawn with the same tracking, so the gaps between words stay even.
  o = { ...o, tracking: o.tracking ?? -2 };
  font(o.size ?? 88, o.weight ?? 800, o.family ?? SANS, o.tracking);
  const gap = (o.size ?? 88) * 0.28;
  const widths = words.map((w) => ctx.measureText(w).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let cx = x - total / 2;
  const size = o.size ?? 88;
  words.forEach((w, i) => {
    const k = outExpo(prog(t, at + i * (o.stagger ?? 0.08), at + i * (o.stagger ?? 0.08) + 0.5));
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 10, y - size * 1.05, widths[i] + 20, size * 1.35);
    ctx.clip();
    text(w, cx, y + (1 - k) * size * 1.2, { ...o, align: "left", alpha: (o.alpha ?? 1) * clamp(k * 1.5) });
    ctx.restore();
    cx += widths[i] + gap;
  });
}

function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Obsidian with a slow Volt glow and a faint grid that drifts, behind every scene. */
function background(t, glowY = 760, glow = 0.18) {
  ctx.fillStyle = OBS;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, glowY, 0, W / 2, glowY, 900);
  g.addColorStop(0, `rgba(204,255,0,${glow})`);
  g.addColorStop(1, "rgba(204,255,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 2;
  const off = (t * 24) % 120;
  for (let y = -120 + off; y < H; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let x = 0; x <= W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
}

/**
 * A phone showing `screen` (a 1080 x 2280 capture), whole, never zoomed. Returns where screen
 * pixels land on the canvas, so a card can be lifted out of it (liftCard).
 */
function phone(screen, cx, cy, w, o = {}) {
  const im = img[screen];
  const h = w * (2280 / 1080);
  const pad = w * 0.035;
  const geo = { x0: cx - w / 2, y0: cy - h / 2, s: w / 1080, w, h };
  if (!im) return geo;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(o.rot ?? 0);
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  rrect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, w * 0.14);
  ctx.fillStyle = "#18181b";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.stroke();
  rrect(-w / 2, -h / 2, w, h, w * 0.11);
  ctx.save();
  ctx.clip();
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  // The phone dims while a card is lifted out of it.
  if (o.dim) {
    ctx.fillStyle = `rgba(0,0,0,${o.dim})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
  ctx.restore();
  return geo;
}

/**
 * A card of the screen lifted out of the phone toward the viewer: it rises from where it sits on
 * the phone (geo) to `to` (centre x, centre y, width), growing, with a shadow and a Volt edge.
 * `k` is 0 (in place) to 1 (lifted). Returns a map from screen pixels to the canvas for overlays.
 */
function liftCard(screen, box, geo, k, to, o = {}) {
  const im = img[screen];
  if (!im || !box || k <= 0) return null;
  const pad = o.pad ?? 0;
  const bx = Math.max(0, box.x - pad);
  const by = Math.max(0, box.y - pad);
  const bw = Math.min(1080 - bx, box.w + pad * 2);
  const bh = Math.min(o.maxH ?? 2280, 2280 - by, box.h + pad * 2 + (o.padB ?? 0));
  const fromW = bw * geo.s;
  const fromX = geo.x0 + bx * geo.s + fromW / 2;
  const fromY = geo.y0 + by * geo.s + (bh * geo.s) / 2;
  const w = lerp(fromW, to[2], k);
  const h = (bh / bw) * w;
  const x = lerp(fromX, to[0], k);
  const y = lerp(fromY, to[1], k);
  const r = 22 * (w / fromW) * geo.s * 3;
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${0.75 * k})`;
  ctx.shadowBlur = 90 * k;
  ctx.shadowOffsetY = 40 * k;
  rrect(x - w / 2, y - h / 2, w, h, r);
  ctx.fillStyle = OBS;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  rrect(x - w / 2, y - h / 2, w, h, r);
  ctx.clip();
  ctx.drawImage(im, bx, by, bw, bh, x - w / 2, y - h / 2, w, h);
  ctx.restore();
  ctx.strokeStyle = `rgba(204,255,0,${0.9 * k})`;
  ctx.lineWidth = 5;
  rrect(x - w / 2, y - h / 2, w, h, r);
  ctx.stroke();
  ctx.restore();
  const sc = w / bw;
  return (px, py) => [x - w / 2 + (px - bx) * sc, y - h / 2 + (py - by) * sc, sc];
}

/** How far a lift has come: rises over 0.55 s from `from`, settles back over 0.4 s before `until`. */
function lift(t, from, until) {
  return outBack(prog(t, from, from + 0.55), 1.25) * (1 - inOutCubic(prog(t, until - 0.4, until)));
}
/** The ABOT mark assembling: the A punches up at `a`, the plates slide on and lock at `lock`. */
function mark(t, cx, cy, size, a, lock, o = {}) {
  const k = size / 100;
  const ka = outBack(prog(t, a, a + 0.4), 2.2);
  const kp = outBack(prog(t, lock - 0.3, lock), 1.4);
  const shake = pulse(t, lock, 0.25) * 8 * Math.sin(t * 90);
  ctx.save();
  ctx.translate(cx - 50 * k + shake, cy - 50 * k);
  ctx.scale(k, k);
  ctx.fillStyle = o.color ?? VOLT;
  if (o.glow) {
    ctx.shadowColor = "rgba(204,255,0,0.55)";
    ctx.shadowBlur = 40;
  }
  // The A, from the base.
  if (ka > 0) {
    ctx.save();
    ctx.translate(50, 88);
    ctx.scale(lerp(0.4, 1, ka), lerp(0.2, 1, ka));
    ctx.translate(-50, -88);
    ctx.globalAlpha = clamp(ka * 2);
    ctx.fill(P.A);
    ctx.fill(P.BAR);
    ctx.restore();
  }
  // The plates, from the sides.
  if (kp > 0) {
    ctx.globalAlpha = clamp(kp * 2);
    ctx.save();
    ctx.translate(-(1 - kp) * 60, 0);
    ctx.fill(P.L);
    ctx.restore();
    ctx.save();
    ctx.translate((1 - kp) * 60, 0);
    ctx.fill(P.R);
    ctx.restore();
  }
  ctx.restore();
  // One band of light across it.
  if (o.sweepAt !== undefined) {
    const ks = prog(t, o.sweepAt, o.sweepAt + 0.5);
    if (ks > 0 && ks < 1) {
      ctx.save();
      ctx.translate(cx - 50 * k, cy - 50 * k);
      ctx.scale(k, k);
      ctx.clip(new Path2D(A.mark.all));
      const x = lerp(-40, 140, inOutCubic(ks));
      const g = ctx.createLinearGradient(x - 25, 0, x + 25, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.75)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-20, 0, 160, 100);
      ctx.restore();
    }
  }
}

/** The streak flame, flickering by time. */
function flame(t, cx, bottom, height, grow = 1) {
  const k = (height / 160) * grow;
  const layers = [
    [P.fo, VOLT, 1.5, 0.05, 0.025],
    [P.fm, "#facc15", 1.1, 0.06, 0.02],
    [P.fc, "#fffbe6", 0.8, 0.07, 0.015],
  ];
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.shadowColor = "rgba(204,255,0,0.7)";
  ctx.shadowBlur = 70;
  layers.forEach(([p, color, period, amp, skew], i) => {
    const ph = (t / period) * Math.PI * 2 + i;
    ctx.save();
    ctx.scale(k, k * (1 + amp * Math.sin(ph) + amp * 0.5 * Math.sin(ph * 2.3)));
    ctx.transform(1, 0, skew * Math.sin(ph * 0.9), 1, 0, 0);
    ctx.translate(-60, -160);
    ctx.fillStyle = color;
    ctx.fill(p);
    ctx.restore();
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}

/** Embers drifting up from a point, deterministic in t. */
function embers(t, cx, cy, from, n = 26, spread = 260) {
  for (let i = 0; i < n; i++) {
    const life = 1.4 + (i % 5) * 0.25;
    const start = from + ((i * 0.37) % 1.6);
    if (t < start) continue;
    const age = ((t - start) % life) / life;
    const x = cx + (((i * 73) % spread) - spread / 2) + Math.sin(age * 6 + i) * 18;
    const y = cy - age * (420 + (i % 4) * 80);
    ctx.globalAlpha = Math.sin(age * Math.PI) * 0.9;
    ctx.fillStyle = i % 3 ? VOLT : "#facc15";
    ctx.beginPath();
    ctx.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A Volt ring that spreads from a point. */
function ripple(t, at, x, y, r0, r1, len = 0.45) {
  const k = prog(t, at, at + len);
  if (k <= 0 || k >= 1) return;
  ctx.strokeStyle = `rgba(204,255,0,${(1 - k) * 0.9})`;
  ctx.lineWidth = 6 * (1 - k) + 1;
  ctx.beginPath();
  ctx.arc(x, y, lerp(r0, r1, outCubic(k)), 0, Math.PI * 2);
  ctx.stroke();
}

function flash(t, at, alpha = 0.6, len = 0.35) {
  const k = pulse(t, at, len);
  if (k <= 0) return;
  ctx.fillStyle = `rgba(204,255,0,${k * alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function label(s, y, alpha = 1, color = VOLT) {
  text(s, W / 2, y, { size: 30, weight: 700, family: MONO, tracking: 8, color, alpha });
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* The problem: a meme opening with an illustrated lifter              */
/* ------------------------------------------------------------------ */

const MEME = '"Anton", Impact, sans-serif';
const SKIN = "#e3a77c";
const HAIR = "#2d1e14";
const SHIRT = "#5b6c8f";
const SHORTS = "#23262d";
const INKPEN = "#2f3fae";
/** Deterministic noise, so every render of a frame is the same frame. */
const rnd = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Meme caption: Anton, upper case, white with a heavy black outline, popping in at `from`. */
function meme(t, from, s, x, y, o = {}) {
  const k = outBack(prog(t, from, from + 0.28), 2.4);
  if (k <= 0) return;
  const size = o.size ?? 110;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.rotate(o.rot ?? 0);
  font(size, 400, MEME, 1);
  // Shrinks to fit inside the frame with a 60 px margin.
  const fit = Math.min(1, (W - 120) / (ctx.measureText(s).width + size * 0.16));
  ctx.scale(fit, fit);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = (o.alpha ?? 1) * clamp(k * 3);
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = o.stroke ?? "#000";
  ctx.strokeText(s, 0, 0);
  ctx.fillStyle = o.color ?? "#fff";
  ctx.fillText(s, 0, 0);
  ctx.restore();
  ctx.letterSpacing = "0px";
}

/** Head-local face. mood: "calm" | "think" | "shock" | "sad". */
function face(mood) {
  const eye = (x) => {
    const shock = mood === "shock";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(x, -4, shock ? 30 : 20, shock ? 34 : 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    const look = mood === "think" ? [-6, -9] : mood === "sad" ? [0, 8] : [0, 0];
    ctx.arc(x + look[0], -4 + look[1], shock ? 5 : 9, 0, Math.PI * 2);
    ctx.fill();
    if (mood === "sad") {
      // Heavy lids.
      ctx.fillStyle = SKIN;
      ctx.fillRect(x - 24, -30, 48, 24);
    }
  };
  eye(-38);
  eye(38);
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  const brow = (x0, y0, x1, y1) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  if (mood === "think") {
    brow(-60, -52, -18, -58);
    brow(18, -36, 60, -44);
  } else if (mood === "shock") {
    brow(-62, -66, -18, -70);
    brow(18, -70, 62, -66);
  } else if (mood === "sad") {
    brow(-62, -30, -20, -44);
    brow(20, -44, 62, -30);
  } else {
    brow(-60, -40, -18, -42);
    brow(18, -42, 60, -40);
  }
  ctx.strokeStyle = "#7a3b2a";
  ctx.lineWidth = 7;
  ctx.beginPath();
  if (mood === "shock") {
    ctx.fillStyle = "#3a0d0d";
    ctx.ellipse(0, 52, 18, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === "sad") {
    ctx.arc(0, 70, 26, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (mood === "think") {
    ctx.moveTo(-14, 50);
    ctx.quadraticCurveTo(4, 42, 26, 54);
    ctx.stroke();
  } else {
    ctx.arc(0, 30, 26, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
}

/** The lifter, front on, feet at y 1470. `slump` 0..1 drops the shoulders and head. */
function lifter(t, mood, tilt, slump) {
  const cx = W / 2;
  const up = slump * 34;
  // Legs and shoes.
  ctx.strokeStyle = SKIN;
  ctx.lineCap = "round";
  ctx.lineWidth = 58;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(cx + s * 58, 1230);
    ctx.lineTo(cx + s * 70, 1440);
    ctx.stroke();
    ctx.fillStyle = "#f4f4f5";
    ctx.beginPath();
    ctx.ellipse(cx + s * 84, 1468, 58, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  rrect(cx - 128, 1180 + up * 0.3, 256, 120, 30);
  ctx.fillStyle = SHORTS;
  ctx.fill();
  // Torso.
  rrect(cx - 132, 960 + up, 264, 250 - up * 0.7, 64);
  ctx.fillStyle = SHIRT;
  ctx.fill();
  // Arms holding the notebook.
  const hand = 1090 + up * 1.6;
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 46;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(cx + s * 128, 1000 + up);
    ctx.lineTo(cx + s * 142, 1110 + up);
    ctx.lineTo(cx + s * 62, hand);
    ctx.stroke();
    ctx.fillStyle = SHIRT;
    ctx.beginPath();
    ctx.arc(cx + s * 122, 1000 + up, 40, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.save();
  ctx.translate(cx, hand + 6);
  ctx.rotate(-0.06 + slump * 0.2);
  rrect(-92, -64, 184, 128, 10);
  ctx.fillStyle = "#fbfaf6";
  ctx.fill();
  ctx.strokeStyle = "rgba(47,63,174,0.35)";
  ctx.lineWidth = 3;
  for (let y = -36; y <= 44; y += 20) {
    ctx.beginPath();
    ctx.moveTo(-74, y);
    ctx.lineTo(74, y);
    ctx.stroke();
  }
  font(30, 700, MONO);
  ctx.fillStyle = INKPEN;
  ctx.textAlign = "center";
  ctx.fillText("???", 0, 10);
  ctx.restore();
  // Neck and head.
  ctx.fillStyle = SKIN;
  ctx.fillRect(cx - 26, 910 + up, 52, 70);
  ctx.save();
  ctx.translate(cx, 840 + up * 1.7);
  ctx.rotate(tilt + slump * 0.12);
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.arc(s * 104, 6, 22, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(0, 0, 106, 0, Math.PI * 2);
  ctx.fill();
  // Hair: a cap clipped to the head with a short ragged fringe.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 108, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.moveTo(-120, -130);
  ctx.lineTo(120, -130);
  ctx.lineTo(120, -40);
  for (let i = 0; i <= 8; i++) ctx.lineTo(110 - i * 27.5, i % 2 ? -66 : -48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  face(mood);
  ctx.restore();
}

/** The gym the lifter stands in: a pale wall, a floor and a loaded rack. */
function gym() {
  ctx.fillStyle = "#d9d4c7";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#b9b2a3";
  ctx.fillRect(0, 1440, W, H - 1440);
  ctx.fillStyle = "#a59e8f";
  ctx.fillRect(0, 1430, W, 14);
  ctx.fillStyle = "#5c5f66";
  [840, 980].forEach((x) => ctx.fillRect(x - 14, 820, 28, 620));
  ctx.fillRect(760, 930, 320, 14);
  ctx.fillStyle = "#26282d";
  [790, 1030].forEach((x) => {
    rrect(x - 22, 830, 44, 214, 12);
    ctx.fill();
  });
}

/** A crumpled scrap of notes falling from the top to land at (x, y). */
function note(t, from, x, y, rot, s) {
  const k = prog(t, from, from + 0.5);
  if (k <= 0) return;
  const yy = lerp(-200, y, outBack(k, 1.3));
  ctx.save();
  ctx.translate(x, yy);
  ctx.rotate(rot + (1 - k) * 1.4);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#fbfaf2";
  ctx.beginPath();
  // An uneven outline reads as crumpled paper.
  const pts = [[-170, -84], [-40, -96], [90, -80], [176, -90], [168, 0], [180, 86], [40, 92], [-90, 80], [-178, 92], [-166, 4]];
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-120, -60);
  ctx.lineTo(-20, 40);
  ctx.lineTo(110, -30);
  ctx.stroke();
  font(44, 700, MONO);
  ctx.fillStyle = INKPEN;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, 0, 4);
  ctx.restore();
}

const glitchBuf = document.createElement("canvas");
glitchBuf.width = W;
glitchBuf.height = H;

/** Shifted horizontal slices with a split colour edge, strongest at `at`. */
function glitch(t, at0, len = 0.3) {
  const k = 1 - Math.abs(t - at0) / len;
  if (k <= 0) return;
  const g = glitchBuf.getContext("2d");
  g.clearRect(0, 0, W, H);
  g.drawImage(cv, 0, 0);
  const f = Math.round(t * 30);
  for (let i = 0; i < 14; i++) {
    const y = rnd(f * 31 + i) * H;
    const h = 20 + rnd(f * 17 + i) * 140;
    const dx = (rnd(f * 7 + i) - 0.5) * 260 * k;
    ctx.drawImage(glitchBuf, 0, y, W, h, dx, y, W, h);
    ctx.fillStyle = i % 2 ? `rgba(255,0,80,${0.25 * k})` : `rgba(0,240,255,${0.25 * k})`;
    ctx.fillRect(dx * 0.5, y, W, 6);
  }
}

function problem(t) {
  const [a] = SCENES.problem;
  const boomOn = t >= T.boom && t < T.notes;
  const mood = t >= T.trombone ? "sad" : boomOn ? "shock" : t >= at("problem", 1.0) ? "think" : "calm";
  const tilts = [-0.14, 0.14, -0.1];
  const g = T.guesses.filter((x) => t >= x).length;
  const tilt = g && t < T.boom ? tilts[g - 1] * outBack(prog(t, T.guesses[g - 1], T.guesses[g - 1] + 0.25), 3) : 0;
  const slump = inOutCubic(prog(t, T.trombone, T.trombone + 1.2));

  if (t < T.better) {
    // The camera: a snap zoom to the face on the boom, eased back out for the notes.
    const zIn = outExpo(prog(t, T.boom, T.boom + 0.12));
    const zOut = inOutCubic(prog(t, T.notes - 0.25, T.notes + 0.1));
    const z = 1 + 1.5 * zIn * (1 - zOut);
    const shake = pulse(t, T.boom, 0.9) * 26;
    const f = Math.round(t * 30);
    ctx.save();
    ctx.translate(W / 2 + (rnd(f) - 0.5) * shake, H / 2 + (rnd(f + 99) - 0.5) * shake);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -lerp(H / 2, 830, zIn * (1 - zOut)));
    gym();
    // The lifter pops in, squashing from the feet.
    const kIn = outBack(prog(t, a, a + 0.4), 2);
    ctx.save();
    ctx.translate(W / 2, 1470);
    ctx.scale(lerp(1.15, 1, kIn), kIn);
    ctx.translate(-W / 2, -1470);
    lifter(t, mood, tilt, slump);
    ctx.restore();
    // A sweat drop slides down once the guessing starts.
    if (g >= 2 && t < T.boom) {
      const k = prog(t, T.guesses[1], T.guesses[1] + 1.2);
      ctx.fillStyle = "#5ec8ff";
      ctx.beginPath();
      const sx = 650;
      const sy = 760 + k * 50;
      ctx.moveTo(sx, sy - 34);
      ctx.quadraticCurveTo(sx + 22, sy, sx, sy + 12);
      ctx.quadraticCurveTo(sx - 22, sy, sx, sy - 34);
      ctx.fill();
    }
    // The thought bubble and the guesses.
    if (t < T.boom) {
      const kb = outBack(prog(t, at("problem", 1.0), at("problem", 1.3)), 1.8);
      if (kb > 0) {
        ctx.save();
        ctx.translate(W / 2, 540);
        ctx.scale(kb, kb);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 6;
        rrect(-400, -110, 800, 220, 110);
        ctx.fill();
        ctx.stroke();
        [[-40, 150, 26], [-70, 196, 15]].forEach(([x, y, r]) => {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        text("How much did I squat", 0, -14, { size: 56, weight: 800, color: "#111" });
        text("last week??", 0, 58, { size: 56, weight: 800, color: "#111" });
        ctx.restore();
      }
      [[230, 790, -0.2, "60?"], [850, 720, 0.18, "70?"], [210, 1060, 0.12, "80??"]].forEach(([x, y, r, s], i) =>
        meme(t, T.guesses[i], s, x, y, { size: 120, rot: r, color: "#ff3b30" }),
      );
    }
    ctx.restore();

    // Screen space: the boom's red vignette, the captions, the notes.
    if (boomOn) {
      const v = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1100);
      v.addColorStop(0, "rgba(120,0,0,0)");
      v.addColorStop(1, "rgba(120,0,0,0.75)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      meme(t, T.boom + 0.05, "BRUH.", W / 2, 1640, { size: 220 });
    }
    flash(t, T.boom, 0.5, 0.25);
    if (t < T.notes) meme(t, T.caption, "ME, EVERY LEG DAY:", W / 2, 230, { size: 104 });
    else meme(t, T.notes, "MY NOTES:", W / 2, 230, { size: 120 });
    const notes = [
      [300, 1240, -0.12, "squat 60x8?"],
      [790, 1330, 0.14, "bench ??"],
      [330, 1560, 0.08, "70 or 80kg?"],
      [770, 1640, -0.1, "legs: idk"],
      [540, 1460, 0.03, "3 x ?? reps"],
    ];
    if (t >= T.notes) notes.forEach(([x, y, r, s], i) => note(t, T.notes + i * 0.18, x, y, r, s));
    if (t >= T.trombone) {
      // Everything goes grey for the sad trombone.
      ctx.fillStyle = `rgba(40,44,60,${0.4 * slump})`;
      ctx.fillRect(0, 0, W, H);
      meme(t, T.trombone + 0.2, "NO PROGRESS.", W / 2, 400, { size: 120 });
      meme(t, T.trombone + 0.5, "NO IDEA.", W / 2, 530, { size: 120 });
    }
  } else {
    background(t, 960, 0.1 + pulse(t, T.better + 0.2, 1) * 0.2);
    const out = 1 - inCubic(prog(t, before("problem", 0.5), before("problem", 0)));
    meme(t, T.better + 0.1, "THERE'S A", W / 2, 860, { size: 130, alpha: out });
    meme(t, T.better + 0.3, "BETTER WAY.", W / 2, 1030, { size: 170, color: VOLT, alpha: out });
  }
  glitch(t, T.better, 0.25);
}

function hook(t) {
  background(t, 820, 0.08 + pulse(t, T.ignite, 1.2) * 0.25);
  const out = 1 - inCubic(prog(t, before("hook", 0.5), before("hook", 0)));
  ctx.save();
  ctx.translate(W / 2, 820);
  ctx.scale(lerp(1, 0.8, 1 - out), lerp(1, 0.8, 1 - out));
  ctx.translate(-W / 2, -820);
  ctx.globalAlpha = out;
  // The spark rising before the mark.
  if (t < T.ignite + 0.05) {
    const k = outCubic(prog(t, T.spark, T.ignite));
    const y = lerp(1500, 820, k);
    ctx.fillStyle = VOLT;
    ctx.shadowColor = VOLT;
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(W / 2, y, 10 + k * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(204,255,0,0.4)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W / 2, y);
    ctx.lineTo(W / 2, Math.min(1500, y + 260));
    ctx.stroke();
  }
  ripple(t, T.ignite, W / 2, 820, 60, 520, 0.8);
  ripple(t, T.lock, W / 2, 820, 120, 640, 0.7);
  mark(t, W / 2, 800, 380, T.ignite, T.lock, { glow: true, sweepAt: T.sweep });
  // ABOT, letter by letter.
  "ABOT".split("").forEach((ch, i) => {
    const k = outBack(prog(t, T.letters + i * 0.07, T.letters + i * 0.07 + 0.45), 2);
    if (k <= 0) return;
    const x = W / 2 + (i - 1.5) * 118;
    ctx.save();
    ctx.translate(x, 1150);
    ctx.scale(1, clamp(k, 0, 1.3));
    text(ch, 0, 0, { size: 150, weight: 800, tracking: -4, alpha: clamp(k * 2) });
    ctx.restore();
  });
  riseLine(t, T.tag1, "Lift heavy.", W / 2, 1330, { size: 70, weight: 700, color: MUTED });
  riseLine(t, T.tag2, "Log everything.", W / 2, 1420, { size: 70, weight: 800, color: VOLT });
  ctx.restore();
  flash(t, T.ignite, 0.35, 0.5);
}

function logging(t) {
  const [a] = SCENES.log;
  background(t, 1100, 0.12);
  const p = presence(t, "log");
  const m = A.meta.boxes;
  const n = T.ticks.filter((x) => t >= x).length;
  const screen = `logger-${n}`;
  const enter = outCubic(prog(t, T.logIn, T.logIn + 0.7));
  ctx.globalAlpha = p;
  riseLine(t, a + 0.3, "One tap per set.", W / 2, 230, { size: 84 });
  const k = lift(t, at("log", 1.3), before("log", 0.3));
  const geo = phone(screen, W / 2, lerp(2700, 1260, enter), 540, { rot: (1 - enter) * 0.12, dim: 0.55 * k });
  // The set rows lift out of the screen; the ticks land on the lifted card.
  const map = liftCard(screen, m.setRows, geo, k, [W / 2, 1030, 1000], { pad: 12 });
  if (map) {
    T.ticks.forEach((tt, i) => {
      const b = m[`tick${i + 1}`];
      if (!b) return;
      const [x, y, sc] = map(b.x + b.w / 2, b.y + b.h / 2);
      ripple(t, tt, x, y, b.w * 0.35 * sc, b.w * 1.3 * sc, 0.5);
      const kf = prog(t, tt, tt + 1.0);
      if (kf > 0 && kf < 1) text("+680 kg", x - 210, y - 30 - outCubic(kf) * 120, { size: 50, weight: 800, family: MONO, color: VOLT, alpha: 1 - inCubic(kf) });
    });
  }
  const vol = Math.round(lerp(0, 2040, clamp(n / 3)));
  const shown = clamp(prog(t, at("log", 2.1), at("log", 2.5))) * (1 - prog(t, at("log", 5.6), at("log", 6.0)));
  text(`${vol.toLocaleString("en-US")} kg`, W / 2, 420, { size: 72, weight: 800, family: MONO, color: VOLT, alpha: shown });
  label("VOLUME THIS WORKOUT", 480, shown, MUTED);
  text("Previous numbers, plates, supersets, RPE", W / 2, 1870, { size: 40, weight: 600, color: MUTED, alpha: clamp(prog(t, at("log", 5.1), at("log", 5.6))) });
  ctx.globalAlpha = 1;
}
/** A filled wave along a bar's bottom edge (screen coordinates in px of the phone). */
function barWave(t, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.clip();
  [
    [200, 0.16, 0.9, -1],
    [100, 0.26, 1.4, 1],
  ].forEach(([period, alpha, speed, dir], i) => {
    const amp = h * 0.12 * (0.6 + 0.4 * Math.sin(t * (1.6 + i)));
    ctx.fillStyle = `rgba(204,255,0,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let px = 0; px <= w; px += 6) {
      const yy = y + h * 0.55 + amp * Math.sin(((px / w) * 400) / period * Math.PI * 2 + dir * t * speed * 3);
      ctx.lineTo(x + px, yy);
    }
    ctx.lineTo(x + w, y + h);
    ctx.fill();
  });
  ctx.restore();
}

function workoutBar(t) {
  const [a] = SCENES.bar;
  background(t, 1500, 0.14);
  const p = presence(t, "bar");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "Your workout, live.", W / 2, 230, { size: 84 });
  const open = t >= T.barOpen;
  const screen = open ? "logger-bar" : "logger-rest";
  const enter = outCubic(prog(t, a + 0.1, a + 0.7));
  // The rest bar lifts during the countdown; the opened bar lifts again with its shortcuts.
  const kRest = lift(t, at("bar", 0.8), T.barOpen);
  const kOpen = lift(t, T.barOpen, before("bar", 0.2));
  const geo = phone(screen, W / 2, lerp(2700, 1300, enter), 540, { dim: 0.55 * Math.max(kRest, kOpen) });
  if (!open) liftCard(screen, A.meta.boxes.bar, geo, kRest, [W / 2, 1180, 1000]);
  else {
    const b = A.meta.boxes.barOpen;
    const map = liftCard(screen, b, geo, kOpen, [W / 2, 1180, 1000]);
    if (map && b) {
      // The live wave along the top row of the lifted bar.
      const [x, y, sc] = map(b.x, b.y);
      barWave(t, x + 4, y + 4, b.w * sc - 8, 150 * sc);
    }
  }
  const marks = [...T.rest.map((x, i) => [x, String(3 - i)]), [T.go, "GO"]];
  marks.forEach(([at0, s], i) => {
    const k = prog(t, at0, at0 + 0.5);
    if (k <= 0 || (k >= 1 && i < marks.length - 1)) return;
    const end = i === marks.length - 1 ? 1 - prog(t, T.barOpen - 0.1, T.barOpen + 0.2) : 1 - k;
    const s0 = outBack(clamp(k * 2), 2.5);
    ctx.save();
    ctx.translate(W / 2, 520);
    ctx.scale(s0, s0);
    text(s, 0, 70, { size: 220, weight: 800, family: MONO, color: s === "GO" ? VOLT : INK, alpha: end });
    ctx.restore();
  });
  ["Pause", "Done set", "Add set", "Go to it"].forEach((s, i) => {
    const k = outBack(prog(t, T.barOpen + 0.3 + i * 0.12, T.barOpen + 0.7 + i * 0.12), 2);
    if (k <= 0) return;
    const x = 160 + i * 253;
    ctx.save();
    ctx.translate(x, 470);
    ctx.scale(k, k);
    rrect(-115, -44, 230, 88, 44);
    ctx.fillStyle = i === 1 ? VOLT : "rgba(255,255,255,0.08)";
    ctx.fill();
    text(s, 0, 12, { size: 34, weight: 700, color: i === 1 ? OBS : INK });
    ctx.restore();
  });
  ctx.globalAlpha = 1;
  flash(t, T.go, 0.25, 0.3);
}
function progress(t) {
  const [a] = SCENES.progress;
  background(t, 900, 0.12);
  const p = presence(t, "progress");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "Every kilo adds up.", W / 2, 230, { size: 84 });
  // A row of week bars under the title, one per beat.
  const heights = [0.46, 0.52, 0.5, 0.61, 0.66, 0.7, 0.78, 0.92];
  T.bars.forEach((at0, i) => {
    const k = outBack(prog(t, at0, at0 + 0.4), 1.8);
    const bw = 70;
    const x = W / 2 - 4 * 92 + i * 92 + 11;
    const h = heights[i] * 200 * k;
    ctx.fillStyle = i === 7 ? VOLT : `rgba(204,255,0,${0.25 + i * 0.06})`;
    rrect(x, 520 - h, bw, Math.max(0, h), 10);
    ctx.fill();
  });
  const enter = outCubic(prog(t, a + 0.2, a + 0.9));
  const k = lift(t, at("progress", 1.2), before("progress", 0.3));
  const geo = phone("progress", W / 2, lerp(2700, 1300, enter), 540, { dim: 0.55 * k });
  // Cut above the tab bar, which sits over the bottom of this card on the screen.
  liftCard("progress", A.meta.boxes.progressHero, geo, k, [W / 2, 1150, 1000], { maxH: 520 });
  text("Volume · records · muscles · calendar", W / 2, 1880, { size: 34, weight: 600, color: MUTED, alpha: clamp(prog(t, at("progress", 5.2), at("progress", 5.6))) });
  ctx.globalAlpha = 1;
}
function streak(t) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);
  const lit = prog(t, T.flame, T.flame + 0.4);
  const g = ctx.createRadialGradient(W / 2, 760, 0, W / 2, 760, 820);
  g.addColorStop(0, `rgba(204,255,0,${0.28 * lit * (0.85 + 0.15 * Math.sin(t * 3))})`);
  g.addColorStop(1, "rgba(204,255,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const p = presence(t, "streak", 0.3);
  ctx.globalAlpha = p;
  // The ember, then the flame catching.
  if (t < T.flame + 0.05) {
    const k = outCubic(prog(t, T.ember, T.flame));
    ctx.fillStyle = VOLT;
    ctx.shadowColor = VOLT;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(W / 2, lerp(1300, 900, k), 9 + k * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (t >= T.flame) {
    const grow = outBack(prog(t, T.flame, T.flame + 0.6), 2);
    flame(t, W / 2, 980, 560, grow);
    embers(t, W / 2, 900, T.flame + 0.2);
  }
  ripple(t, T.flame, W / 2, 800, 80, 700, 0.9);
  // The count rolling 15 to 16.
  const kr = outBack(prog(t, T.roll, T.roll + 0.5), 1.6);
  if (t > T.flame + 0.3) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 1040, W, 290);
    ctx.clip();
    text("15", W / 2, 1290 - kr * 290, { size: 280, weight: 800, family: SANS, tracking: -10, color: MUTED, alpha: 1 - kr });
    text("16", W / 2, 1290 + (1 - kr) * 290, { size: 280, weight: 800, family: SANS, tracking: -10, color: VOLT });
    ctx.restore();
    label("WEEK STREAK", 1010, clamp(prog(t, T.flame + 0.3, T.flame + 0.7)));
    text("weeks in a row", W / 2, 1400, { size: 60, weight: 700, alpha: clamp(prog(t, T.roll + 0.3, T.roll + 0.7)) });
  }
  // Twelve week plates lighting in turn.
  T.plates.forEach((at, i) => {
    const size = 64;
    const x = W / 2 + (i - 5.5) * 80 - size / 2;
    const y = 1500;
    const k = outBack(prog(t, at, at + 0.3), 2.5);
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    const s = t >= at ? lerp(0.7, 1, clamp(k)) * (1 + pulse(t, at, 0.25) * 0.25) : 0.85;
    ctx.scale((s * size) / 100, (s * size) / 100);
    ctx.translate(-50, -50);
    if (t >= at) {
      ctx.fillStyle = VOLT;
      ctx.shadowColor = "rgba(204,255,0,0.7)";
      ctx.shadowBlur = 20;
      ctx.fill(P.plate);
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${0.2 * clamp(prog(t, T.flame + 0.5, T.flame + 1))})`;
      ctx.lineWidth = 7;
      ctx.stroke(P.plate);
    }
    ctx.restore();
  });
  riseLine(t, T.keepFire, "Keep the fire going.", W / 2, 1760, { size: 72, weight: 800 });
  ctx.globalAlpha = 1;
  flash(t, T.flame, 0.5, 0.5);
}

function share(t) {
  const [a] = SCENES.share;
  background(t, 960, 0.1);
  const p = presence(t, "share");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "Share it.", W / 2, 210, { size: 96 });
  riseLine(t, a + 0.55, "12 themes, all free.", W / 2, 300, { size: 56, weight: 700, color: VOLT });
  const cw = 230;
  const ch = (cw * 1920) / 1080;
  const g = inOutCubic(prog(t, T.gather, T.gather + 0.8));
  T.cards.forEach((at, i) => {
    const im = img[`theme${i}`];
    if (!im || t < at - 0.05) return;
    const k = outBack(prog(t, at, at + 0.45), 1.4);
    // A fan that swings in from alternate sides...
    const fanAngle = (i - 5.5) * 0.06;
    const fx = W / 2 + (i - 5.5) * 64;
    const fy = 1050 + Math.abs(i - 5.5) * 14;
    const from = i % 2 ? W + 400 : -400;
    let x = lerp(from, fx, k);
    let y = lerp(1300, fy, k);
    let rot = lerp(i % 2 ? 0.6 : -0.6, fanAngle, k);
    let s = 1.15;
    // ...then gathers into a 4 x 3 grid.
    if (g > 0) {
      const gx = 150 + (i % 4) * 260;
      const gy = 660 + Math.floor(i / 4) * 450;
      x = lerp(x, gx, g);
      y = lerp(y, gy, g);
      rot = lerp(rot, 0, g);
      s = lerp(s, 1, g);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 40;
    rrect(-cw / 2, -ch / 2, cw, ch, 18);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    rrect(-cw / 2, -ch / 2, cw, ch, 18);
    ctx.clip();
    ctx.drawImage(im, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    ctx.restore();
  });
  text("Instagram Stories in one tap", W / 2, 1870, { size: 38, weight: 600, color: MUTED, alpha: clamp(prog(t, T.gather + 0.5, T.gather + 0.9)) });
  ctx.globalAlpha = 1;
  flash(t, T.gather, 0.18, 0.3);
}

function bodyPhase(t) {
  background(t, 1200, 0.12);
  const p = presence(t, "phase");
  ctx.globalAlpha = p;
  ["Cut.", "Bulk.", "Recomp.", "Peak."].forEach((w, i) => {
    const at0 = T.phaseWords[i];
    const k = outBack(prog(t, at0, at0 + 0.4), 2);
    if (k <= 0) return;
    ctx.save();
    ctx.translate(300 + (i % 2) * 480, i < 2 ? 260 : 380);
    ctx.scale(k, k);
    text(w, 0, 0, { size: 96, weight: 800, color: i === 1 ? VOLT : INK });
    ctx.restore();
  });
  const enter = outCubic(prog(t, T.phaseIn, T.phaseIn + 0.7));
  const k = lift(t, T.phaseIn + 0.7, before("phase", 0.2));
  const geo = phone("phase", W / 2, lerp(2700, 1300, enter), 540, { dim: 0.55 * k });
  liftCard("phase", A.meta.boxes.phaseDial, geo, k, [W / 2, 1050, 1000], { pad: 24 });
  text("Calories and macros from your training", W / 2, 1880, { size: 38, weight: 600, color: MUTED, alpha: clamp(prog(t, at("phase", 4), at("phase", 4.4))) });
  ctx.globalAlpha = 1;
}
function trust(t) {
  background(t, 1000, 0.08);
  const p = presence(t, "trust");
  ctx.globalAlpha = p;
  // Dark and light Home, split by a wipe that slides across.
  const wipe = lerp(1080, 0, inOutCubic(prog(t, at("trust", 2), at("trust", 3))));
  const pw = 560;
  const y = 1240;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, wipe, H);
  ctx.clip();
  phone("home", W / 2, y, pw);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(wipe, 0, W - wipe, H);
  ctx.clip();
  phone("home-light", W / 2, y, pw);
  ctx.restore();
  if (wipe > 0 && wipe < W) {
    ctx.fillStyle = VOLT;
    ctx.fillRect(wipe - 3, 560, 6, 1200);
  }
  const lines = ["Works offline.", "No ads. No tracking.", "Your data stays on your phone.", "Google backup, only if you want it"];
  lines.forEach((s, i) => riseLine(t, T.trustLines[i], s, W / 2, 200 + i * 88, { size: i === 2 ? 60 : 56, weight: i === 2 ? 800 : 700, color: i === 2 ? VOLT : INK }));
  ctx.globalAlpha = 1;
}

function outro(t) {
  background(t, 820, 0.12 + pulse(t, T.outroHit, 1.5) * 0.25);
  const p = clamp(prog(t, SCENES.outro[0], SCENES.outro[0] + 0.3)) * (1 - prog(t, before("outro", 0.6), before("outro", 0)));
  ctx.globalAlpha = p;
  ripple(t, T.outroHit, W / 2, 760, 100, 760, 1);
  mark(t, W / 2, 740, 360, T.outroHit - 0.35, T.outroHit, { glow: true, sweepAt: T.outroHit + 0.4 });
  const kw = outExpo(prog(t, T.outroHit + 0.2, T.outroHit + 0.8));
  text("ABOT", W / 2, 1100 + (1 - kw) * 60, { size: 170, weight: 800, tracking: -4, alpha: kw * p });
  riseLine(t, T.outroHit + 0.6, "Gym Progress Tracker", W / 2, 1200, { size: 56, weight: 700, color: MUTED });
  riseLine(t, T.outroHit + 1.0, "Free on Android and the web", W / 2, 1290, { size: 48, weight: 600, color: INK });
  // The Download pill, pulsing on the beat.
  const kb = outBack(prog(t, T.outroUrl - 0.3, T.outroUrl + 0.2), 2);
  if (kb > 0) {
    const beat = 1 + 0.04 * Math.max(0, Math.sin(((t - T.outroUrl) / 0.5) * Math.PI * 2));
    ctx.save();
    ctx.translate(W / 2, 1480);
    ctx.scale(kb * beat, kb * beat);
    ctx.shadowColor = "rgba(204,255,0,0.6)";
    ctx.shadowBlur = 40;
    rrect(-260, -70, 520, 140, 70);
    ctx.fillStyle = VOLT;
    ctx.fill();
    ctx.shadowBlur = 0;
    text("Download", 0, 22, { size: 60, weight: 800, color: OBS, alpha: p });
    ctx.restore();
    text("abot-app.vercel.app", W / 2, 1640, { size: 40, weight: 700, family: MONO, color: VOLT, alpha: clamp(kb) * p });
  }
  ctx.globalAlpha = 1;
  flash(t, T.outroHit, 0.4, 0.5);
}

/** A phone sliding in from below over `len` seconds from `from`. */
const slideUp = (t, from, len = 0.7) => outCubic(prog(t, from, from + len));

function routines(t) {
  const [a] = SCENES.routines;
  background(t, 1100, 0.12);
  const p = presence(t, "routines");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "Routines, ready to go.", W / 2, 230, { size: 80 });
  const enter = slideUp(t, T.routinesIn);
  const vault = t >= T.vault;
  const screen = vault ? "vault" : "routines";
  const k = vault ? lift(t, T.vault + 0.3, before("routines", 0.2)) : lift(t, at("routines", 1.0), T.vault);
  const geo = phone(screen, W / 2, lerp(2700, 1320, enter), 540, { rot: (1 - enter) * 0.1, dim: 0.55 * k });
  liftCard(screen, vault ? A.meta.boxes.vaultCard : A.meta.boxes.routineCard, geo, k, [W / 2, 1120, 980]);
  text("Your own routines, one tap to start", W / 2, 360, { size: 38, weight: 600, color: MUTED, alpha: clamp(prog(t, a + 1.0, a + 1.4)) * (1 - prog(t, T.vault - 0.3, T.vault)) });
  const splits = ["PPL", "Upper / Lower", "Full Body", "Calisthenics"];
  font(34, 700);
  const widths = splits.map((x) => ctx.measureText(x).width + 56);
  const total = widths.reduce((x, y) => x + y, 0) + 14 * 3;
  splits.forEach((s, i) => {
    const kk = outBack(prog(t, T.splits[i], T.splits[i] + 0.35), 2.2);
    if (kk <= 0) return;
    const x = W / 2 - total / 2 + widths.slice(0, i).reduce((x, y) => x + y + 14, 0) + widths[i] / 2;
    ctx.save();
    ctx.translate(x, 360);
    ctx.scale(kk, kk);
    rrect(-widths[i] / 2, -36, widths[i], 72, 36);
    ctx.fillStyle = i === 0 ? VOLT : "rgba(255,255,255,0.09)";
    ctx.fill();
    text(s, 0, 12, { size: 34, weight: 700, color: i === 0 ? OBS : INK });
    ctx.restore();
  });
  text("17 ready programs in the Template Vault", W / 2, 1870, { size: 38, weight: 600, color: MUTED, alpha: clamp(prog(t, T.vault + 0.6, T.vault + 1)) });
  ctx.globalAlpha = 1;
}
function exercises(t) {
  const [a] = SCENES.exercises;
  background(t, 1100, 0.12);
  const p = presence(t, "exercises");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "88 exercises, shown.", W / 2, 230, { size: 84 });
  const enter = slideUp(t, T.exercisesIn);
  const detail = t >= T.exerciseDetail;
  const screen = detail ? "exercise" : "exercises";
  const k = detail ? lift(t, T.exerciseDetail + 0.4, before("exercises", 0.2)) : lift(t, at("exercises", 1.0), T.exerciseDetail);
  const geo = phone(screen, W / 2, lerp(2700, 1320, enter), 540, { dim: 0.55 * k });
  liftCard(screen, detail ? A.meta.boxes.exerciseStats : A.meta.boxes.exerciseRows, geo, k, [W / 2, 1120, 1000], detail ? { pad: 24, padB: 120 } : { pad: 10 });
  text(detail ? "Start and end photos, steps, a muscle map" : "Search, filter by muscle or equipment", W / 2, 1870, {
    size: 38,
    weight: 600,
    color: MUTED,
    alpha: detail ? clamp(prog(t, T.exerciseDetail + 0.4, T.exerciseDetail + 0.8)) : clamp(prog(t, a + 1.2, a + 1.6)) * (1 - prog(t, T.exerciseDetail - 0.3, T.exerciseDetail)),
  });
  ctx.globalAlpha = 1;
  flash(t, T.exerciseDetail, 0.15, 0.3);
}
function history(t) {
  const [a] = SCENES.history;
  background(t, 900, 0.12);
  const p = presence(t, "history");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "Every record, counted.", W / 2, 230, { size: 80 });
  const enter = slideUp(t, T.historyIn);
  const map = t >= T.bodyMap;
  const screen = map ? "history-map" : "history";
  const k = map ? lift(t, T.bodyMap + 0.2, before("history", 0.2)) : lift(t, T.records - 0.4, T.bodyMap);
  const geo = phone(screen, W / 2, lerp(2700, 1340, enter), 540, { dim: 0.55 * k });
  liftCard(screen, map ? A.meta.boxes.historyMap : A.meta.boxes.historyStats, geo, k, [W / 2, map ? 1150 : 1000, 1000]);
  const kr = outBack(prog(t, T.records, T.records + 0.4), 2.5) * (1 - prog(t, T.bodyMap - 0.2, T.bodyMap));
  if (kr > 0) {
    ctx.save();
    ctx.translate(W / 2, 400);
    ctx.scale(kr, kr);
    rrect(-250, -50, 500, 100, 50);
    ctx.fillStyle = "#00f0ff";
    ctx.fill();
    text("5 NEW RECORDS", 0, 14, { size: 40, weight: 800, family: MONO, color: OBS });
    ctx.restore();
  }
  text("Muscles worked, on a body map", W / 2, 400, { size: 44, weight: 700, color: VOLT, alpha: clamp(prog(t, T.bodyMap + 0.2, T.bodyMap + 0.6)) });
  ctx.globalAlpha = 1;
}
function storyLayouts(t) {
  const [a] = SCENES.story;
  background(t, 1000, 0.1);
  const p = presence(t, "story");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "Your workout as a story.", W / 2, 210, { size: 78 });
  riseLine(t, a + 0.5, "11 layouts.", W / 2, 300, { size: 56, weight: 700, color: VOLT });
  // A carousel: the current layout large in the middle, its neighbours either side.
  const steps = T.layouts.filter((x) => t >= x).length;
  const last = T.layouts[Math.max(0, steps - 1)];
  const move = steps === 0 ? 0 : outBack(prog(t, last, last + 0.35), 1.3);
  const pos = Math.max(0, steps - 1) + move - 1 + (steps === 0 ? 1 : 0);
  const cw = 520;
  const ch = (cw * 1920) / 1080;
  // Farthest first, so the middle card is drawn on top.
  const order = Array.from({ length: 11 }, (_, i) => i).sort((x, y) => Math.abs(y - pos) - Math.abs(x - pos));
  for (const i of order) {
    const im = img[`layout${i}`];
    if (!im) continue;
    const d = i - pos;
    if (Math.abs(d) > 2.2) continue;
    const s = lerp(1, 0.62, clamp(Math.abs(d)));
    const x = W / 2 + d * 430;
    const y = 1110;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = p * clamp(1.6 - Math.abs(d) * 0.55);
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 60;
    rrect(-cw / 2, -ch / 2, cw, ch, 26);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    rrect(-cw / 2, -ch / 2, cw, ch, 26);
    ctx.clip();
    ctx.drawImage(im, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    if (Math.abs(d) < 0.5) {
      ctx.strokeStyle = VOLT;
      ctx.lineWidth = 6;
      rrect(-cw / 2, -ch / 2, cw, ch, 26);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = p;
  text("Add a photo, share to Instagram Stories", W / 2, 1880, { size: 38, weight: 600, color: MUTED, alpha: clamp(prog(t, a + 1.2, a + 1.6)) });
  ctx.globalAlpha = 1;
}

function settings(t) {
  const [a] = SCENES.settings;
  background(t, 1100, 0.1);
  const p = presence(t, "settings");
  ctx.globalAlpha = p;
  riseLine(t, a + 0.2, "Make it yours.", W / 2, 230, { size: 88 });
  ["English · Bahasa Indonesia", "Dark · Light", "kg · lbs"].forEach((s, i) => riseLine(t, T.settingsLines[i], s, W / 2, 330 + i * 70, { size: 46, weight: 700, color: i === 0 ? VOLT : INK }));
  const enter = slideUp(t, T.settingsIn);
  const k = lift(t, T.settingsIn + 0.9, before("settings", 0.2));
  const geo = phone("settings", W / 2, lerp(2700, 1440, enter), 520, { dim: 0.55 * k });
  liftCard("settings", A.meta.boxes.settingsTop, geo, k, [W / 2, 1200, 960], { pad: 30 });
  ctx.globalAlpha = 1;
}
/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

const ORDER = [
  ["problem", problem],
  ["hook", hook],
  ["log", logging],
  ["bar", workoutBar],
  ["routines", routines],
  ["exercises", exercises],
  ["progress", progress],
  ["history", history],
  ["streak", streak],
  ["story", storyLayouts],
  ["share", share],
  ["phase", bodyPhase],
  ["settings", settings],
  ["trust", trust],
  ["outro", outro],
];

window.renderAt = (t) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  const scene = ORDER.find(([name]) => inScene(t, name)) ?? ORDER.at(-1);
  scene[1](t);
};

window.ready = (async () => {
  const src = A.src;
  const screens = ["home", "home-light", "progress", "phase", "story", "routines", "vault", "exercises", "exercise", "history", "history-map", "settings", "logger-0", "logger-1", "logger-2", "logger-3", "logger-rest", "logger-bar"];
  await Promise.all([
    ...screens.map((s) => load(s, `${src}/${s}.png`)),
    ...Array.from({ length: 12 }, (_, i) => load(`theme${i}`, `${src}/themes/${String(i).padStart(2, "0")}.png`)),
    ...Array.from({ length: 11 }, (_, i) => load(`layout${i}`, `${src}/layouts/${String(i).padStart(2, "0")}.png`)),
    document.fonts.load(`800 80px ${SANS}`),
    document.fonts.load(`700 80px ${SANS}`),
    document.fonts.load(`600 80px ${SANS}`),
    document.fonts.load(`700 40px ${MONO}`),
    document.fonts.load(`800 40px ${MONO}`),
    document.fonts.load(`400 80px ${MEME}`),
  ]);
  return true;
})();
