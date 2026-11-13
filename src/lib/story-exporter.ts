/**
 * ABOT Story Studio renderer and export engine.
 *
 * Every preset is drawn straight onto a 1080x1920 canvas (the Instagram Stories size), so the
 * preview on screen is the exported PNG pixel for pixel. Drawing on canvas instead of
 * photographing the DOM keeps it offline and dependency-free, and avoids DOM renderers that
 * cannot read Tailwind v4's oklch() colours.
 */
import { formatClock, formatDuration } from "@/lib/calc";
import { formatVolume, formatWeight } from "@/lib/units";
import { MUSCLE_GROUP_LABELS, type PRKind, type WeightUnit } from "@/types/workout";
import { regionsFor, type Region } from "@/components/anatomy/regions";
import { BODY_BACK, BODY_FRONT, OUTLINE_BACK, OUTLINE_FRONT } from "@/components/anatomy/bodyPaths.generated";
import type { StoryData, StorySet } from "@/lib/story-data";
import { canShareFiles, saveFile, shareFile, type SaveResult, type ShareResult } from "@/lib/native/files";
import { MARK_PATH } from "@/components/brand/mark-path";
import { STORY_SECONDS, backOut, beat, countUp, easeInOut, easeOut, linear, stagger, typed, type Ease } from "@/lib/story-motion";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export type StoryPresetId =
  | "matchday"
  | "thermal-matrix"
  | "brutalist-receipt"
  | "editorial"
  | "arcade"
  | "loaded-bar"
  | "trophy-vault"
  | "volt-poster";

/**
 * The eight layouts, each its own look: typeface, palette, texture and the way it moves. The
 * first `tunables().story.freePresets` (2) are free, so the order sets what is PRO.
 */
export const STORY_PRESETS: { id: StoryPresetId; name: string; blurb: string }[] = [
  { id: "matchday", name: "Matchday", blurb: "Full-time scoreboard: your volume is the score" },
  { id: "thermal-matrix", name: "Thermal Matrix", blurb: "Muscle map lit by sets worked" },
  { id: "brutalist-receipt", name: "Brutalist Receipt", blurb: "Every set itemised like a till slip" },
  { id: "editorial", name: "Editorial", blurb: "A magazine cover, your top lift the story" },
  { id: "arcade", name: "Arcade", blurb: "Level cleared: score, XP and a star per record" },
  { id: "loaded-bar", name: "Loaded Bar", blurb: "Each lift a plate on the bar, sized by its volume" },
  { id: "trophy-vault", name: "Trophy Vault", blurb: "Records first, engraved in gold" },
  { id: "volt-poster", name: "Volt Poster", blurb: "Swiss poster in black on Volt" },
];

/** Layouts that were retired, mapped to the closest one still offered. */
export const RETIRED_PRESETS: Record<string, StoryPresetId> = {
  "obsidian-raw": "matchday",
  "cyber-volt-hud": "arcade",
  "monochrome-steel": "editorial",
  "pr-trophy-vault": "trophy-vault",
  "photo-backdrop": "editorial",
  "split-spec-sheet": "matchday",
  "plate-grid": "loaded-bar",
};

/** A saved or linked layout id as one still offered. */
export function presetId(id: string | null | undefined): StoryPresetId {
  if (id && STORY_PRESETS.some((p) => p.id === id)) return id as StoryPresetId;
  return (id && RETIRED_PRESETS[id]) || "matchday";
}

/** Font stacks for `ctx.font`: the app's two faces and the five Story Studio theme faces. */
export interface StoryFonts {
  sans: string;
  mono: string;
  /** Anton: condensed poster capitals (one weight, 400). */
  display: string;
  /** Fraunces: editorial serif, 400 to 900. */
  serif: string;
  /** Silkscreen: pixel capitals, 400 and 700. */
  pixel: string;
  /** Space Grotesk: technical sans, 400 to 700. */
  grotesk: string;
  /** VT323: till-printer mono (one weight, 400). */
  receipt: string;
}

type Family = keyof StoryFonts;

/** A user photo cropped to cover 1080x1920 once, with its grayscale version made on demand. */
export interface StoryPhoto {
  layer(grayscale: boolean): CanvasImageSource;
}

export interface StoryOptions {
  preset: StoryPresetId;
  photo: StoryPhoto | null;
  /** How dark the tint over the photo is, 0.2 to 0.85. */
  overlay: number;
  grayscale: boolean;
  /** ABOT // BLACK PRO: leave out the ABOT mark and name. */
  hideWatermark?: boolean;
  /** Founder pass holders: "FOUNDER // #0421" stamped in the top corner. */
  founderBadge?: string | null;
}

export const OVERLAY_RANGE = { min: 0.2, max: 0.85, step: 0.05, initial: 0.55 } as const;

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

const OBSIDIAN = "#09090b";
const CARBON = "#121215";
const CARBON_2 = "#1c1c21";
const STEEL = "#27272a";
const STEEL_LINE = "#71717a";
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";
const VOLT = "#ccff00";
const CYAN = "#00f0ff";
/** Trophy badges only: the one place a record gets a medal colour. */
const GOLD = "#f5c84c";
/** Receipt stamp ink: 6.4:1 on the receipt paper. */
const STAMP_INK = "#b91c1c";
const PAPER = "#fafafa";
const INK = "#09090b";
const INK_MUTED = "#52525b";

const W = STORY_WIDTH;
const H = STORY_HEIGHT;
/** Instagram draws its progress bar and avatar over the top and the reply bar over the bottom. */
const SAFE_TOP = 230;
const SAFE_BOTTOM = H - 250;

/* ------------------------------------------------------------------ */
/* Fonts and photo                                                     */
/* ------------------------------------------------------------------ */

/**
 * Plus Jakarta Sans and JetBrains Mono are served by next/font under the family names published as CSS
 * variables on <html>. Canvas cannot use a font the page has not loaded yet, so every weight
 * the cards use is loaded first. Only the real family is loaded: next/font's "Fallback" face
 * points at the system Arial, which phones without Arial reject. A weight that fails to load
 * falls back to the next family in the stack instead of blocking the card. Both families stop at
 * 800, so the cards use no heavier weight.
 */
export async function loadStoryFonts(): Promise<StoryFonts> {
  const root = getComputedStyle(document.documentElement);
  const first = (stack: string, fallback: string) => stack.split(",")[0]?.trim() || fallback;
  // Each face: its CSS variable, a fallback stack, and the weights the cards draw it in.
  const faces: Record<Family, { cssVar: string; name: string; fallback: string; weights: number[] }> = {
    sans: { cssVar: "--font-sans-face", name: '"Plus Jakarta Sans"', fallback: "system-ui, sans-serif", weights: [400, 600, 700, 800] },
    mono: { cssVar: "--font-jetbrains-mono", name: '"JetBrains Mono"', fallback: "ui-monospace, monospace", weights: [400, 700, 800] },
    display: { cssVar: "--font-anton", name: '"Anton"', fallback: "Impact, sans-serif", weights: [400] },
    serif: { cssVar: "--font-fraunces", name: '"Fraunces"', fallback: "Georgia, serif", weights: [400, 600, 900] },
    pixel: { cssVar: "--font-silkscreen", name: '"Silkscreen"', fallback: "ui-monospace, monospace", weights: [400, 700] },
    grotesk: { cssVar: "--font-space-grotesk", name: '"Space Grotesk"', fallback: "system-ui, sans-serif", weights: [400, 500, 700] },
    receipt: { cssVar: "--font-vt323", name: '"VT323"', fallback: "ui-monospace, monospace", weights: [400] },
  };
  const fonts = {} as StoryFonts;
  const loads: Promise<unknown>[] = [];
  for (const [family, f] of Object.entries(faces) as [Family, (typeof faces)[Family]][]) {
    const v = root.getPropertyValue(f.cssVar).trim();
    fonts[family] = `${v ? `${v}, ` : ""}${f.name}, ${f.fallback}`;
    const face = first(v, f.name);
    for (const w of f.weights) loads.push(document.fonts.load(`${w} 48px ${face}`, "ABOT abot 0123456789"));
  }
  await Promise.allSettled(loads);
  return fonts;
}

