/**
 * Streak share cards: the week streak drawn as a 1080 x 1920 story in twelve themes. Each theme
 * is its own look, not a recolour: a flame card, a full-bleed poster, a heatmap, an emblem, a
 * terminal log. The text stays English, like the workout story cards. Exported through the same
 * PNG, share and save path as Story Studio (story-exporter).
 */
import { FLAME_CORE, FLAME_MIDDLE, FLAME_OUTER } from "@/components/streak/flame-path";
import { MARK_PATH } from "@/components/brand/mark-path";
import type { StreakCardData } from "@/lib/streak-moment";
import { STORY_HEIGHT as H, STORY_WIDTH as W, type StoryFonts } from "@/lib/story-exporter";

type Ctx = CanvasRenderingContext2D;

export type StreakThemeId =
  | "volt-flame"
  | "inferno"
  | "paper"
  | "poster"
  | "neon-grid"
  | "blue-flame"
  | "steel"
  | "gold"
  | "heatmap"
  | "badge"
  | "sunset"
  | "terminal";

export const STREAK_THEMES: { id: StreakThemeId; name: string }[] = [
  { id: "volt-flame", name: "Volt Flame" },
  { id: "inferno", name: "Inferno" },
  { id: "paper", name: "Paper" },
  { id: "poster", name: "Poster" },
  { id: "neon-grid", name: "Neon Grid" },
  { id: "blue-flame", name: "Blue Flame" },
  { id: "steel", name: "Steel" },
  { id: "gold", name: "Gold" },
  { id: "heatmap", name: "Heatmap" },
  { id: "badge", name: "Badge" },
  { id: "sunset", name: "Sunset" },
  { id: "terminal", name: "Terminal" },
];

export interface StreakCardOptions {
  theme: StreakThemeId;
  /** ABOT // BLACK PRO: leave out the ABOT mark and name. */
  hideWatermark?: boolean;
}

const VOLT = "#ccff00";
const OBSIDIAN = "#09090b";
const PLATE = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

const paths: Record<string, Path2D> = {};
const path = (d: string) => (paths[d] ??= new Path2D(d));

/* ------------------------------------------------------------------ */
/* Drawing helpers                                                     */
/* ------------------------------------------------------------------ */