/** Reads a picked image on the device and crops it to fill the story. Nothing leaves the phone. */
export async function createStoryPhoto(file: File): Promise<StoryPhoto> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo (JPEG, PNG or WebP).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Try a JPEG or PNG.");
  }
  const color = document.createElement("canvas");
  color.width = W;
  color.height = H;
  const ctx = color.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("This browser cannot draw photos.");
  }
  const scale = Math.max(W / bitmap.width, H / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  ctx.drawImage(bitmap, (W - dw) / 2, (H - dh) / 2, dw, dh);
  bitmap.close();

  let gray: HTMLCanvasElement | null = null;
  return {
    layer(grayscale) {
      if (!grayscale) return color;
      if (!gray) gray = toGrayscale(color);
      return gray;
    },
  };
}

/** Pixel-level grayscale, because CanvasRenderingContext2D.filter is missing in older Safari. */
function toGrayscale(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* Export and share                                                    */
/* ------------------------------------------------------------------ */

export function storyFileName(data: StoryData, preset: StoryPresetId): string {
  const d = new Date(data.startedAt);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `abot-story-${day}-${preset}.png`;
}

/**
 * Renders the story at full size on its own canvas and encodes a PNG. The preview canvas may
 * be scaled by CSS, but this one is always exactly 1080x1920.
 */
export async function exportStoryPng(data: StoryData, opts: StoryOptions, fonts: StoryFonts): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the story.");
  renderStory(ctx, data, opts, fonts);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The PNG could not be made."))), "image/png");
  });
}

/** True when this device can hand a PNG to the share sheet (Instagram, WhatsApp, ...). */
export function canShareStoryFiles(): boolean {
  if (typeof File === "undefined") return false;
  return canShareFiles(new File([new Uint8Array(1)], "abot.png", { type: "image/png" }));
}

export type { ShareResult };

/**
 * Opens the system share sheet with the PNG. Call it straight from the tap: Safari only allows
 * sharing during the user's gesture, so the blob must already exist.
 */
export function shareStoryPng(blob: Blob, fileName: string): Promise<ShareResult> {
  return shareFile(new File([blob], fileName, { type: "image/png" }), {
    title: "ABOT Workout Story",
    text: "Crushed today's workout with ABOT ⚡",
  });
}

/** A browser download, or the phone's gallery (Pictures/ABOT) in the Android app. */
export function downloadStoryPng(blob: Blob, fileName: string): Promise<SaveResult> {
  return saveFile(blob, fileName);
}

/* ------------------------------------------------------------------ */
/* Drawing primitives                                                  */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;

interface Scene {
  ctx: Ctx;
  fonts: StoryFonts;
  /** Seconds into the clip; a still is drawn at the end (STORY_SECONDS), every beat complete. */
  time: number;
  data: StoryData;
  unit: WeightUnit;
  opts: StoryOptions;
  /** A photo is behind the text, so text gets a soft dark shadow to stay readable. */
  onPhoto: boolean;
}

interface TextOpts {
  size: number;
  weight?: number;
  family?: Family;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
  tracking?: number;
  shadow?: boolean;
}

function setFont(s: Scene, size: number, weight = 400, family: Family = "sans") {
  s.ctx.font = `${weight} ${size}px ${s.fonts[family]}`;
}

function setTracking(ctx: Ctx, px: number) {
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Draws one line of text and returns its width. Clips with an ellipsis past `maxWidth`. */
function text(s: Scene, str: string, x: number, y: number, o: TextOpts): number {
  const { ctx } = s;
  ctx.save();
  setFont(s, o.size, o.weight, o.family);
  setTracking(ctx, o.tracking ?? 0);
  ctx.fillStyle = o.color ?? TEXT;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.baseline ?? "alphabetic";
  if (s.onPhoto && o.shadow !== false) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = devicepx(ctx, 14);
    ctx.shadowOffsetY = devicepx(ctx, 2);
  }
  const out = o.maxWidth ? ellipsize(ctx, str, o.maxWidth) : str;
  ctx.fillText(out, x, y);
  const width = ctx.measureText(out).width;
  ctx.restore();
  return width;
}

/** Mono uppercase label: the canvas twin of the app's `label-caps`. */
function caps(s: Scene, str: string, x: number, y: number, o: Partial<TextOpts> = {}): number {
  return text(s, str.toUpperCase(), x, y, { size: 26, family: "mono", color: MUTED, tracking: 3, ...o });
}

function ellipsize(ctx: Ctx, str: string, maxWidth: number): string {
  if (ctx.measureText(str).width <= maxWidth) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${str.slice(0, mid).trimEnd()}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${str.slice(0, lo).trimEnd()}…`;
}

/** Largest size from `max` down to `min` at which `str` fits in `width`. */
function fitSize(s: Scene, str: string, width: number, max: number, min: number, weight: number, family: Family) {
  for (let size = max; size > min; size -= 4) {
    setFont(s, size, weight, family);
    setTracking(s.ctx, 0);
    if (s.ctx.measureText(str).width <= width) return size;
  }
  return min;
}

/** Splits text into at most `maxLines` lines that fit `width`; the last one is ellipsised. */
function wrap(s: Scene, str: string, width: number, size: number, weight: number, maxLines: number, family: Family = "sans"): string[] {
  setFont(s, size, weight, family);
  setTracking(s.ctx, 0);
  const words = str.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (s.ctx.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      line = words.slice(i).join(" ");
      break;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines).map((l) => ellipsize(s.ctx, l, width));
}

function hline(ctx: Ctx, x1: number, x2: number, y: number, color: string, width = 2, dash?: number[]) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}


/** Shadows ignore the transform, so story units are converted to device pixels by hand. */
function devicepx(ctx: Ctx, v: number): number {
  const t = ctx.getTransform();
  return v * Math.hypot(t.a, t.b);
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}


let markPath: Path2D | null = null;

/** The ABOT mark, the same path as components/brand/AbotMark. */
function mark(ctx: Ctx, x: number, y: number, size: number, color: string) {
  markPath ??= new Path2D(MARK_PATH);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  ctx.fill(markPath, "nonzero");
  ctx.restore();
}

/** Mark plus wordmark; `y` is the vertical centre. Returns the total width. */
function wordmark(s: Scene, x: number, y: number, size: number, color: string, wordColor = TEXT) {
  if (s.opts.hideWatermark) return 0;
  mark(s.ctx, x, y - size / 2, size, color);
  const w = text(s, "ABOT", x + size + size * 0.28, y, {
    size: size * 0.82,
    weight: 800,
    color: wordColor,
    baseline: "middle",
    tracking: -size * 0.02,
  });
  return size * 1.28 + w;
}

function paintBackground(s: Scene, base: string, forceGray = false) {
  const { ctx, opts } = s;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  if (!opts.photo) return;
  ctx.drawImage(opts.photo.layer(forceGray || opts.grayscale), 0, 0, W, H);
  ctx.fillStyle = withAlpha(base, opts.overlay);
  ctx.fillRect(0, 0, W, H);
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateDots(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** One date for a workout, "12.09 - 08.11.2026" for a range. */
function dateLabel(data: StoryData) {
  if (data.kind === "session") return dateDots(data.startedAt);
  const a = new Date(data.startedAt);
  return `${pad(a.getDate())}.${pad(a.getMonth() + 1)} - ${dateDots(data.endedAt)}`;
}


function timeOf(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "12.3k kg" -> ["12.3k", "kg"] so the figure and the unit can be sized apart. */
function volumeParts(kg: number, unit: WeightUnit): [string, string] {
  const v = formatVolume(kg, unit);
  const i = v.lastIndexOf(" ");
  return [v.slice(0, i), v.slice(i + 1)];
}

function setLabel(set: StorySet, unit: WeightUnit): string {
  if (set.reps === null && set.durationSec !== null) return formatClock(set.durationSec);
  if (set.weightKg === null || set.weightKg <= 0) return `${set.reps ?? 0} reps`;
  return `${formatWeight(set.weightKg, unit, false)} × ${set.reps ?? 0}`;
}

function bestLabel(s: Scene, ex: StoryData["exercises"][number]): string {
  if (ex.best) return `${setLabel(ex.best, s.unit)} ${s.unit}`;
  const top = ex.sets.reduce<StorySet | null>((b, x) => ((x.reps ?? 0) > (b?.reps ?? 0) ? x : b), null);
  return top ? setLabel(top, s.unit) : `${ex.sets.length} sets`;
}

function prValue(pr: StoryData["prs"][number], unit: WeightUnit): { main: string; sub: string } {
  const kg = (v: number) => formatWeight(v, unit);
  const set = `${formatWeight(pr.weightKg, unit, false)} × ${pr.reps}`;
  const map: Record<PRKind, { main: string; sub: string }> = {
    heaviest_weight: { main: kg(pr.weightKg), sub: `${set} ${unit}` },
    best_1rm: { main: kg(pr.valueKg), sub: `est. 1RM from ${set}` },
    best_set_volume: { main: formatVolume(pr.valueKg, unit), sub: `one set: ${set}` },
  };
  return map[pr.kind];
}

function setsNumber(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/* ------------------------------------------------------------------ */
/* Muscle map                                                          */
/* ------------------------------------------------------------------ */

const NON_MUSCLE = new Set(["hair", "head", "hands", "feet", "ankles", "knees"]);
let bodyCache: { slug: string; paths: Path2D[] }[] | null = null;
let outlineCache: Path2D[] | null = null;

/** Working sets per drawn region, scaled 0 to 1 against the most worked region. */
function regionHeat(data: StoryData): { heat: Partial<Record<Region, number>>; max: number } {
  const raw: Partial<Record<Region, number>> = {};
  for (const { muscle, sets } of data.muscles)
    for (const r of regionsFor(muscle)) raw[r] = Math.max(raw[r] ?? 0, sets);
  const max = Math.max(0, ...Object.values(raw).map((v) => v ?? 0));
  const heat: Partial<Record<Region, number>> = {};
  if (max > 0) for (const [r, v] of Object.entries(raw)) heat[r as Region] = (v ?? 0) / max;
  return { heat, max };
}

/** Front and back figure, `w` wide, with worked muscles in Volt by how many sets they took. */
function drawBody(ctx: Ctx, x: number, y: number, w: number, heat: Partial<Record<Region, number>>) {
  bodyCache ??= [...BODY_FRONT, ...BODY_BACK].map((p) => ({ slug: p.slug, paths: p.d.map((d) => new Path2D(d)) }));
  outlineCache ??= [new Path2D(OUTLINE_FRONT), new Path2D(OUTLINE_BACK)];
  const scale = w / 1448;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(0, -30);
  for (const part of bodyCache) {
    const h = NON_MUSCLE.has(part.slug) ? undefined : heat[part.slug as Region];
    ctx.save();
    if (h === undefined) {
      ctx.fillStyle = NON_MUSCLE.has(part.slug) ? CARBON_2 : "#2c2c32";
    } else {
      ctx.fillStyle = withAlpha(VOLT, 0.28 + 0.72 * h);
      if (h >= 0.66) {
        ctx.shadowColor = withAlpha(VOLT, 0.6);
        ctx.shadowBlur = devicepx(ctx, 28);
      }
    }
    for (const p of part.paths) ctx.fill(p);
    ctx.restore();
  }
  ctx.strokeStyle = STEEL_LINE;
  ctx.lineWidth = 2.5;
  for (const p of outlineCache) ctx.stroke(p);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

/** Thermal Matrix: HUD grid, the muscle map lit by sets worked, a real scale underneath. */
function thermalMatrix(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 2;
  for (let x = 54; x < W; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();
  // Scanlines, like a thermal camera's readout.
  ctx.fillStyle = "rgba(204, 255, 0, 0.025)";
  for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 3);
  // Range-finder ticks on the left edge.
  for (let y = 120; y < H - 120; y += 24) hline(ctx, 0, y % 120 === 0 ? 34 : 18, y, STEEL_LINE, 2);

  const x = 84;
  wordmark(s, x, SAFE_TOP - 40, 56, VOLT);
  caps(s, "Thermal matrix // muscle load", x, SAFE_TOP + 20, { color: VOLT });
  caps(s, dateLabel(data), W - x, SAFE_TOP + 20, { align: "right" });
  text(s, data.title, x, SAFE_TOP + 100, { size: fitSize(s, data.title, W - 2 * x, 72, 44, 700, "grotesk"), weight: 700, family: "grotesk", maxWidth: W - 2 * x });

  const mapW = 900;
  const mapX = (W - mapW) / 2;
  const mapY = SAFE_TOP + 170;
  const mapH = (mapW * 1360) / 1448;
  const { heat, max } = regionHeat(data);
  drawBody(ctx, mapX, mapY, mapW, heat);

  // Reticle brackets around the figure.
  const pad = 22;
  const b = 56;
  ctx.save();
  ctx.strokeStyle = VOLT;
  ctx.lineWidth = 4;
  const corners: [number, number, number, number][] = [
    [mapX - pad, mapY - pad, 1, 1],
    [mapX + mapW + pad, mapY - pad, -1, 1],
    [mapX - pad, mapY + mapH + pad, 1, -1],
    [mapX + mapW + pad, mapY + mapH + pad, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * b);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * b, cy);
    ctx.stroke();
  }
  ctx.restore();
  caps(s, "Front", mapX + mapW * 0.25, mapY + mapH + 64, { align: "center" });
  caps(s, "Back", mapX + mapW * 0.75, mapY + mapH + 64, { align: "center" });

  // Scale: the colour steps are set counts, so the legend says how many.
  let y = mapY + mapH + 120;
  const barX = x;
  const barW = W - 2 * x;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    ctx.fillStyle = withAlpha(VOLT, 0.28 + (0.72 * i) / (steps - 1));
    ctx.fillRect(barX + (barW / steps) * i, y, barW / steps - 4, 18);
  }
  caps(s, max > 0 ? "Fewer sets" : "No muscle sets logged", barX, y + 56);
  if (max > 0) caps(s, `${setsNumber(max)} working sets`, barX + barW, y + 56, { align: "right" });

  y += 110;
  for (const { muscle, sets } of data.muscles.slice(0, 3)) {
    text(s, MUSCLE_GROUP_LABELS[muscle], x, y, { size: 36, weight: 500, family: "grotesk" });
    const frac = max > 0 ? sets / max : 0;
    ctx.fillStyle = CARBON_2;
    ctx.fillRect(x + 330, y - 22, 480, 16);
    ctx.fillStyle = VOLT;
    ctx.fillRect(x + 330, y - 22, 480 * frac, 16);
    text(s, setsNumber(sets), W - x, y, { size: 36, weight: 700, family: "grotesk", align: "right" });
    y += 58;
  }

  const fy = SAFE_BOTTOM + 70;
  hline(ctx, x, W - x, fy - 64, STEEL);
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const cols = [
    ["Volume", `${vol} ${u}`],
    ["Time", formatDuration(data.durationSec)],
    ["Sets", String(data.setsDone)],
  ];
  cols.forEach(([label, value], i) => {
    const cx = x + i * ((W - 2 * x) / 3);
    caps(s, label, cx, fy - 18);
    text(s, value, cx, fy + 34, { size: 40, weight: 800, family: "grotesk", maxWidth: (W - 2 * x) / 3 - 20 });
  });
}

/** Brutalist Receipt: a till slip on light carbon, every set itemised, stamped at the bottom. */
function brutalistReceipt(s: Scene) {
  const { ctx, data, unit } = s;
  s.onPhoto = false;
  paintBackground(s, "#d4d4d8");

  const px = 100;
  const pw = W - 2 * px;
  const py = 150;
  const ph = H - 2 * py;
  const tooth = 18;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
  ctx.shadowBlur = devicepx(ctx, 30);
  ctx.shadowOffsetY = devicepx(ctx, 10);
  ctx.beginPath();
  ctx.moveTo(px, py + tooth);
  for (let x = px; x < px + pw; x += tooth * 2) {
    ctx.lineTo(x + tooth, py);
    ctx.lineTo(Math.min(x + tooth * 2, px + pw), py + tooth);
  }
  ctx.lineTo(px + pw, py + ph - tooth);
  for (let x = px + pw; x > px; x -= tooth * 2) {
    ctx.lineTo(x - tooth, py + ph);
    ctx.lineTo(Math.max(x - tooth * 2, px), py + ph - tooth);
  }
  ctx.closePath();
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.restore();

  const x = px + 56;
  const r = px + pw - 56;
  const inner = r - x;
  const ink = { family: "receipt" as const, color: INK };
  const dashed = (y: number) => hline(ctx, x, r, y, INK, 3, [12, 10]);

  let y = py + 130;
  if (s.opts.hideWatermark) text(s, "LIFT LOG", W / 2, y, { size: 84, weight: 800, color: INK, align: "center", tracking: -2 });
  else {
    // Mark and name centred together, like a shop logo at the head of a till slip.
    const size = 76;
    setFont(s, 84, 800);
    const nameW = ctx.measureText("ABOT").width - 2 * 4;
    const left = W / 2 - (size + 20 + nameW) / 2;
    mark(ctx, left, y - 66, size, INK);
    text(s, "ABOT", left + size + 20, y, { size: 84, weight: 800, color: INK, tracking: -2 });
  }
  y += 52;
  text(s, "STRENGTH RECEIPT", W / 2, y, { ...ink, size: 34, align: "center", tracking: 6 });
  y += 64;
  const d = new Date(data.startedAt);
  const slash = (t: Date) => `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`;
  if (data.kind === "session") {
    text(s, `DATE ${slash(d)}`, x, y, { ...ink, size: 38 });
    text(s, `TIME ${timeOf(data.startedAt)}`, r, y, { ...ink, size: 38, align: "right" });
  } else {
    text(s, `FROM ${slash(d)}`, x, y, { ...ink, size: 38 });
    text(s, `TO ${slash(new Date(data.endedAt))}`, r, y, { ...ink, size: 38, align: "right" });
  }
  y += 42;
  text(s, `TICKET #${data.sessionId.slice(-6).toUpperCase()}`, x, y, { ...ink, size: 38 });
  if (data.locationName) text(s, data.locationName.toUpperCase(), r, y, { ...ink, size: 38, align: "right", maxWidth: inner / 2 });
  const handle = data.handle?.trim();
  if (handle) {
    y += 42;
    text(s, `MEMBER @${handle}`, x, y, { ...ink, size: 38, maxWidth: inner });
  }
  y += 36;
  dashed(y);
  y += 56;
  text(s, data.title.toUpperCase(), x, y, { ...ink, size: 42, weight: 800, maxWidth: inner });
  y += 28;

  // Itemised sets, cut off with a count when the slip runs out of paper.
  const totalsTop = py + ph - 700;
  const line = 40;
  let remaining = data.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  let budget = Math.floor((totalsTop - y) / line);
  for (const ex of data.exercises) {
    if (budget < 3) break;
    y += line + 6;
    text(s, ex.name.toUpperCase(), x, y, { ...ink, size: 38, weight: 700, maxWidth: inner });
    budget -= 1;
    ex.sets.forEach((set, i) => {
      if (budget < 2) return;
      y += line;
      const vol = set.volumeKg > 0 ? formatWeight(set.volumeKg, unit, false) : "";
      text(s, `${String(i + 1).padStart(2, " ")}  ${setLabel(set, unit)}${set.isPR ? "  PR" : ""}`, x + 20, y, { ...ink, size: 38 });
      if (vol) text(s, vol, r, y, { ...ink, size: 38, align: "right" });
      budget -= 1;
      remaining -= 1;
    });
  }
  if (remaining > 0) {
    y += line;
    text(s, `... +${remaining} MORE ${remaining === 1 ? "SET" : "SETS"}`, x + 20, y, { ...ink, size: 38, color: INK_MUTED });
  }

  y = totalsTop + 30;
  dashed(y);
  y += 60;
  const row = (label: string, value: string, big = false) => {
    text(s, label, x, y, { ...ink, size: big ? 48 : 38, weight: big ? 800 : 400 });
    text(s, value, r, y, { ...ink, size: big ? 58 : 38, weight: big ? 800 : 400, align: "right" });
    y += big ? 64 : 44;
  };
  if (data.kind === "period") row("WORKOUTS", String(data.workouts));
  row("SETS", String(data.setsDone));
  row("DURATION", formatDuration(data.durationSec));
  row("RECORDS", String(data.prs.length));
  row(`TOTAL ${unit.toUpperCase()}`, formatVolume(data.volumeKg, unit).replace(` ${unit}`, ""), true);
  dashed(y - 20);

  // Stamp: PR_BROKEN only when a record really fell. It has its own strip so it covers no figure.
  const broke = data.prs.length > 0;
  const stampY = y + 90;
  ctx.save();
  ctx.translate(W / 2, stampY);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = STAMP_INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(-260, -66, 520, 132);
  ctx.lineWidth = 2;
  ctx.strokeRect(-248, -54, 496, 108);
  text(s, broke ? "APPROVED // PR_BROKEN" : "APPROVED // LOGGED", 0, -4, {
    size: broke ? 48 : 52,
    weight: 400,
    family: "receipt",
    color: STAMP_INK,
    align: "center",
  });
  text(s, broke ? `${data.prs.length} NEW ${data.prs.length === 1 ? "RECORD" : "RECORDS"}` : `${data.setsDone} SETS ON FILE`, 0, 38, {
    size: 32,
    family: "receipt",
    color: STAMP_INK,
    align: "center",
    tracking: 4,
  });
  ctx.restore();

  // Barcode from the session id: the same workout always prints the same bars.
  let bx = x;
  const by = py + ph - 150;
  let seed = [...data.sessionId].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  ctx.fillStyle = INK;
  while (bx < x + 420) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const bw = 2 + (seed % 4) * 2;
    ctx.fillRect(bx, by, bw, 90);
    bx += bw + 3 + ((seed >> 8) % 3) * 2;
  }
  text(s, "KEEP THIS SLIP.", r, by + 36, { ...ink, size: 24, align: "right" });
  text(s, "NEXT TIME, BEAT IT.", r, by + 72, { ...ink, size: 24, align: "right" });
}