function font(ctx: Ctx, size: number, weight: number, family: string, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${tracking}px`;
}

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  o: { size: number; weight?: number; family: string; color: string; align?: CanvasTextAlign; tracking?: number; baseline?: CanvasTextBaseline },
) {
  font(ctx, o.size, o.weight ?? 700, o.family, o.tracking ?? 0);
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "center";
  ctx.textBaseline = o.baseline ?? "alphabetic";
  ctx.fillText(s, x, y);
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = "0px";
}

/** The largest size, up to `max`, at which `s` fits in `width`. */
function fit(ctx: Ctx, s: string, width: number, max: number, weight: number, family: string): number {
  let size = max;
  for (; size > 40; size -= 8) {
    font(ctx, size, weight, family);
    if (ctx.measureText(s).width <= width) break;
  }
  return size;
}

function flame(ctx: Ctx, cx: number, bottom: number, height: number, colors: [string, string, string], glow?: string) {
  const k = height / 160;
  ctx.save();
  ctx.translate(cx - 60 * k, bottom - 160 * k);
  ctx.scale(k, k);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 60 / k;
  }
  [FLAME_OUTER, FLAME_MIDDLE, FLAME_CORE].forEach((d, i) => {
    ctx.fillStyle = colors[i]!;
    ctx.fill(path(d));
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}

function glowAt(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function linear(ctx: Ctx, stops: string[], x0 = 0, y0 = 0, x1 = 0, y1 = H) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** The last 12 weeks as plates; this week (last) drawn a little larger. */
function plateRow(ctx: Ctx, row: boolean[], cy: number, on: string, off: string, size = 60, gap = 18) {
  const total = row.length * size + (row.length - 1) * gap;
  let x = (W - total) / 2;
  row.forEach((lit, i) => {
    const s = i === row.length - 1 ? size * 1.15 : size;
    ctx.save();
    ctx.translate(x + (size - s) / 2, cy - s / 2);
    ctx.scale(s / 100, s / 100);
    if (lit) {
      ctx.fillStyle = on;
      ctx.fill(path(PLATE));
    } else {
      ctx.strokeStyle = off;
      ctx.lineWidth = 7;
      ctx.stroke(path(PLATE));
    }
    ctx.restore();
    x += size + gap;
  });
}

function sinceText(d: StreakCardData): string {
  return new Date(d.since).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function footer(ctx: Ctx, d: StreakCardData, f: StoryFonts, o: StreakCardOptions, color: string, mark: string, muted: string) {
  const line = `${d.workouts} workout${d.workouts === 1 ? "" : "s"} since ${sinceText(d)}`;
  text(ctx, line, W / 2, H - 250, { size: 34, weight: 600, family: f.sans, color: muted });
  if (d.handle) text(ctx, `@${d.handle}`, W / 2, H - 196, { size: 34, weight: 700, family: f.mono, color });
  if (o.hideWatermark) return;
  const size = 56;
  font(ctx, 46, 800, f.sans);
  const wordW = ctx.measureText("ABOT").width;
  const total = size + 16 + wordW;
  const x = (W - total) / 2;
  const y = H - 130;
  ctx.save();
  ctx.translate(x, y - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = mark;
  ctx.fill(path(MARK_PATH));
  ctx.restore();
  text(ctx, "ABOT", x + size + 16, y + 16, { size: 46, weight: 800, family: f.sans, color, align: "left" });
}

/* ------------------------------------------------------------------ */
/* Layouts                                                             */
/* ------------------------------------------------------------------ */

interface Palette {
  bg: (ctx: Ctx) => void;
  flame: [string, string, string];
  glow?: string;
  number: string | ((ctx: Ctx) => string | CanvasGradient);
  label: string;
  text: string;
  muted: string;
  plateOn: string;
  plateOff: string;
  mark: string;
  sans?: "mono";
  /** The theme's own face for the count and its words (Story Studio fonts). */
  face?: "display" | "serif" | "pixel" | "grotesk";
  extra?: (ctx: Ctx) => void;
  /** Footer colours where the bottom of the background differs from the top (a gradient). */
  foot?: { text: string; muted: string; mark: string };
}

/** Flame on top, the count under it, the label, then the twelve weeks. Most themes use it. */
function classic(ctx: Ctx, d: StreakCardData, f: StoryFonts, o: StreakCardOptions, p: Palette) {
  p.bg(ctx);
  p.extra?.(ctx);
  // Each face at the weight it has: Anton has one, Fraunces goes to 900, Silkscreen to 700.
  const face = p.face;
  const family = face ? f[face] : p.sans === "mono" ? f.mono : f.sans;
  const numWeight = face === "display" ? 400 : face === "serif" ? 900 : face ? 700 : 800;
  const wordFamily = face === "serif" || face === "grotesk" || face === "pixel" ? f[face] : f.sans;
  text(ctx, "WEEK STREAK", W / 2, 300, { size: 40, weight: 700, family: face === "pixel" ? f.pixel : f.mono, color: p.label, tracking: 10 });
  flame(ctx, W / 2, 900, 520, p.flame, p.glow);
  const n = String(d.weeks);
  const size = fit(ctx, n, W - 160, face === "display" ? 380 : 420, numWeight, family);
  const fill = typeof p.number === "function" ? p.number(ctx) : p.number;
  ctx.save();
  if (p.glow) {
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = 50;
  }
  font(ctx, size, numWeight, family, face === "pixel" ? 0 : -8);
  ctx.fillStyle = fill;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(n, W / 2, 1300);
  ctx.restore();
  const words = d.weeks === 1 ? "week in a row" : "weeks in a row";
  text(ctx, face === "display" || face === "pixel" ? words.toUpperCase() : words, W / 2, 1390, {
    size: face === "display" ? 64 : face === "pixel" ? 44 : 52,
    weight: face === "display" ? 400 : face === "serif" ? 600 : 700,
    family: face === "display" ? f.display : wordFamily,
    color: p.text,
  });
  plateRow(ctx, d.row, 1530, p.plateOn, p.plateOff);
  footer(ctx, d, f, o, p.foot?.text ?? p.text, p.foot?.mark ?? p.mark, p.foot?.muted ?? p.muted);
}

const PALETTES: Partial<Record<StreakThemeId, Palette>> = {
  "volt-flame": {
    face: "display",
    bg: (ctx) => {
      ctx.fillStyle = OBSIDIAN;
      ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W / 2, 700, 700, "rgba(204,255,0,0.22)");
    },
    flame: [VOLT, "#facc15", "#fffbe6"],
    glow: "rgba(204,255,0,0.6)",
    number: VOLT,
    label: VOLT,
    text: "#f4f4f5",
    muted: "#a1a1aa",
    plateOn: VOLT,
    plateOff: "rgba(255,255,255,0.22)",
    mark: VOLT,
  },
  inferno: {
    face: "display",
    bg: (ctx) => {
      ctx.fillStyle = linear(ctx, ["#1a0503", "#7c1d0b", "#ea580c"]);
      ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W / 2, 760, 640, "rgba(251,191,36,0.35)");
    },
    flame: ["#f97316", "#fbbf24", "#fff7ed"],
    glow: "rgba(249,115,22,0.8)",
    number: "#fff7ed",
    label: "#fdba74",
    text: "#fff7ed",
    muted: "rgba(255,247,237,0.75)",
    plateOn: "#fbbf24",
    plateOff: "rgba(255,247,237,0.3)",
    mark: "#fff7ed",
  },
  paper: {
    face: "serif",
    bg: (ctx) => {
      ctx.fillStyle = "#f4f1ea";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e11d48";
      ctx.fillRect(W / 2 - 60, 340, 120, 8);
    },
    flame: ["#18181b", "#3f3f46", "#f4f1ea"],
    number: "#18181b",
    label: "#e11d48",
    text: "#18181b",
    muted: "#52525b",
    plateOn: "#18181b",
    plateOff: "rgba(24,24,27,0.25)",
    mark: "#18181b",
  },
  "neon-grid": {
    face: "pixel",
    bg: (ctx) => {
      ctx.fillStyle = linear(ctx, ["#0b0420", "#1e0b3a", "#3b0764"]);
      ctx.fillRect(0, 0, W, H);
      // A floor grid running to the horizon.
      ctx.strokeStyle = "rgba(236,72,153,0.45)";
      ctx.lineWidth = 3;
      const horizon = 1180;
      for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 30, horizon);
        ctx.lineTo(W / 2 + i * 260, H);
        ctx.stroke();
      }
      for (let k = 0; k < 9; k++) {
        const y = horizon + Math.pow(k / 8, 1.8) * (H - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      glowAt(ctx, W / 2, 700, 600, "rgba(217,70,239,0.35)");
    },
    flame: ["#e879f9", "#22d3ee", "#ffffff"],
    glow: "rgba(232,121,249,0.8)",
    number: "#ffffff",
    label: "#22d3ee",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.7)",
    plateOn: "#e879f9",
    plateOff: "rgba(255,255,255,0.3)",
    mark: "#22d3ee",
  },
  "blue-flame": {
    face: "grotesk",
    bg: (ctx) => {
      ctx.fillStyle = linear(ctx, ["#020617", "#0c1e3e", "#082f49"]);
      ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W / 2, 720, 640, "rgba(56,189,248,0.25)");
    },
    flame: ["#2563eb", "#38bdf8", "#f0f9ff"],
    glow: "rgba(56,189,248,0.7)",
    number: "#f0f9ff",
    label: "#7dd3fc",
    text: "#f0f9ff",
    muted: "rgba(240,249,255,0.7)",
    plateOn: "#38bdf8",
    plateOff: "rgba(240,249,255,0.25)",
    mark: "#38bdf8",
  },
  steel: {
    face: "grotesk",
    bg: (ctx) => {
      ctx.fillStyle = linear(ctx, ["#3f3f46", "#18181b", "#09090b"]);
      ctx.fillRect(0, 0, W, H);
      // Brushed metal: faint horizontal lines.
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    },
    flame: ["#a1a1aa", "#d4d4d8", "#ffffff"],
    number: "#fafafa",
    label: "#a1a1aa",
    text: "#fafafa",
    muted: "#a1a1aa",
    plateOn: "#e4e4e7",
    plateOff: "rgba(255,255,255,0.2)",
    mark: "#e4e4e7",
    sans: "mono",
  },
  gold: {
    face: "serif",
    bg: (ctx) => {
      ctx.fillStyle = "#0a0806";
      ctx.fillRect(0, 0, W, H);
      glowAt(ctx, W / 2, 760, 620, "rgba(234,179,8,0.18)");
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 4;
      ctx.strokeRect(56, 56, W - 112, H - 112);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(76, 76, W - 152, H - 152);
    },
    flame: ["#a16207", "#eab308", "#fef9c3"],
    glow: "rgba(234,179,8,0.55)",
    number: (ctx) => linear(ctx, ["#fef08a", "#ca8a04", "#fde68a"], 0, 1000, 0, 1320),
    label: "#eab308",
    text: "#fef9c3",
    muted: "rgba(254,249,195,0.7)",
    plateOn: "#eab308",
    plateOff: "rgba(254,249,195,0.25)",
    mark: "#eab308",
  },
  sunset: {
    face: "display",
    bg: (ctx) => {
      ctx.fillStyle = linear(ctx, ["#312e81", "#be185d", "#f97316", "#fde68a"]);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(W / 2, 760, 380, 0, Math.PI * 2);
      ctx.fill();
    },
    flame: ["#ffffff", "#fde68a", "#fff7ed"],
    number: "#ffffff",
    label: "#fde68a",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.85)",
    plateOn: "#ffffff",
    plateOff: "rgba(255,255,255,0.4)",
    mark: "#ffffff",
    foot: { text: "#7c2d12", muted: "rgba(124,45,18,0.8)", mark: "#7c2d12" },
  },
};

/** Volt from edge to edge, the count as big as the width allows, the flame cut out of it. */
function poster(ctx: Ctx, d: StreakCardData, f: StoryFonts, o: StreakCardOptions) {
  ctx.fillStyle = VOLT;
  ctx.fillRect(0, 0, W, H);
  text(ctx, "WEEK", 90, 230, { size: 120, weight: 800, family: f.sans, color: OBSIDIAN, align: "left", tracking: -4 });
  text(ctx, "STREAK", 90, 350, { size: 120, weight: 800, family: f.sans, color: OBSIDIAN, align: "left", tracking: -4 });
  flame(ctx, W - 190, 400, 300, [OBSIDIAN, OBSIDIAN, VOLT]);
  const n = String(d.weeks);
  const size = fit(ctx, n, W - 120, 1000, 800, f.sans);
  text(ctx, n, W / 2, 1330, { size, weight: 800, family: f.sans, color: OBSIDIAN, tracking: -20 });
  text(ctx, d.weeks === 1 ? "WEEK IN A ROW" : "WEEKS IN A ROW", W / 2, 1450, { size: 52, weight: 700, family: f.mono, color: OBSIDIAN, tracking: 8 });
  plateRow(ctx, d.row, 1560, OBSIDIAN, "rgba(9,9,11,0.3)");
  footer(ctx, d, f, o, OBSIDIAN, OBSIDIAN, "rgba(9,9,11,0.7)");
}

/** Twelve big week tiles in a 3 x 4 grid: the record of showing up, with the count above. */
function heatmap(ctx: Ctx, d: StreakCardData, f: StoryFonts, o: StreakCardOptions) {
  ctx.fillStyle = "#0b0f0a";
  ctx.fillRect(0, 0, W, H);
  flame(ctx, 170, 400, 200, [VOLT, "#facc15", "#fffbe6"], "rgba(204,255,0,0.5)");
  text(ctx, String(d.weeks), 280, 390, { size: 240, weight: 800, family: f.sans, color: "#f4f4f5", align: "left", tracking: -8 });
  text(ctx, d.weeks === 1 ? "WEEK STREAK" : "WEEK STREAK", 290, 450, { size: 38, weight: 700, family: f.mono, color: VOLT, align: "left", tracking: 8 });
  const cols = 3;
  const tile = 250;
  const gap = 26;
  const gridW = cols * tile + (cols - 1) * gap;
  const x0 = (W - gridW) / 2;
  const y0 = 560;
  d.row.forEach((lit, i) => {
    const x = x0 + (i % cols) * (tile + gap);
    const y = y0 + Math.floor(i / cols) * (tile * 0.62 + gap);
    const h = tile * 0.62;
    const current = i === d.row.length - 1;
    ctx.fillStyle = lit ? (current ? VOLT : "rgba(204,255,0,0.55)") : "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(x, y, tile, h, 22);
    ctx.fill();
    const ago = d.row.length - 1 - i;
    text(ctx, current ? "THIS WK" : `-${ago} WK`, x + 22, y + 52, { size: 28, weight: 700, family: f.mono, color: lit ? OBSIDIAN : "rgba(255,255,255,0.35)", align: "left", tracking: 2 });
  });
  footer(ctx, d, f, o, "#f4f4f5", VOLT, "#a1a1aa");
}

/** A round emblem: the count inside a ring, the words running around it, the flame on top. */
function badge(ctx: Ctx, d: StreakCardData, f: StoryFonts, o: StreakCardOptions) {
  ctx.fillStyle = "#101113";
  ctx.fillRect(0, 0, W, H);
  glowAt(ctx, W / 2, 900, 600, "rgba(204,255,0,0.12)");
  const cx = W / 2;
  const cy = 920;
  ctx.strokeStyle = VOLT;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, 380, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 300, 0, Math.PI * 2);
  ctx.stroke();
  // The ring of words.
  const ring = " WEEK STREAK · KEEP IT BURNING · ABOT ·";
  font(ctx, 34, 700, f.mono, 0);
  ctx.fillStyle = "#e4e4e7";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...ring];
  chars.forEach((ch, i) => {
    const a = (i / chars.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 340, cy + Math.sin(a) * 340);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  const n = String(d.weeks);
  const size = fit(ctx, n, 440, 300, 800, f.sans);
  text(ctx, n, cx, cy + size * 0.36, { size, weight: 800, family: f.sans, color: VOLT, tracking: -8 });
  flame(ctx, cx, 505, 200, [VOLT, "#facc15", "#fffbe6"], "rgba(204,255,0,0.55)");
  text(ctx, d.weeks === 1 ? "week in a row" : "weeks in a row", cx, 1420, { size: 52, weight: 700, family: f.sans, color: "#f4f4f5" });
  plateRow(ctx, d.row, 1540, VOLT, "rgba(255,255,255,0.22)");
  footer(ctx, d, f, o, "#f4f4f5", VOLT, "#a1a1aa");
}

/** A terminal session: the streak as a command and its output, weeks as a bar chart of #. */
function terminal(ctx: Ctx, d: StreakCardData, f: StoryFonts, o: StreakCardOptions) {
  const green = "#4ade80";
  ctx.fillStyle = "#030805";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(74,222,128,0.04)";
  for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 3);
  const x = 90;
  let y = 300;
  const line = (s: string, color = green, size = 44) => {
    text(ctx, s, x, y, { size, weight: 700, family: f.mono, color, align: "left" });
    y += size * 1.6;
  };
  line(`$ abot streak${d.handle ? ` --user ${d.handle}` : ""}`, "#a7f3d0", 40);
  y += 30;
  text(ctx, String(d.weeks), x - 10, y + 300, { size: 380, weight: 800, family: f.mono, color: green, align: "left", tracking: -10 });
  y += 380;
  line(d.weeks === 1 ? "> week in a row" : "> weeks in a row", green, 52);
  line(`> ${d.workouts} workouts since ${sinceText(d)}`, "#a7f3d0", 38);
  y += 40;
  line("> last 12 weeks", "#a7f3d0", 38);
  const bar = d.row.map((lit) => (lit ? "█" : "·")).join(" ");
  line(bar, green, 50);
  y += 30;
  line("> status: BURNING_", green, 44);
  if (!o.hideWatermark) footer(ctx, { ...d, handle: null }, f, o, "#a7f3d0", green, "rgba(167,243,208,0.6)");
}

export function renderStreakCard(ctx: Ctx, d: StreakCardData, o: StreakCardOptions, f: StoryFonts): void {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const p = PALETTES[o.theme];
  if (p) classic(ctx, d, f, o, p);
  else if (o.theme === "poster") poster(ctx, d, f, o);
  else if (o.theme === "heatmap") heatmap(ctx, d, f, o);
  else if (o.theme === "badge") badge(ctx, d, f, o);
  else terminal(ctx, d, f, o);
  ctx.restore();
}

export async function exportStreakPng(d: StreakCardData, o: StreakCardOptions, f: StoryFonts): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  renderStreakCard(ctx, d, o, f);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The PNG could not be made."))), "image/png"));
}

export function streakFileName(d: StreakCardData, theme: StreakThemeId): string {
  return `abot-streak-${d.weeks}wk-${theme}.png`;
}