const SHORT_KIND: Record<PRKind, string> = { heaviest_weight: "Weight", best_1rm: "1RM", best_set_volume: "Volume" };
const KIND_ORDER: PRKind[] = ["heaviest_weight", "best_1rm", "best_set_volume"];

function groupRecords(prs: StoryData["prs"]): { name: string; records: StoryData["prs"] }[] {
  const by = new Map<string, StoryData["prs"]>();
  for (const pr of prs) by.set(pr.exerciseName, [...(by.get(pr.exerciseName) ?? []), pr]);
  return [...by.entries()].map(([name, records]) => ({
    name,
    records: [...records].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
  }));
}

const TROPHY =
  "M30 18 H70 V40 C70 54 61 64 50 66 C39 64 30 54 30 40 Z M30 24 H18 C18 38 24 46 32 47 M70 24 H82 C82 38 76 46 68 47 M44 66 H56 V76 H44 Z M34 76 H66 V84 H34 Z";
let trophyPath: Path2D | null = null;

/** Hexagon medal with a cup inside; `filled` badges are records, hollow ones are empty slots. */
function trophyBadge(ctx: Ctx, cx: number, cy: number, r: number, ring: string, filled: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? CARBON : "transparent";
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 6;
  if (!filled) ctx.setLineDash([12, 10]);
  ctx.stroke();
  if (filled) {
    trophyPath ??= new Path2D(TROPHY);
    const k = (r * 1.1) / 100;
    ctx.scale(k, k);
    ctx.translate(-50, -52);
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.strokeStyle = ring;
    ctx.setLineDash([]);
    ctx.stroke(trophyPath);
  }
  ctx.restore();
}

/** PR Trophy Vault: medals for every record, then each record with its weight and top tonnage. */
function trophyVault(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);
  const x = 80;
  const inner = W - 2 * x;
  const prs = data.prs;

  wordmark(s, x, SAFE_TOP - 64, 52, VOLT);
  caps(s, "Trophy vault", x, SAFE_TOP, { color: GOLD });
  caps(s, dateLabel(data), W - x, SAFE_TOP, { align: "right" });

  // One medal and one card per lift: a lift can break weight, 1RM and set volume at once.
  const lifts = groupRecords(prs);
  const slots = Math.max(3, Math.min(5, lifts.length));
  const r = 66;
  const gap = (inner - slots * r * 2) / (slots - 1 || 1);
  for (let i = 0; i < slots; i++) {
    const cx = x + r + i * (r * 2 + gap);
    const has = i < lifts.length;
    trophyBadge(ctx, cx, SAFE_TOP + 130, r, has ? (i % 2 === 0 ? GOLD : CYAN) : STEEL_LINE, has);
  }
  if (lifts.length > 5) caps(s, `+${lifts.length - 5} more`, W - x, SAFE_TOP + 240, { align: "right", color: GOLD });

  let y = SAFE_TOP + 330;
  const heading = prs.length > 0 ? `${prs.length} new ${prs.length === 1 ? "record" : "records"}` : "Vault unchanged";
  text(s, heading, x, y, { size: fitSize(s, heading, inner, 112, 60, 900, "serif"), weight: 900, family: "serif", tracking: -2 });
  y += 56;
  const sub = prs.length > 0 ? `on ${lifts.length} ${lifts.length === 1 ? "lift" : "lifts"}, ${data.title}` : data.title;
  text(s, sub, x, y, { size: 38, weight: 400, family: "serif", color: MUTED, maxWidth: inner });
  y += 40;

  const maxTonnage = (name: string) =>
    data.exercises.find((e) => e.name === name)?.sets.reduce((m, st) => Math.max(m, st.volumeKg), 0) ?? 0;

  if (lifts.length > 0) {
    const cardH = 230;
    const fit = Math.max(1, Math.floor((SAFE_BOTTOM - y) / (cardH + 24)));
    const shown = lifts.slice(0, fit);
    for (const lift of shown) {
      rrect(ctx, x, y, inner, cardH, 28);
      ctx.fillStyle = CARBON;
      ctx.fill();
      ctx.strokeStyle = withAlpha(GOLD, 0.45);
      ctx.lineWidth = 2;
      ctx.stroke();
      const lead = lift.records[0];
      const v = prValue(lead, unit);
      text(s, "NEW RECORD", x + 36, y + 58, { size: 28, weight: 600, family: "serif", color: GOLD, tracking: 6 });
      caps(s, lift.records.map((p) => SHORT_KIND[p.kind]).join(" + "), x + inner - 36, y + 58, { align: "right" });
      const vw = text(s, v.main, x + inner - 36, y + 144, { size: 68, weight: 900, family: "serif", color: GOLD, align: "right" });
      text(s, lift.name, x + 36, y + 138, { size: 44, weight: 600, family: "serif", maxWidth: inner - vw - 100 });
      text(s, v.sub, x + 36, y + 196, { size: 28, family: "mono", color: MUTED, maxWidth: inner / 2 });
      text(s, `max set ${formatVolume(maxTonnage(lift.name), unit)}`, x + inner - 36, y + 196, {
        size: 28,
        family: "mono",
        color: MUTED,
        align: "right",
      });
      y += cardH + 24;
    }
    if (shown.length < lifts.length) caps(s, `+${lifts.length - shown.length} more lifts`, x, y + 20);
    else {
      // Room left: the other lifts of the day, as a quieter list.
      const rest = data.exercises.filter((e) => !lifts.some((l) => l.name === e.name) && e.best);
      if (rest.length && y + 160 < SAFE_BOTTOM) {
        y += 40;
        caps(s, "Also lifted", x, y, { color: GOLD });
        y += 30;
        for (const ex of rest.slice(0, Math.floor((SAFE_BOTTOM - y) / 84))) {
          hline(ctx, x, W - x, y, STEEL);
          const rw = text(s, bestLabel(s, ex), W - x, y + 58, { size: 36, weight: 600, family: "serif", align: "right" });
          text(s, ex.name, x, y + 58, { size: 36, weight: 400, family: "serif", maxWidth: inner - rw - 30 });
          y += 84;
        }
      }
    }
  } else {
    text(s, "No record fell this time. Top sets from the session:", x, y + 30, { size: 32, color: MUTED, maxWidth: inner });
    y += 80;
    const top = [...data.exercises].filter((e) => e.best).sort((a, b) => (b.best?.volumeKg ?? 0) - (a.best?.volumeKg ?? 0));
    for (const ex of top.slice(0, 4)) {
      hline(ctx, x, W - x, y, STEEL);
      const rw = text(s, bestLabel(s, ex), W - x, y + 66, { size: 40, weight: 700, family: "mono", align: "right" });
      text(s, ex.name, x, y + 66, { size: 38, weight: 600, maxWidth: inner - rw - 30 });
      y += 100;
    }
    if (top.length === 0) text(s, "No loaded sets in this workout.", x, y + 40, { size: 32, color: MUTED });
  }

  const best = data.exercises.reduce((m, e) => Math.max(m, ...e.sets.map((st) => st.volumeKg)), 0);
  hline(ctx, x, W - x, H - 190, STEEL);
  caps(s, data.kind === "session" ? "Session max set tonnage" : "Max set tonnage", x, H - 128);
  text(s, formatVolume(best, unit), W - x, H - 122, { size: 44, weight: 800, family: "mono", color: GOLD, align: "right" });
}

/* ------------------------------------------------------------------ */
/* Loaded Bar                                                          */
/* ------------------------------------------------------------------ */

/** Names of lifts that set a record in this story, to colour their plates Cyan. */
function recordLifts(data: StoryData): Set<string> {
  return new Set(data.prs.map((p) => p.exerciseName));
}

/**
 * Loaded Bar: the workout as a loaded barbell seen from the side. Each lift is a plate, heaviest
 * volume nearest the collar, its height set by its share of the volume, mirrored on both sleeves;
 * lifts that set a record are Cyan. A legend names the plates; totals sit below.
 */
function loadedBar(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);
  const m = 72;
  const records = recordLifts(data);

  wordmark(s, m, SAFE_TOP - 40, 56, VOLT);
  caps(s, dateLabel(data), W - m, SAFE_TOP - 30, { align: "right", color: MUTED });
  const titleSize = fitSize(s, data.title, W - 2 * m, 92, 52, 700, "grotesk");
  text(s, data.title, m, SAFE_TOP + 90, { size: titleSize, weight: 700, maxWidth: W - 2 * m, family: "grotesk" });

  // The bar.
  const cy = 760;
  const plates = [...data.exercises].sort((a, b) => b.volumeKg - a.volumeKg).slice(0, 4);
  const max = Math.max(...plates.map((p) => p.volumeKg), 1);
  ctx.fillStyle = "#3f3f46";
  rrect(ctx, 24, cy - 11, W - 48, 22, 11);
  ctx.fill();
  // Knurled grip between the collars.
  ctx.save();
  ctx.strokeStyle = "#52525b";
  ctx.lineWidth = 2;
  for (let x = 380; x < W - 380; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, cy - 9);
    ctx.lineTo(x + 8, cy + 9);
    ctx.stroke();
  }
  ctx.restore();

  const shade = (i: number) => withAlpha(VOLT, 1 - i * 0.2);
  for (const side of [-1, 1] as const) {
    // Collar against which the plates load.
    const collar = side === 1 ? W - 360 : 360;
    ctx.fillStyle = STEEL_LINE;
    rrect(ctx, collar - 14, cy - 46, 28, 92, 6);
    ctx.fill();
    let x = collar + side * 22;
    plates.forEach((p, i) => {
      const h = 200 + 420 * Math.sqrt(p.volumeKg / max);
      const w = 64 - i * 6;
      const left = side === 1 ? x : x - w;
      ctx.fillStyle = shade(i);
      rrect(ctx, left, cy - h / 2, w, h, 10);
      ctx.fill();
      // The plate's rim, so neighbours read apart.
      ctx.strokeStyle = OBSIDIAN;
      ctx.lineWidth = 4;
      ctx.stroke();
      // A record-setting lift wears a Cyan cap.
      if (records.has(p.name)) {
        ctx.fillStyle = CYAN;
        rrect(ctx, left + 4, cy - h / 2 + 4, w - 8, 18, 6);
        ctx.fill();
      }
      x += side * (w + 6);
    });
    // Outer collar clamps the stack.
    ctx.fillStyle = TEXT;
    rrect(ctx, side === 1 ? x : x - 22, cy - 30, 22, 60, 5);
    ctx.fill();
  }

  // Legend: which plate is which.
  let y = cy + 400;
  hline(ctx, m, W - m, y - 56, STEEL);
  plates.forEach((p, i) => {
    ctx.fillStyle = shade(i);
    rrect(ctx, m, y - 30, 20, 40, 5);
    ctx.fill();
    if (records.has(p.name)) {
      ctx.fillStyle = CYAN;
      rrect(ctx, m, y - 30, 20, 10, 4);
      ctx.fill();
    }
    const right = formatVolume(p.volumeKg, unit);
    const rw = text(s, right, W - m, y, { size: 34, weight: 700, family: "grotesk", align: "right" });
    text(s, p.name, m + 44, y, { size: 36, weight: 600, maxWidth: W - 2 * m - rw - 80, family: "grotesk" });
    y += 64;
  });
  if (data.exercises.length > plates.length) {
    caps(s, `+${data.exercises.length - plates.length} more on the rack`, m + 44, y);
    y += 50;
  }

  // Totals.
  const by = SAFE_BOTTOM - 40;
  hline(ctx, m, W - m, by - 150, STEEL);
  const [vol, u] = volumeParts(data.volumeKg, unit);
  caps(s, "Total volume", m, by - 92);
  const vw = text(s, vol, m, by, { size: 96, weight: 800, family: "grotesk", tracking: -2 });
  text(s, u, m + vw + 10, by, { size: 40, weight: 700, family: "grotesk", color: MUTED });
  caps(s, "Time", W - m - 300, by - 92);
  text(s, formatDuration(data.durationSec), W - m - 300, by, { size: 56, weight: 800, family: "grotesk" });
  caps(s, "Sets", W - m, by - 92, { align: "right" });
  text(s, String(data.setsDone), W - m, by, { size: 56, weight: 800, family: "grotesk", align: "right" });
}

/* ------------------------------------------------------------------ */
/* Volt Poster                                                         */
/* ------------------------------------------------------------------ */

/**
 * Volt Poster: a Swiss-style poster, black on Volt. The volume figure fills the width, then the
 * sets, time and records each on a full-width line between heavy rules, then the lifts small.
 */
function voltPoster(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, VOLT);
  const m = 64;
  const inner = W - 2 * m;
  const ink = (str: string, x: number, y: number, o: Partial<TextOpts> & { size: number }) =>
    text(s, str, x, y, { color: INK, shadow: false, ...o });

  // Header.
  if (!s.opts.hideWatermark) {
    mark(ctx, m, SAFE_TOP - 80, 60, INK);
    ink("ABOT", m + 78, SAFE_TOP - 34, { size: 52, family: "display", tracking: 2 });
  }
  ink(dateLabel(data).toUpperCase(), W - m, SAFE_TOP - 34, { size: 30, weight: 700, family: "mono", align: "right", tracking: 2 });
  hline(ctx, m, W - m, SAFE_TOP + 8, INK, 8);

  // The figure.
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const vs = fitSize(s, vol, inner, 400, 160, 400, "display");
  ink(vol, m - 8, SAFE_TOP + 40 + vs * 0.86, { size: vs, family: "display", tracking: -4 });
  // The figure's comma and digits hang below the baseline; leave them room.
  let y = SAFE_TOP + 40 + vs * 0.86 + 110;
  ink(`${u.toUpperCase()} LIFTED`, m, y, { size: 64, family: "display", tracking: 2 });
  y += 46;
  hline(ctx, m, W - m, y, INK, 8);

  // Full-width lines.
  const rows: [string, string][] = [
    [String(data.setsDone), "SETS"],
    [formatDuration(data.durationSec).toUpperCase(), "TIME"],
    [String(recordLifts(data).size), recordLifts(data).size === 1 ? "RECORD" : "RECORDS"],
  ];
  for (const [value, label] of rows) {
    y += 140;
    ink(value, m, y, { size: 132, family: "display", tracking: -2 });
    ink(label, W - m, y, { size: 48, family: "display", align: "right", tracking: 4 });
    y += 34;
    hline(ctx, m, W - m, y, INK, 4);
  }

  // Title and lifts.
  y += 86;
  const lines = wrap(s, data.title.toUpperCase(), inner, 72, 400, 2, "display");
  for (const l of lines) {
    ink(l, m, y, { size: 72, family: "display" });
    y += 72;
  }
  y += 6;
  const room = Math.max(0, Math.floor((SAFE_BOTTOM + 40 - y) / 46));
  const shown = data.exercises.slice(0, room);
  for (const ex of shown) {
    const right = bestLabel(s, ex);
    const rw = ink(right, W - m, y, { size: 32, weight: 700, family: "mono", align: "right" });
    ink(ex.name, m, y, { size: 32, weight: 600, maxWidth: inner - rw - 30 });
    y += 46;
  }
  if (shown.length < data.exercises.length) ink(`+${data.exercises.length - shown.length} MORE`, m, y, { size: 26, weight: 700, family: "mono" });
}

/* ------------------------------------------------------------------ */
/* Matchday                                                            */
/* ------------------------------------------------------------------ */

/**
 * Matchday: the workout as a full-time scoreboard. Anton capitals, a Volt band cut on the slant,
 * the volume as the final score, the lifts as the line-up and each record a goal.
 */
function matchday(s: Scene) {
  const { ctx, data, unit, time } = s;
  paintBackground(s, "#0b0b0d");
  const m = 72;
  const inner = W - 2 * m;
  const b = (start: number, dur: number, ease: Ease = easeOut) => beat(time, start, dur, ease);

  // The slanted band: the broadcast graphic behind the score.
  const band = b(0, 0.6, easeInOut);
  ctx.save();
  ctx.translate((1 - band) * -W, 0);
  ctx.fillStyle = VOLT;
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.lineTo(W, 330);
  ctx.lineTo(W, 820);
  ctx.lineTo(0, 960);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  for (let i = -4; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 60, 960);
    ctx.lineTo(i * 60 + 30, 960);
    ctx.lineTo(i * 60 + 180, 330);
    ctx.lineTo(i * 60 + 150, 330);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Header: the full-time tag flips down like a scoreboard card.
  wordmark(s, m, SAFE_TOP - 50, 48, VOLT);
  const flip = b(0.3, 0.5, backOut);
  ctx.save();
  ctx.translate(W - m - 250, SAFE_TOP - 86);
  ctx.scale(1, Math.max(0.001, flip));
  ctx.fillStyle = VOLT;
  ctx.fillRect(0, 0, 250, 74);
  text(s, data.kind === "session" ? "FULL TIME" : "SEASON", 125, 54, { size: 52, family: "display", color: INK, align: "center", shadow: false, tracking: 2 });
  ctx.restore();
  text(s, `${dateLabel(data)}${data.locationName ? `  ·  ${data.locationName.toUpperCase()}` : ""}`, m, SAFE_TOP + 22, {
    size: 30,
    weight: 500,
    family: "grotesk",
    color: MUTED,
    tracking: 2,
    maxWidth: inner,
  });
  const title = data.title.toUpperCase();
  const ts = fitSize(s, title, inner, 150, 80, 400, "display");
  ctx.save();
  ctx.globalAlpha = b(0.5, 0.5);
  text(s, title, m, SAFE_TOP + 40 + ts * 0.9, { size: ts, family: "display", maxWidth: inner });
  ctx.restore();

  // The score on the band, counting up.
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const p = b(0.9, 1.5, easeOut);
  const shown = p >= 1 ? vol : formatVolume(countUp(data.volumeKg, p), unit).split(" ")[0]!;
  const vs = fitSize(s, vol, inner - 120, 300, 150, 400, "display");
  ink(s, shown, m, 760, { size: vs, family: "display", tracking: -2 });
  ink(s, `${u.toUpperCase()} ON THE BOARD`, m + 6, 836, { size: 40, family: "display", tracking: 3 });

  // Match stats: three boxed figures.
  const stats: [string, string][] = [
    ["TIME", formatDuration(data.durationSec).toUpperCase()],
    ["SETS", String(data.setsDone)],
    [recordLifts(data).size === 1 ? "GOAL" : "GOALS", String(recordLifts(data).size)],
  ];
  const colW = inner / 3;
  stats.forEach(([label, value], i) => {
    const pi = stagger(time, i, 2.0, 0.15, 0.4, backOut);
    ctx.save();
    ctx.globalAlpha = Math.min(1, pi);
    const cx = m + i * colW;
    ctx.translate(0, (1 - pi) * 40);
    const size = fitSize(s, value, colW - 24, 96, 48, 400, "display");
    text(s, value, cx, 1080, { size, family: "display", color: i === 2 && recordLifts(data).size ? VOLT : TEXT });
    text(s, label, cx, 1126, { size: 28, weight: 700, family: "grotesk", color: MUTED, tracking: 4 });
    ctx.restore();
  });
  hline(ctx, m, W - m, 1176, STEEL, 3);

  // The line-up: numbered like shirts, each record marked as a goal.
  text(s, "LINE-UP", m, 1236, { size: 34, family: "display", color: VOLT, tracking: 4 });
  const records = recordLifts(data);
  let y = 1300;
  const room = Math.max(1, Math.floor((SAFE_BOTTOM - y) / 70));
  data.exercises.slice(0, room).forEach((ex, i) => {
    const pi = stagger(time, i, 2.6, 0.18, 0.45);
    ctx.save();
    ctx.globalAlpha = pi;
    ctx.translate((1 - pi) * -60, 0);
    ctx.fillStyle = records.has(ex.name) ? VOLT : STEEL;
    ctx.fillRect(m, y - 44, 58, 58);
    text(s, String(i + 1), m + 29, y, { size: 42, family: "display", color: records.has(ex.name) ? INK : TEXT, align: "center", shadow: false });
    const right = bestLabel(s, ex);
    const rw = text(s, right, W - m, y, { size: 38, family: "display", align: "right", tracking: 1 });
    text(s, ex.name, m + 84, y, { size: 36, weight: 700, family: "grotesk", maxWidth: inner - rw - 120 });
    if (records.has(ex.name)) {
      const pop = stagger(time, i, 3.2, 0.18, 0.4, backOut);
      ctx.save();
      ctx.translate(W - m - rw - 60, y - 16);
      ctx.scale(pop, pop);
      ctx.fillStyle = VOLT;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    y += 70;
  });
  if (room < data.exercises.length) text(s, `+${data.exercises.length - room} MORE`, m, y, { size: 28, family: "display", color: MUTED, tracking: 2 });
}

/** Ink text on the Volt band: no shadow, the band is the contrast. */
function ink(s: Scene, str: string, x: number, y: number, o: Partial<TextOpts> & { size: number }) {
  return text(s, str, x, y, { color: INK, shadow: false, ...o });
}

/* ------------------------------------------------------------------ */
/* Editorial                                                           */
/* ------------------------------------------------------------------ */

/**
 * Editorial: a magazine cover. Fraunces masthead, the lifter's photo in black and white (or warm
 * paper without one), the top lift as the cover story and each record as a teaser.
 */
function editorial(s: Scene) {
  const { ctx, data, unit, time, opts } = s;
  const paper = !opts.photo;
  const fg = paper ? INK : "#fbfaf7";
  const sub = paper ? "#57534e" : "rgba(251, 250, 247, 0.8)";
  const accent = paper ? "#b91c1c" : VOLT;
  ctx.fillStyle = paper ? "#f3efe6" : "#0c0c0c";
  ctx.fillRect(0, 0, W, H);
  if (opts.photo) {
    // A slow push in, the way a cover is filmed.
    const z = 1.08 - 0.08 * beat(time, 0, STORY_SECONDS, linear);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.drawImage(opts.photo.layer(true), -W / 2, -H / 2, W, H);
    ctx.restore();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(0,0,0,${opts.overlay * 0.7})`);
    g.addColorStop(0.45, "rgba(0,0,0,0.05)");
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, opts.overlay + 0.25)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    s.onPhoto = false;
  }
  const m = 64;
  const inner = W - 2 * m;
  const b = (start: number, dur: number) => beat(time, start, dur, easeOut);
  const fade = (p: number, dy: number, draw: () => void) => {
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * dy);
    draw();
    ctx.restore();
  };

  // Masthead across the top; with the watermark off, the title of the issue takes its place.
  const mast = opts.hideWatermark ? "TRAINING" : "ABOT";
  fade(b(0.1, 0.7), -40, () => {
    const ms = fitSize(s, mast, inner, 330, 160, 900, "serif");
    text(s, mast, W / 2, SAFE_TOP - 20 + ms * 0.72, { size: ms, weight: 900, family: "serif", color: fg, align: "center", tracking: -6 });
    hline(ctx, m, W - m, SAFE_TOP + ms * 0.72 + 10, fg, 3);
    const issue = `ISSUE ${dateLabel(data)}${data.locationName ? `  ·  ${data.locationName.toUpperCase()}` : ""}`;
    text(s, issue, m, SAFE_TOP + ms * 0.72 + 56, { size: 26, weight: 600, family: "serif", color: sub, tracking: 3, maxWidth: inner });
    text(s, "STRENGTH EDITION", W - m, SAFE_TOP + ms * 0.72 + 56, { size: 26, weight: 600, family: "serif", color: accent, align: "right", tracking: 3 });
  });

  // Without a photo the cover image is the day's volume, set huge in the serif.
  if (paper) {
    const [bigVol] = volumeParts(data.volumeKg, unit);
    fade(b(0.4, 1.0), 30, () => {
      const vs = fitSize(s, bigVol, inner + 40, 380, 160, 900, "serif");
      text(s, bigVol, W / 2, 900, { size: vs, weight: 900, family: "serif", color: "#e4ddd0", align: "center", tracking: -10, shadow: false });
    });
  }

  // The cover story: the heaviest lift of the day.
  const top = [...data.exercises].filter((e) => e.best).sort((a, c) => (c.best?.volumeKg ?? 0) - (a.best?.volumeKg ?? 0))[0];
  let y = 1020;
  fade(b(0.8, 0.8), 40, () => {
    text(s, "THE COVER STORY", m, y, { size: 26, weight: 600, family: "serif", color: accent, tracking: 4 });
    const lines = wrap(s, top ? top.name : data.title, inner, 104, 600, 2, "serif");
    lines.forEach((l, i) => text(s, l, m, y + 100 + i * 104, { size: 104, weight: 600, family: "serif", color: fg, tracking: -2 }));
    if (top) text(s, `${bestLabel(s, top)}, set by set.`, m, y + 100 + lines.length * 104, { size: 40, weight: 400, family: "serif", color: sub, maxWidth: inner });
  });

  // Teasers down the side: the numbers, then each record.
  y = 1440;
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const teasers: [string, string][] = [
    [`${vol} ${u}`, "moved, in all"],
    [formatDuration(data.durationSec), `${data.setsDone} sets`],
    ...data.prs.slice(0, 2).map((pr): [string, string] => [prValue(pr, unit).main, `new record, ${pr.exerciseName}`]),
  ];
  teasers.slice(0, 4).forEach(([big, small], i) => {
    fade(stagger(time, i, 1.8, 0.35, 0.6), 30, () => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = m + col * (inner / 2);
      const ty = y + row * 120;
      text(s, big, x, ty, { size: 58, weight: 900, family: "serif", color: col === 0 && row === 0 ? accent : fg, maxWidth: inner / 2 - 24 });
      text(s, small, x, ty + 42, { size: 28, weight: 400, family: "serif", color: sub, maxWidth: inner / 2 - 24 });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Arcade                                                              */
/* ------------------------------------------------------------------ */

const ARCADE_BG = "#0b0820";
const ARCADE_PINK = "#ff3ea5";

/**
 * Arcade: the workout as a cleared level. Silkscreen pixel capitals on a scanlined night-blue
 * screen, the volume as the score and an XP bar filling, each lift a quest with a star per record.
 */
function arcade(s: Scene) {
  const { ctx, data, unit, time } = s;
  paintBackground(s, ARCADE_BG);
  s.onPhoto = false;
  const m = 72;
  const inner = W - 2 * m;
  const b = (start: number, dur: number, ease: Ease = easeOut) => beat(time, start, dur, ease);

  // Pixel grid and scanlines.
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (let y = 0; y < H; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < W; x += 24) ctx.fillRect(x, y, 4, 4);
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  ctx.restore();

  const px = (str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left", weight = 700) => {
    // A hard drop shadow one pixel-step down and right, like an old cabinet.
    text(s, str, x + size / 8, y + size / 8, { size, weight, family: "pixel", color: ARCADE_PINK, align, shadow: false, maxWidth: inner });
    return text(s, str, x, y, { size, weight, family: "pixel", color, align, shadow: false, maxWidth: inner });
  };

  if (!s.opts.hideWatermark) px("ABOT", m, SAFE_TOP - 40, 44, VOLT);
  px(dateLabel(data), W - m, SAFE_TOP - 40, 28, CYAN, "right", 400);

  // LEVEL CLEARED types itself out.
  const head = data.kind === "session" ? "LEVEL CLEARED!" : "SEASON CLEARED!";
  const hs = fitSize(s, head, inner, 104, 60, 700, "pixel");
  px(typed(head, b(0.3, 0.9, linear)), W / 2, SAFE_TOP + 130, hs, VOLT, "center");
  px(`STAGE: ${data.title.toUpperCase()}`, W / 2, SAFE_TOP + 210, 34, "#ffffff", "center", 400);

  // Score and XP bar.
  const p = b(1.2, 1.4);
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const score = p >= 1 ? vol : formatVolume(countUp(data.volumeKg, p), unit).split(" ")[0]!;
  let y = SAFE_TOP + 380;
  px("SCORE", m, y, 34, CYAN, "left", 400);
  px(`${score} ${u.toUpperCase()}`, W - m, y, 64, "#ffffff", "right");
  y += 60;
  const barH = 44;
  ctx.fillStyle = "#1e1846";
  ctx.fillRect(m, y, inner, barH);
  const cells = 20;
  const lit = Math.round(cells * p);
  for (let i = 0; i < cells; i++) {
    ctx.fillStyle = i < lit ? (i % 2 ? VOLT : "#a8e600") : "#2a2360";
    ctx.fillRect(m + 6 + (i * (inner - 12)) / cells, y + 6, (inner - 12) / cells - 6, barH - 12);
  }
  y += barH + 46;
  px(`+${setsNumber(data.setsDone * 10)} XP`, W - m, y, 30, VOLT, "right", 400);

  // Stats as three cabinet boxes.
  y += 50;
  const boxW = (inner - 40) / 3;
  const stats: [string, string][] = [
    ["TIME", formatDuration(data.durationSec).toUpperCase()],
    ["SETS", String(data.setsDone)],
    ["PR", String(data.prs.length)],
  ];
  stats.forEach(([label, value], i) => {
    const pi = stagger(time, i, 2.4, 0.15, 0.35, backOut);
    const x = m + i * (boxW + 20);
    ctx.save();
    ctx.globalAlpha = Math.min(1, pi);
    ctx.strokeStyle = i === 2 && data.prs.length ? VOLT : CYAN;
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, boxW, 150);
    text(s, label, x + boxW / 2, y + 50, { size: 26, family: "pixel", color: CYAN, align: "center", shadow: false });
    text(s, value, x + boxW / 2, y + 116, { size: 44, weight: 700, family: "pixel", color: "#ffffff", align: "center", shadow: false, maxWidth: boxW - 20 });
    ctx.restore();
  });

  // Quests: each lift, with a star for each record it set.
  y += 230;
  px("QUESTS", m, y, 34, VOLT, "left", 400);
  y += 70;
  const byLift = new Map(groupRecords(data.prs).map((g) => [g.name, g.records.length]));
  const room = Math.max(1, Math.floor((SAFE_BOTTOM - y) / 66));
  data.exercises.slice(0, room).forEach((ex, i) => {
    const pi = stagger(time, i, 3.0, 0.2, 0.3, linear);
    if (pi <= 0) return;
    const stars = byLift.get(ex.name) ?? 0;
    const right = bestLabel(s, ex).toUpperCase();
    const rw = text(s, right, W - m, y, { size: 30, family: "pixel", color: "#ffffff", align: "right", shadow: false });
    text(s, `${i + 1}. ${ex.name.toUpperCase()}`, m, y, { size: 30, family: "pixel", color: "#d6d3ff", shadow: false, maxWidth: inner - rw - 130 });
    for (let k = 0; k < Math.max(1, stars); k++) pixelStar(ctx, W - m - rw - 40 - k * 36, y - 14, stars > 0 ? VOLT : "#3b347a", stagger(time, i, 3.3, 0.2, 0.3, backOut));
    y += 66;
  });

  // Blinks in the video; steady on the still.
  const blink = time >= STORY_SECONDS || Math.floor(time * 2) % 2 === 0;
  if (blink) px("PRESS START TO TRAIN AGAIN", W / 2, SAFE_BOTTOM + 60, 30, "#ffffff", "center", 400);
}

/** A five-point star in square pixels, `scale` 0 to 1 for the pop. */
function pixelStar(ctx: Ctx, cx: number, cy: number, color: string, scale: number) {
  const rows = ["..#..", "..#..", "#####", ".###.", "##.##"];
  const cell = 6 * Math.max(0, scale);
  ctx.save();
  ctx.fillStyle = color;
  rows.forEach((row, r) =>
    [...row].forEach((c, k) => {
      if (c === "#") ctx.fillRect(cx + (k - 2.5) * cell, cy + (r - 2.5) * cell, cell, cell);
    }),
  );
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* @handle                                                             */
/* ------------------------------------------------------------------ */

interface HandleSpot {
  x: number;
  y: number;
  align: CanvasTextAlign;
  color: string;
}

/**
 * Where each layout carries the lifter's @handle: a quiet line placed in that layout's own free
 * space, in the layout's text colour. `null` means the painter prints it itself.
 */
const HANDLE_SPOTS: Record<StoryPresetId, HandleSpot | null> = {
  // Under the date line, beside the score band.
  matchday: { x: W - 72, y: 1236, align: "right", color: MUTED },
  // Between the load bars and the stats row.
  "thermal-matrix": { x: W - 84, y: 1652, align: "right", color: VOLT },
  // A MEMBER line in the receipt header.
  "brutalist-receipt": null,
  // The cover credit, under the teasers.
  editorial: { x: 64, y: 1700, align: "left", color: "#a8a29e" },
  // The player name, under the quests.
  arcade: { x: W - 72, y: 300, align: "right", color: "#ff3ea5" },
  // Under the totals.
  "loaded-bar": { x: 72, y: 1722, align: "left", color: MUTED },
  // Above the tonnage footer.
  "trophy-vault": { x: 80, y: 1690, align: "left", color: GOLD },
  // The poster's signature line.
  "volt-poster": { x: 64, y: 1790, align: "left", color: INK },
};

function drawHandle(s: Scene) {
  const handle = s.data.handle?.trim();
  if (!handle) return;
  const spot = HANDLE_SPOTS[s.opts.preset];
  if (!spot) return;
  text(s, `@${handle}`, spot.x, spot.y, {
    size: 32,
    weight: 700,
    family: "mono",
    color: spot.color,
    align: spot.align,
    maxWidth: W - 160,
  });
}

const PAINTERS: Record<StoryPresetId, (s: Scene) => void> = {
  matchday,
  "thermal-matrix": thermalMatrix,
  "brutalist-receipt": brutalistReceipt,
  editorial,
  arcade,
  "loaded-bar": loadedBar,
  "trophy-vault": trophyVault,
  "volt-poster": voltPoster,
};

/**
 * Draws one preset in 1080x1920 units. Scale the context first to draw a thumbnail; the
 * layout does not change with size.
 */
/**
 * The founder stamp: a small plate in the top-right corner, above every layout's own top line
 * (inside Instagram's top bar margin, which only covers the progress bars and the name).
 */
function drawFounderBadge(s: Scene) {
  const code = s.opts.founderBadge;
  if (!code) return;
  const { ctx } = s;
  const label = "ABOT // FOUNDER EDITION";
  const num = code.replace(/^FOUNDER\s*\/\/\s*/, "");
  ctx.save();
  ctx.font = `700 22px ${s.fonts.mono}`;
  const w = Math.max(ctx.measureText(label).width, ctx.measureText(num).width) + 40;
  const h = 76;
  const x = W - 56 - w;
  const y = 130;
  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
  ctx.strokeStyle = VOLT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  text(s, label, x + 20, y + 28, { size: 20, weight: 700, family: "mono", color: VOLT, baseline: "middle", tracking: 2, shadow: false });
  text(s, num, x + 20, y + 56, { size: 22, weight: 700, family: "mono", color: "#ffffff", baseline: "middle", tracking: 2, shadow: false });
}

export function renderStory(ctx: Ctx, data: StoryData, opts: StoryOptions, fonts: StoryFonts, time = STORY_SECONDS): void {
  const scene: Scene = { ctx, fonts, time, data, unit: data.unit, opts, onPhoto: opts.photo !== null };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  PAINTERS[opts.preset](scene);
  drawHandle(scene);
  drawFounderBadge(scene);
  ctx.restore();
}
