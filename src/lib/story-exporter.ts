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
import { currentT, type T } from "@/i18n";
import { canShareFiles, saveFile, shareFile, type SaveResult, type ShareResult } from "@/lib/native/files";
import { MARK_PATH } from "@/components/brand/mark-path";
import { LIFT_SHAPES, type ObjectLayer, type ObjectTone } from "@/lib/story-objects";
import { AXES, AXIS_MUSCLES, type Axis } from "@/lib/symmetry-analyzer";
import { END_CARD_AT, STILL_TIME, backOut, beat, clamp01, countUp, easeInOut, easeOut, linear, stagger } from "@/lib/story-motion";

/**
 * Story text in the app's language (shared stories were drawn in English in Indonesian mode).
 * tl: as written; TL: upper case, for the slips and posters set in capitals. Keys: STORY_KEYS.
 */
const tl = (key: string, params?: Record<string, string | number>) => currentT()(key, params);
const TL = (key: string, params?: Record<string, string | number>) => tl(key, params).toLocaleUpperCase(currentT().locale);

/** Every text the stories pass to tl/TL, for the translation coverage test (i18n/dynamic-keys). */
export const STORY_KEYS = [
  "Front", "Back (side)", "Fewer sets", "No muscle sets logged", "{n} working sets", "Volume", "Time", "Sets",
  "Thermal matrix // muscle load", "Lift log", "Strength receipt", "... +{n} more set", "... +{n} more sets",
  "{n} new record", "{n} new records", "{n} sets on file", "Keep this slip.", "Next time, beat it.", "Trophy vault",
  "Vault unchanged", "Also lifted", "New record", "No record fell this time. Top sets from the session:",
  "No loaded sets in this workout.", "Total volume", "Line-up", "Strength edition", "The cover story", "{n} sets",
  "Logged with ABOT", "{n} set", "Records", "Top set", "Reps", "Most worked: {axis}", "Push", "Pull", "Quads", "Hamstrings", "Arms", "Core",
  "{n} cat lifted!", "{n} cats lifted!", "Not one of them was impressed.",
  "{n} bike lifted!", "{n} bikes lifted!", "Leg day? Arms did the pedalling.",
  "{n} fridge lifted!", "{n} fridges lifted!", "Moving day, sorted.",
  "{n} motorbike lifted!", "{n} motorbikes lifted!", "No kickstand needed.",
  "{n} car lifted!", "{n} cars lifted!", "Who needs a tow truck?",
  "{n} elephant lifted!", "{n} elephants lifted!", "The whole herd felt that.",
  "{n} bus lifted!", "{n} buses lifted!", "Next stop: a new PR.",
  "{n} plane lifted!", "{n} planes lifted!", "Cleared for takeoff.",
  "{n} blue whale lifted!", "{n} blue whales lifted!", "Strength, ocean sized.",
];

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export type StoryPresetId = "clean" | "headline" | "top-set" | "sidebar" | "lineup" | "grid" | "thermal-matrix" | "trophy-vault";

/**
 * The layouts, each its own look: typeface, palette, texture and the way it moves. Clean is always
 * free; of the rest, the first `tunables().story.freePresets` (2) are, so the order sets what is PRO.
 */
export const STORY_PRESETS: { id: StoryPresetId; name: string; blurb: string }[] = [
  { id: "clean", name: "Clean", blurb: "Your photo first, a few quiet lines" },
  { id: "headline", name: "Headline", blurb: "Your volume, poster size, over your photo" },
  { id: "top-set", name: "Top Set", blurb: "Your best set of the day, front and centre" },
  { id: "sidebar", name: "Sidebar", blurb: "Your photo, the numbers stacked beside it" },
  { id: "lineup", name: "Lineup", blurb: "Every lift listed under your photo" },
  { id: "grid", name: "Grid", blurb: "Four big numbers in a grid under your photo" },
  { id: "thermal-matrix", name: "Thermal Matrix", blurb: "Muscle map lit by sets worked" },
  { id: "trophy-vault", name: "Trophy Vault", blurb: "Records first, engraved in gold" },
];

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
  /** ABOT Pro: leave out the ABOT mark and name. */
  hideWatermark?: boolean;
  /** Founder pass holders: "FOUNDER // #0421" stamped in the top corner. */
  founderBadge?: string | null;
  /** Clean only: where its text block sits. Bottom left when not given. */
  textPosition?: TextPosition;
  /** Clean only: a muscle map or a "like lifting 2 cars" picture above the text. None when not given. */
  cleanExtra?: CleanExtra;
  /** Clean only: how big the text and the picture above it are, each from SIZE_RANGE (1 is as designed). */
  textScale?: number;
  extraScale?: number;
}

export const SIZE_RANGE = { min: 0.7, max: 1.5, step: 0.05, initial: 1 } as const;

function clampSize(k: number | undefined): number {
  return Math.min(SIZE_RANGE.max, Math.max(SIZE_RANGE.min, k ?? SIZE_RANGE.initial));
}

export type CleanExtra = "none" | "muscles" | "radar" | "compare";

/** Short, so four fit across a phone. */
export const CLEAN_EXTRAS: { id: CleanExtra; label: string }[] = [
  { id: "none", label: "Text" },
  { id: "muscles", label: "Muscles" },
  { id: "radar", label: "Radar" },
  { id: "compare", label: "Compare" },
];

/** The radar's six axes, as on the Progress balance radar, with labels short enough to sit around it. */
const RADAR_LABEL: Record<Axis, string> = { push: "Push", pull: "Pull", knee: "Quads", hip: "Hamstrings", arms: "Arms", core: "Core" };

/**
 * Sets per axis from the card's muscles (secondary muscles count half), each as a share of the
 * most worked axis, and that axis. A muscle on two axes (biceps: pull and arms) counts on both.
 */
export function radarAxes(data: Pick<StoryData, "muscles">): { sets: Record<Axis, number>; share: Record<Axis, number>; dominant: Axis | null } {
  const sets = Object.fromEntries(AXES.map((a) => [a, 0])) as Record<Axis, number>;
  for (const { muscle, sets: n } of data.muscles)
    for (const a of AXES) if (AXIS_MUSCLES[a].includes(muscle)) sets[a] += n;
  const max = Math.max(0, ...AXES.map((a) => sets[a]));
  const share = Object.fromEntries(AXES.map((a) => [a, max > 0 ? sets[a] / max : 0])) as Record<Axis, number>;
  const dominant = max > 0 ? AXES.reduce((best, a) => (sets[a] > sets[best] ? a : best), AXES[0]!) : null;
  return { sets, share, dominant };
}

/**
 * Everyday things by their weight, for "2 elephants lifted!" and a line to go with it. Rounded, typical weights:
 * a house cat, a road bike, a fridge, a scooter-style motorbike, a family car, an African
 * elephant, a city bus, a narrow-body airliner empty, and a blue whale.
 */
export const LIFT_OBJECTS = [
  { id: "cat", kg: 4, one: "{n} cat lifted!", other: "{n} cats lifted!", quip: "Not one of them was impressed." },
  { id: "bicycle", kg: 15, one: "{n} bike lifted!", other: "{n} bikes lifted!", quip: "Leg day? Arms did the pedalling." },
  { id: "fridge", kg: 90, one: "{n} fridge lifted!", other: "{n} fridges lifted!", quip: "Moving day, sorted." },
  { id: "motorbike", kg: 110, one: "{n} motorbike lifted!", other: "{n} motorbikes lifted!", quip: "No kickstand needed." },
  { id: "car", kg: 1500, one: "{n} car lifted!", other: "{n} cars lifted!", quip: "Who needs a tow truck?" },
  { id: "elephant", kg: 6000, one: "{n} elephant lifted!", other: "{n} elephants lifted!", quip: "The whole herd felt that." },
  { id: "bus", kg: 12000, one: "{n} bus lifted!", other: "{n} buses lifted!", quip: "Next stop: a new PR." },
  { id: "airplane", kg: 41000, one: "{n} plane lifted!", other: "{n} planes lifted!", quip: "Cleared for takeoff." },
  { id: "whale", kg: 150000, one: "{n} blue whale lifted!", other: "{n} blue whales lifted!", quip: "Strength, ocean sized." },
] as const;

export type LiftObject = (typeof LIFT_OBJECTS)[number];

/**
 * The biggest thing the volume covers at least once, and how many of it: 9,000 kg is 1.5
 * elephants. Counts under 10 keep one decimal, so the number reads as earned, not inflated.
 * Below one cat, it is a share of a cat.
 */
export function liftComparison(volumeKg: number): { object: LiftObject; count: number } {
  const object = [...LIFT_OBJECTS].reverse().find((o) => volumeKg >= o.kg) ?? LIFT_OBJECTS[0];
  const raw = volumeKg / object.kg;
  const count = raw < 10 ? Math.round(raw * 10) / 10 : Math.round(raw);
  return { object, count };
}

/** The nine places Clean can put its text: rows top, middle, bottom by columns left, centre, right. */
export type TextPosition = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";

export const TEXT_POSITIONS: { id: TextPosition; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top", label: "Top" },
  { id: "top-right", label: "Top right" },
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom", label: "Bottom" },
  { id: "bottom-right", label: "Bottom right" },
];

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
/** What the share sheet says with a workout story, in the app's language. */
export function workoutShareText(t: T = currentT()): { title: string; text: string } {
  return { title: t("ABOT Workout Story"), text: t("Crushed today's workout with ABOT ⚡") };
}

export function shareStoryPng(
  blob: Blob,
  fileName: string,
  text: { title: string; text: string } = workoutShareText(),
): Promise<ShareResult> {
  return shareFile(new File([blob], fileName, { type: "image/png" }), text);
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
  /** Seconds into the clip; a still is drawn at STILL_TIME, every beat complete. */
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

/** Mono uppercase label: the canvas twin of the app's `field-label`. */
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


/** "12.3k kg" -> ["12.3k", "kg"] so the figure and the unit can be sized apart. */
/** The whole figure for a hero number ("12,450" and "kg"); a million and up reads "1.2M". */
function bigVolume(kg: number, unit: WeightUnit, locale: string): [string, string] {
  const v = unit === "kg" ? kg : kg / 0.45359237;
  const figure = v >= 1e6 ? `${(v / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })}M` : Math.round(v).toLocaleString(locale);
  return [figure, unit];
}

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
  // The photo stays visible: a soft shade instead of a flat tint, and no grid or scanlines.
  cinematic(s, { bottomFrom: H * 0.55 });

  const x = 84;
  wordmark(s, x, SAFE_TOP - 40, 56, VOLT);
  caps(s, tl("Thermal matrix // muscle load"), x, SAFE_TOP + 20, { color: VOLT });
  caps(s, dateLabel(data), W - x, SAFE_TOP + 20, { align: "right" });
  text(s, data.title, x, SAFE_TOP + 100, { size: fitSize(s, data.title, W - 2 * x, 72, 44, 700, "grotesk"), weight: 700, family: "grotesk", maxWidth: W - 2 * x });

  const mapW = 900;
  const mapX = (W - mapW) / 2;
  const mapY = SAFE_TOP + 170;
  const mapH = (mapW * 1360) / 1448;
  const { heat: full, max } = regionHeat(data);
  // In the video the heat spreads over the body; the still shows it all.
  const spread = beat(s.time, 0.5, 2.2, easeInOut);
  const heat: typeof full = {};
  for (const [r, v] of Object.entries(full)) if ((v ?? 0) * spread > 0.02) heat[r as Region] = (v ?? 0) * spread;
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
  caps(s, tl("Front"), mapX + mapW * 0.25, mapY + mapH + 64, { align: "center" });
  caps(s, tl("Back (side)"), mapX + mapW * 0.75, mapY + mapH + 64, { align: "center" });

  // Scale: the colour steps are set counts, so the legend says how many.
  let y = mapY + mapH + 120;
  const barX = x;
  const barW = W - 2 * x;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    ctx.fillStyle = withAlpha(VOLT, 0.28 + (0.72 * i) / (steps - 1));
    ctx.fillRect(barX + (barW / steps) * i, y, barW / steps - 4, 18);
  }
  caps(s, max > 0 ? tl("Fewer sets") : tl("No muscle sets logged"), barX, y + 56);
  if (max > 0) caps(s, tl("{n} working sets", { n: setsNumber(max) }), barX + barW, y + 56, { align: "right" });

  y += 110;
  for (const { muscle, sets } of data.muscles.slice(0, 3)) {
    text(s, tl(MUSCLE_GROUP_LABELS[muscle]), x, y, { size: 36, weight: 500, family: "grotesk" });
    const frac = (max > 0 ? sets / max : 0) * beat(s.time, 2.4, 1.2);
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
    [tl("Volume"), `${vol} ${u}`],
    [tl("Time"), formatDuration(data.durationSec)],
    [tl("Sets"), String(data.setsDone)],
  ];
  cols.forEach(([label, value], i) => {
    const cx = x + i * ((W - 2 * x) / 3);
    caps(s, label, cx, fy - 18);
    text(s, value, cx, fy + 34, { size: 40, weight: 800, family: "grotesk", maxWidth: (W - 2 * x) / 3 - 20 });
  });
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
  caps(s, tl("Trophy vault"), x, SAFE_TOP, { color: GOLD });
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
  const heading = prs.length > 0 ? tl(prs.length === 1 ? "{n} new record" : "{n} new records", { n: prs.length }) : tl("Vault unchanged");
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
    for (const [k, lift] of shown.entries()) {
      const drop = stagger(s.time, k, 0.9, 0.35, 0.55, backOut);
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, drop));
      ctx.translate(0, (1 - drop) * -180);
      rrect(ctx, x, y, inner, cardH, 28);
      ctx.fillStyle = CARBON;
      ctx.fill();
      ctx.strokeStyle = withAlpha(GOLD, 0.45);
      ctx.lineWidth = 2;
      ctx.stroke();
      const lead = lift.records[0];
      const v = prValue(lead, unit);
      text(s, TL("New record"), x + 36, y + 58, { size: 28, weight: 600, family: "serif", color: GOLD, tracking: 6 });
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
      ctx.restore();
      y += cardH + 24;
    }
    if (shown.length < lifts.length) caps(s, `+${lifts.length - shown.length} more lifts`, x, y + 20);
    else {
      // Room left: the other lifts of the day, as a quieter list.
      const rest = data.exercises.filter((e) => !lifts.some((l) => l.name === e.name) && e.best);
      if (rest.length && y + 160 < SAFE_BOTTOM) {
        y += 40;
        caps(s, tl("Also lifted"), x, y, { color: GOLD });
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
    text(s, tl("No record fell this time. Top sets from the session:"), x, y + 30, { size: 32, color: MUTED, maxWidth: inner });
    y += 80;
    const top = [...data.exercises].filter((e) => e.best).sort((a, b) => (b.best?.volumeKg ?? 0) - (a.best?.volumeKg ?? 0));
    for (const ex of top.slice(0, 4)) {
      hline(ctx, x, W - x, y, STEEL);
      const rw = text(s, bestLabel(s, ex), W - x, y + 66, { size: 40, weight: 700, family: "mono", align: "right" });
      text(s, ex.name, x, y + 66, { size: 38, weight: 600, maxWidth: inner - rw - 30 });
      y += 100;
    }
    if (top.length === 0) text(s, tl("No loaded sets in this workout."), x, y + 40, { size: 32, color: MUTED });
  }

  const best = data.exercises.reduce((m, e) => Math.max(m, ...e.sets.map((st) => st.volumeKg)), 0);
  hline(ctx, x, W - x, H - 190, STEEL);
  caps(s, data.kind === "session" ? "Session max set tonnage" : "Max set tonnage", x, H - 128);
  text(s, formatVolume(best, unit), W - x, H - 122, { size: 44, weight: 800, family: "mono", color: GOLD, align: "right" });
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
  // These draw the handle inside their own layout.
  clean: null,
  headline: null,
  "top-set": null,
  sidebar: null,
  lineup: null,
  // Between the load bars and the stats row.
  "thermal-matrix": { x: W - 84, y: 1652, align: "right", color: VOLT },
  grid: null,
  // Above the tonnage footer.
  "trophy-vault": { x: 80, y: 1690, align: "left", color: GOLD },
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

/* ------------------------------------------------------------------ */
/* Sport premium: Headline, Top Set, Sidebar, Lineup                    */
/* ------------------------------------------------------------------ */

const SOFT = "rgba(244, 244, 245, 0.66)";
const RULE = "rgba(244, 244, 245, 0.22)";

/**
 * The photo as it is, darkened only where text sits: a shade from the top and a deeper one from
 * `from` down (or from the right edge), as strong as the Overlay slider. Without a photo, a deep
 * charcoal lit softly from the top, so the numbers still have a stage.
 */
function cinematic(s: Scene, shade: { bottomFrom?: number; side?: number } = {}) {
  const { ctx, opts } = s;
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, W, H);
  if (opts.photo) {
    ctx.drawImage(opts.photo.layer(opts.grayscale), 0, 0, W, H);
    const a = opts.overlay;
    const top = ctx.createLinearGradient(0, 0, 0, SAFE_TOP + 220);
    top.addColorStop(0, `rgba(0, 0, 0, ${Math.min(0.8, a * 0.9)})`);
    top.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, SAFE_TOP + 220);
    if (shade.bottomFrom !== undefined) {
      const g = ctx.createLinearGradient(0, shade.bottomFrom, 0, H);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(0.45, `rgba(0, 0, 0, ${Math.min(0.92, a + 0.15)})`);
      g.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.96, a + 0.3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, shade.bottomFrom, W, H - shade.bottomFrom);
    }
    if (shade.side !== undefined) {
      const g = ctx.createLinearGradient(shade.side, 0, W, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(0.5, `rgba(0, 0, 0, ${Math.min(0.9, a + 0.15)})`);
      g.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.95, a + 0.3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(shade.side, 0, W - shade.side, H);
    }
  } else {
    const g = ctx.createRadialGradient(W * 0.7, H * 0.18, 0, W * 0.7, H * 0.18, H * 0.9);
    g.addColorStop(0, "rgba(255, 255, 255, 0.09)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Small spaced capitals: the labels over the numbers. */
function label(s: Scene, str: string, x: number, y: number, o: Partial<TextOpts> = {}) {
  return text(s, str.toLocaleUpperCase(currentT().locale), x, y, { size: 24, weight: 600, family: "grotesk", color: SOFT, tracking: 4, ...o });
}

/** Fades a part in while it rises into place; a still draws it where it lands. */
function arrive(s: Scene, start: number, draw: () => void, rise = 22) {
  const q = beat(s.time, start, 0.5, easeOut);
  if (q <= 0) return;
  s.ctx.save();
  s.ctx.globalAlpha *= q;
  s.ctx.translate(0, (1 - q) * rise);
  draw();
  s.ctx.restore();
}

/** The top bar shared by the four: the mark (unless hidden) on the left, the date on the right. */
function premiumHeader(s: Scene, m: number) {
  arrive(s, 0, () => {
    if (!s.opts.hideWatermark) wordmark(s, m, SAFE_TOP - 64, 40, VOLT);
    label(s, dateLabel(s.data), W - m, SAFE_TOP - 50, { align: "right", size: 22, family: "mono", tracking: 2 });
  }, 0);
}

/** The volume as a figure that counts up in the video: "12,450" and its unit. */
function volumeNow(s: Scene, start: number): [string, string, string] {
  const t = currentT();
  const run = beat(s.time, start, 1.1, easeOut);
  const [now, u] = bigVolume(countUp(s.data.volumeKg, run), s.unit, t.locale);
  const [end] = bigVolume(s.data.volumeKg, s.unit, t.locale);
  return [now, u, end];
}

/** The day's top set: a record if one fell, else the heaviest set logged. */
function topSetOf(data: StoryData): { name: string; set: StorySet; record: boolean } | null {
  const records = new Set(data.prs.map((p) => p.exerciseName));
  let best: { name: string; set: StorySet; record: boolean } | null = null;
  for (const ex of data.exercises) {
    if (!ex.best) continue;
    const record = records.has(ex.name);
    const better =
      !best ||
      (record && !best.record) ||
      (record === best.record && (ex.best.weightKg ?? 0) * 1000 + (ex.best.reps ?? 0) > (best.set.weightKg ?? 0) * 1000 + (best.set.reps ?? 0));
    if (better) best = { name: ex.name, set: ex.best, record };
  }
  return best;
}

/**
 * Headline: the photo full screen, a deep shade along the bottom, and the volume as one huge
 * condensed figure with time, sets and records under a hairline.
 */
function headline(s: Scene) {
  const { ctx, data } = s;
  const m = 72;
  const inner = W - 2 * m;
  cinematic(s, { bottomFrom: H * 0.38 });
  premiumHeader(s, m);

  // From the bottom up: the stats row, the hairline, the figure, its label, the title.
  const rowY = SAFE_BOTTOM;
  const records = new Set(data.prs.map((p) => p.exerciseName)).size;
  const cols = [
    [tl("Time"), formatDuration(data.durationSec)],
    [tl("Sets"), String(data.setsDone)],
    [tl("Records"), String(records)],
  ];
  const colW = inner / 3;
  arrive(s, 1.3, () => {
    cols.forEach(([l, v], i) => {
      const x = m + i * colW;
      if (i > 0) {
        ctx.fillStyle = RULE;
        ctx.fillRect(x - 24, rowY - 110, 2, 120);
      }
      label(s, l!, x, rowY - 76);
      text(s, v!.toLocaleUpperCase(currentT().locale), x, rowY, { size: 76, family: "display", tracking: 1 });
    });
  });
  arrive(s, 1.1, () => hline(ctx, m, W - m, rowY - 150, RULE, 2), 0);

  const [now, u, end] = volumeNow(s, 0.35);
  const size = fitSize(s, end, inner - 130, 300, 140, 400, "display");
  const figY = rowY - 190;
  arrive(s, 0.3, () => {
    const w = text(s, now, m - 6, figY, { size, family: "display", tracking: -2 });
    text(s, u.toLocaleUpperCase(currentT().locale), m + Math.max(w, 0) + 18, figY, { size: Math.round(size * 0.26), family: "display", color: VOLT, tracking: 2 });
  });
  const labelY = figY - size * 0.86 - 28;
  arrive(s, 0.2, () => label(s, tl("Total volume"), m, labelY, { color: VOLT }));
  arrive(s, 0.1, () => text(s, data.title, m, labelY - 54, { size: 44, weight: 700, family: "grotesk", maxWidth: inner }));
  const handle = data.handle?.trim();
  if (handle) arrive(s, 1.5, () => text(s, `@${handle}`, W - m, rowY + 64, { size: 26, weight: 700, family: "mono", color: SOFT, align: "right" }));
}

/**
 * Top Set: the best set of the day in big condensed numerals ("100 KG x 8"), tagged as a record
 * when it was one, with the session's totals in one quiet line under it.
 */
function topSet(s: Scene) {
  const { ctx, data, unit } = s;
  const m = 72;
  const inner = W - 2 * m;
  cinematic(s, { bottomFrom: H * 0.32 });
  premiumHeader(s, m);
  arrive(s, 0, () => text(s, data.title, m, SAFE_TOP + 20, { size: 34, weight: 700, family: "grotesk", maxWidth: inner }), 0);

  const best = topSetOf(data);
  const t = currentT();
  const totals = [`${bigVolume(data.volumeKg, unit, t.locale).join(" ")}`, formatDuration(data.durationSec), t.n(data.setsDone, "{n} set", "{n} sets")].join("   ·   ");
  const bottom = SAFE_BOTTOM;
  arrive(s, 1.4, () => {
    hline(ctx, m, W - m, bottom - 66, RULE, 2);
    text(s, totals, m, bottom, { size: 30, weight: 600, family: "grotesk", color: SOFT, maxWidth: inner });
  });
  if (!best) {
    arrive(s, 0.2, () => text(s, tl("No loaded sets in this workout."), m, bottom - 140, { size: 40, weight: 700, family: "grotesk", maxWidth: inner }));
    return;
  }
  const loaded = best.set.weightKg !== null && best.set.weightKg > 0;
  const big = loaded ? formatWeight(best.set.weightKg!, unit, false) : String(best.set.reps ?? 0);
  const small = loaded ? `${unit.toUpperCase()} × ${best.set.reps ?? 0}` : TL("Reps");
  const size = fitSize(s, big, inner * 0.62, 340, 160, 400, "display");
  const figY = bottom - 130;
  const pop = beat(s.time, 0.45, 0.7, backOut);
  arrive(s, 0.4, () => {
    ctx.save();
    ctx.translate(m, figY);
    ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
    const w = text(s, big, -6, 0, { size, family: "display", tracking: -3 });
    text(s, small, w + 22, 0, { size: Math.round(size * 0.3), family: "display", color: VOLT, tracking: 2 });
    ctx.restore();
  });
  const nameY = figY - size * 0.86 - 36;
  arrive(s, 0.25, () => text(s, best.name, m, nameY, { size: 48, weight: 700, family: "grotesk", maxWidth: inner }));
  // The tag: an outlined pill, Volt for a record.
  arrive(s, 0.1, () => {
    const tag = best.record ? TL("New record") : TL("Top set");
    setFont(s, 22, 700, "grotesk");
    setTracking(ctx, 4);
    const tw = ctx.measureText(tag).width + 36;
    setTracking(ctx, 0);
    ctx.save();
    ctx.strokeStyle = best.record ? VOLT : "rgba(244, 244, 245, 0.7)";
    ctx.lineWidth = 2;
    rrect(ctx, m, nameY - 98, tw, 44, 22);
    ctx.stroke();
    ctx.restore();
    text(s, tag, m + 18, nameY - 68, { size: 22, weight: 700, family: "grotesk", color: best.record ? VOLT : TEXT, tracking: 4 });
  });
  const handle = data.handle?.trim();
  if (handle) arrive(s, 1.5, () => text(s, `@${handle}`, W - m, SAFE_TOP + 20, { size: 26, weight: 700, family: "mono", color: SOFT, align: "right" }));
}

/**
 * Sidebar: the photo keeps the left of the frame; the right fades to black and stacks the
 * numbers, right-aligned, each under its small label and a hairline.
 */
function sidebar(s: Scene) {
  const { ctx, data, unit } = s;
  const m = 72;
  const right = W - m;
  cinematic(s, { side: W * 0.28 });
  premiumHeader(s, m);
  const best = topSetOf(data);
  const [now, u, end] = volumeNow(s, 0.4);
  const rows: { l: string; v: string; u?: string; end?: string }[] = [
    { l: tl("Total volume"), v: now, u: u.toUpperCase(), end },
    { l: tl("Time"), v: formatDuration(data.durationSec).toUpperCase() },
    { l: tl("Sets"), v: String(data.setsDone) },
  ];
  if (best && best.set.weightKg) rows.push({ l: tl("Top set"), v: formatWeight(best.set.weightKg, unit, false), u: `${unit.toUpperCase()} × ${best.set.reps ?? 0}` });
  const rowH = 210;
  const blockH = 70 + rows.length * rowH;
  let y = Math.round((H - blockH) / 2) + 40;
  arrive(s, 0.1, () => text(s, data.title, right, y, { size: 40, weight: 700, family: "grotesk", align: "right", maxWidth: W * 0.62 }));
  y += 70;
  rows.forEach((r, i) => {
    const at = y;
    arrive(s, 0.3 + i * 0.18, () => {
      hline(ctx, W * 0.44, right, at, RULE, 2);
      label(s, r.l, right, at + 48, { align: "right" });
      const size = fitSize(s, r.end ?? r.v, W * 0.5, 132, 80, 400, "display");
      let x = right;
      if (r.u) x -= text(s, r.u, right, at + 48 + 140, { size: 40, family: "display", color: VOLT, align: "right", tracking: 2 }) + 16;
      text(s, r.v, x, at + 48 + 140, { size, family: "display", align: "right", tracking: -1 });
    });
    y += rowH;
  });
  const handle = data.handle?.trim();
  if (handle) arrive(s, 1.4, () => text(s, `@${handle}`, right, y + 30, { size: 26, weight: 700, family: "mono", color: SOFT, align: "right" }));
}

/**
 * Lineup: the photo above, and under it the session as a team sheet: title, volume, time and
 * sets, then each lift with its best set, ruled like a programme.
 */
function lineup(s: Scene) {
  const { ctx, data } = s;
  const m = 72;
  const inner = W - 2 * m;
  cinematic(s, { bottomFrom: H * 0.3 });
  premiumHeader(s, m);
  const lifts = data.exercises.slice(0, 5);
  const listH = lifts.length * 70;
  let y = SAFE_BOTTOM - listH - 300;
  arrive(s, 0.1, () => text(s, data.title, m, y, { size: 56, weight: 700, family: "grotesk", maxWidth: inner }));
  y += 110;
  const [now, u, end] = volumeNow(s, 0.35);
  const size = fitSize(s, end, inner * 0.5, 120, 80, 400, "display");
  // The figure's baseline sits a cap height under its label, so the two never touch.
  const figY = y + 20 + Math.round(size * 0.86);
  arrive(s, 0.3, () => {
    label(s, tl("Total volume"), m, y, { color: VOLT });
    const w = text(s, now, m - 4, figY, { size, family: "display", tracking: -1 });
    text(s, u.toUpperCase(), m + w + 12, figY, { size: 40, family: "display", color: VOLT, tracking: 2 });
  });
  const side = [
    [tl("Time"), formatDuration(data.durationSec).toUpperCase()],
    [tl("Sets"), String(data.setsDone)],
  ];
  side.forEach(([l, v], i) => {
    const x = m + inner * 0.56 + i * inner * 0.24;
    arrive(s, 0.45 + i * 0.1, () => {
      label(s, l!, x, y);
      text(s, v!, x, figY, { size: 72, family: "display", tracking: 1 });
    });
  });
  y = figY + 56;
  lifts.forEach((ex, i) => {
    const at = y + i * 70;
    arrive(s, 0.8 + i * 0.12, () => {
      hline(ctx, m, W - m, at, RULE, 2);
      const right = ex.best ? bestLabel(s, ex) : "";
      const rw = text(s, right, W - m, at + 48, { size: 28, weight: 600, family: "mono", color: SOFT, align: "right" });
      text(s, ex.name, m, at + 48, { size: 32, weight: 600, family: "grotesk", maxWidth: inner - rw - 30 });
    });
  });
  if (data.exercises.length > lifts.length)
    arrive(s, 1.5, () => label(s, `+${data.exercises.length - lifts.length}`, m, y + lifts.length * 70 + 44, { size: 22 }));
  const handle = data.handle?.trim();
  if (handle) arrive(s, 1.6, () => text(s, `@${handle}`, W - m, SAFE_TOP + 20, { size: 26, weight: 700, family: "mono", color: SOFT, align: "right" }));
}

/**
 * Grid: the photo open above, and under it four numbers in a two-by-two grid ruled with
 * hairlines: volume, time, sets and the top set, each under its small label.
 */
function grid(s: Scene) {
  const { ctx, data, unit } = s;
  const m = 72;
  const inner = W - 2 * m;
  cinematic(s, { bottomFrom: H * 0.36 });
  premiumHeader(s, m);
  const best = topSetOf(data);
  const [now, u, end] = volumeNow(s, 0.4);
  const cells: { l: string; v: string; u?: string; end?: string }[] = [
    { l: tl("Total volume"), v: now, u: u.toUpperCase(), end },
    { l: tl("Time"), v: formatDuration(data.durationSec).toUpperCase() },
    { l: tl("Sets"), v: String(data.setsDone) },
    best && best.set.weightKg
      ? { l: tl("Top set"), v: formatWeight(best.set.weightKg, unit, false), u: `${unit.toUpperCase()} × ${best.set.reps ?? 0}` }
      : { l: tl("Records"), v: String(new Set(data.prs.map((p) => p.exerciseName)).size) },
  ];
  const cellW = inner / 2;
  const cellH = 220;
  const top = SAFE_BOTTOM - 2 * cellH;
  arrive(s, 0.1, () => text(s, data.title, m, top - 56, { size: 52, weight: 700, family: "grotesk", maxWidth: inner }));
  arrive(s, 0.25, () => {
    hline(ctx, m, W - m, top, RULE, 2);
    hline(ctx, m, W - m, top + cellH, RULE, 2);
    hline(ctx, m, W - m, top + 2 * cellH, RULE, 2);
    ctx.fillStyle = RULE;
    ctx.fillRect(m + cellW, top + 28, 2, 2 * cellH - 56);
  }, 0);
  cells.forEach((c, i) => {
    const x = m + (i % 2) * cellW + (i % 2 ? 40 : 0);
    const y = top + Math.floor(i / 2) * cellH;
    const room = cellW - 40 - (c.u ? 0 : 0);
    arrive(s, 0.35 + i * 0.15, () => {
      label(s, c.l, x, y + 58, { color: i === 0 ? VOLT : SOFT });
      const unitW = c.u ? (setFont(s, 34, 400, "display"), ctx.measureText(c.u).width + 12) : 0;
      const size = fitSize(s, c.end ?? c.v, room - unitW, 120, 64, 400, "display");
      const w = text(s, c.v, x - 3, y + 58 + 22 + Math.round(size * 0.86), { size, family: "display", tracking: -1 });
      if (c.u) text(s, c.u, x + w + 10, y + 58 + 22 + Math.round(size * 0.86), { size: 34, family: "display", color: VOLT, tracking: 2 });
    });
  });
  const handle = data.handle?.trim();
  if (handle) arrive(s, 1.4, () => text(s, `@${handle}`, W - m, SAFE_BOTTOM + 60, { size: 26, weight: 700, family: "mono", color: SOFT, align: "right" }));
}

/* ------------------------------------------------------------------ */
/* Clean                                                               */
/* ------------------------------------------------------------------ */

const CLEAN_MARGIN = 72;
const CLEAN_MAP_W = 440;
const CLEAN_MAP_H = Math.round((CLEAN_MAP_W * 1360) / 1448);
const CLEAN_OBJECT = 210;
const CLEAN_RADAR_W = 680;
const CLEAN_RADAR_H = 500;
const RADAR_R = 190;

/**
 * How far out an axis reaches: the square root of its share, so a workout that is mostly pull
 * still draws a shape and not a line, and the order of the axes stays the same.
 */
function radarReach(share: number): number {
  return 0.1 + 0.9 * Math.sqrt(share);
}

/**
 * The radar in a CLEAN_RADAR_W x CLEAN_RADAR_H box at (x, y): a steel web, the lifter's shape in
 * Volt grown to `grow` (0 to 1), and the axis labels, the dominant one in Volt.
 */
function drawRadar(s: Scene, x: number, y: number, share: Record<Axis, number>, dominant: Axis | null, grow: number, labels: number) {
  const { ctx } = s;
  const cx = x + CLEAN_RADAR_W / 2;
  const cy = y + CLEAN_RADAR_H / 2;
  const at = (i: number, r: number) => {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  const ring = (r: number) => {
    ctx.beginPath();
    AXES.forEach((_, i) => {
      const [px, py] = at(i, r);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };
  ctx.save();
  ctx.strokeStyle = "rgba(244, 244, 245, 0.22)";
  ctx.lineWidth = 2;
  for (const f of [1 / 3, 2 / 3, 1]) {
    ring(RADAR_R * f);
    ctx.stroke();
  }
  AXES.forEach((_, i) => {
    const [px, py] = at(i, RADAR_R);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();
  });
  // The lifter's shape.
  if (grow > 0) {
    ctx.beginPath();
    AXES.forEach((a, i) => {
      const [px, py] = at(i, radarReach(share[a]) * RADAR_R * grow);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = withAlpha(VOLT, 0.22);
    ctx.fill();
    ctx.strokeStyle = VOLT;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.stroke();
    AXES.forEach((a, i) => {
      const [px, py] = at(i, radarReach(share[a]) * RADAR_R * grow);
      ctx.beginPath();
      ctx.arc(px, py, a === dominant ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = VOLT;
      ctx.fill();
    });
  }
  ctx.restore();
  // Labels just outside the web, aligned away from the centre.
  if (labels > 0) {
    ctx.save();
    ctx.globalAlpha = labels;
    AXES.forEach((a, i) => {
      const [px, py] = at(i, RADAR_R + 26);
      const dx = px - cx;
      const align: CanvasTextAlign = Math.abs(dx) < 4 ? "center" : dx > 0 ? "left" : "right";
      const baseline: CanvasTextBaseline = i === 0 ? "bottom" : i === 3 ? "top" : "middle";
      const on = a === dominant;
      text(s, tl(RADAR_LABEL[a]), px, py, { size: 26, weight: on ? 700 : 500, family: "grotesk", color: on ? VOLT : "rgba(244, 244, 245, 0.75)", align, baseline });
    });
    ctx.restore();
  }
}

const shapeCache = new Map<string, { path: Path2D; layer: ObjectLayer }[]>();
const TONE: Record<Exclude<ObjectTone, "main">, string> = {
  shade: "rgba(0, 0, 0, 0.3)",
  deep: "rgba(0, 0, 0, 0.6)",
  light: "rgba(255, 255, 255, 0.92)",
};

/** A thing to lift, `size` square, from its drawing in story-objects (a 48-unit grid). */
function drawLiftObject(ctx: Ctx, id: string, x: number, y: number, size: number, color: string) {
  let parts = shapeCache.get(id);
  if (!parts) {
    parts = (LIFT_SHAPES[id] ?? []).map((layer) => ({ path: new Path2D(layer.d), layer }));
    shapeCache.set(id, parts);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 48, size / 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const { path, layer } of parts) {
    const paint = layer.tone === "main" ? color : TONE[layer.tone];
    if (layer.stroke) {
      ctx.strokeStyle = paint;
      ctx.lineWidth = layer.stroke;
      ctx.stroke(path);
    } else {
      ctx.fillStyle = paint;
      ctx.fill(path);
    }
  }
  ctx.restore();
}

/**
 * Where Clean's text block of height `h` goes: its anchor x, its top, and how its lines align.
 * The rows stay inside the safe area, so top sits under Instagram's top bar (and under the
 * founder badge, which ends above SAFE_TOP) and bottom above the reply box.
 */
export function cleanBlockOrigin(position: TextPosition, h: number): { x: number; top: number; align: CanvasTextAlign } {
  const row = position.startsWith("top") ? "top" : position.startsWith("bottom") ? "bottom" : "middle";
  const col = position.endsWith("left") ? "left" : position.endsWith("right") ? "right" : "center";
  const x = col === "left" ? CLEAN_MARGIN : col === "right" ? W - CLEAN_MARGIN : W / 2;
  const top = row === "top" ? SAFE_TOP : row === "bottom" ? SAFE_BOTTOM - h : Math.round((H - h) / 2);
  return { x, top, align: col };
}

/**
 * The photo itself, and a few quiet lines wherever the lifter puts them: the date, the workout's
 * name, and volume, time and sets on one line. The photo gets no flat tint: a soft shade sits
 * only on the side of the text, as strong as the Overlay slider says.
 */
function clean(s: Scene) {
  const { ctx, data, unit, opts } = s;
  const position = opts.textPosition ?? "bottom-left";
  ctx.fillStyle = OBSIDIAN;
  ctx.fillRect(0, 0, W, H);
  if (opts.photo) ctx.drawImage(opts.photo.layer(opts.grayscale), 0, 0, W, H);

  const inner = W - 2 * CLEAN_MARGIN;
  const t = currentT();
  const extra = opts.cleanExtra ?? "none";
  const compare = extra === "compare" ? liftComparison(data.volumeKg) : null;
  // The lifter's sizes, shrunk together if the block would not fit between the safe lines.
  let kText = clampSize(opts.textScale);
  let kExtra = extra === "none" ? 1 : clampSize(opts.extraScale);
  const handle = data.handle?.trim();
  const showMark = !opts.hideWatermark;
  // Above the text, in its own units: the muscle map, or the thing lifted with its two lines.
  const radar = extra === "radar" ? radarAxes(data) : null;
  const extraH = extra === "muscles" ? CLEAN_MAP_H + 36 : radar ? CLEAN_RADAR_H + 18 + 44 + 36 : compare ? CLEAN_OBJECT + 18 + 52 + 12 + 32 + 40 : 0;
  // The workout's name and date small; volume, time and sets are the story.
  const textH = () => 34 + 32 + 56 + 128 + 56 + 72 + (handle ? 16 + 30 : 0) + (showMark ? 34 + 40 : 0);
  const room = SAFE_BOTTOM - SAFE_TOP;
  const tall = extraH * kExtra + textH() * kText;
  if (tall > room) {
    kText *= room / tall;
    kExtra *= room / tall;
  }
  const h = extraH * kExtra + textH() * kText;
  const { x, top, align } = cleanBlockOrigin(position, h);
  // Inside the block, x = 0 is the anchor: lines align to it, pictures sit beside it.
  const leftOf = (w: number) => (align === "left" ? 0 : align === "right" ? -w : -w / 2);

  // The shade behind the text (with a photo) or a faint Volt glow (without one).
  const cx = align === "left" ? x + inner * 0.35 : align === "right" ? x - inner * 0.35 : x;
  const cy = top + h / 2;
  if (opts.photo) {
    const a = opts.overlay;
    let g: CanvasGradient;
    if (top <= SAFE_TOP) {
      g = ctx.createLinearGradient(0, 0, 0, top + h + 260);
      g.addColorStop(0, `rgba(0, 0, 0, ${a})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else if (top + h >= SAFE_BOTTOM) {
      g = ctx.createLinearGradient(0, top - 260, 0, H);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, `rgba(0, 0, 0, ${a})`);
    } else {
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 640);
      g.addColorStop(0, `rgba(0, 0, 0, ${a * 0.85})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 720);
    g.addColorStop(0, withAlpha(VOLT, 0.1));
    g.addColorStop(1, withAlpha(VOLT, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // In the video things arrive one after another; every beat has landed by STILL_TIME, so the
  // picture is the last frame before the closing card.
  const time = s.time;
  /** Fades a line in while it rises 18 units into place. */
  const enter = (start: number, draw: () => void) => {
    const q = beat(time, start, 0.45, easeOut);
    if (q <= 0) return;
    ctx.save();
    ctx.globalAlpha = q;
    ctx.translate(0, (1 - q) * 18);
    draw();
    ctx.restore();
  };
  ctx.save();
  ctx.translate(x, top);

  if (extraH > 0) {
    ctx.save();
    ctx.scale(kExtra, kExtra);
    const width = inner / kExtra;
    if (extra === "muscles") {
      // The figure fades in grey, then each worked muscle lights up, the most worked first.
      const { heat } = regionHeat(data);
      const order = Object.entries(heat).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
      const lit: typeof heat = {};
      order.forEach(([r, v], i) => {
        const q = stagger(time, i, 0.45, 0.09, 0.5);
        if (q > 0.02) lit[r as Region] = (v ?? 0) * q;
      });
      ctx.globalAlpha = beat(time, 0, 0.4);
      drawBody(ctx, leftOf(CLEAN_MAP_W), 0, CLEAN_MAP_W, lit);
    } else if (radar) {
      // The web fades in, the shape grows out of the centre, then the labels and the verdict.
      ctx.save();
      ctx.globalAlpha = beat(time, 0, 0.4);
      drawRadar(s, leftOf(CLEAN_RADAR_W), 0, radar.share, radar.dominant, beat(time, 0.4, 1, backOut), beat(time, 1.1, 0.4));
      ctx.restore();
      const verdict = radar.dominant ? t("Most worked: {axis}", { axis: t(RADAR_LABEL[radar.dominant]) }) : t("No muscle sets logged");
      enter(1.5, () =>
        text(s, verdict, 0, CLEAN_RADAR_H + 18 + 44, { size: 44, weight: 800, color: radar.dominant ? VOLT : "rgba(244, 244, 245, 0.75)", align, maxWidth: width, tracking: -0.5 }),
      );
    } else if (compare) {
      // The thing lands with a little bounce, then floats gently until the still.
      const pop = beat(time, 0.05, 0.6, backOut);
      const float = time > 2.4 && time < 5.8 ? Math.sin(((time - 2.4) / 3.4) * Math.PI * 2) * Math.sin(((time - 2.4) / 3.4) * Math.PI) * 6 : 0;
      const cxObj = leftOf(CLEAN_OBJECT) + CLEAN_OBJECT / 2;
      ctx.save();
      ctx.globalAlpha = clamp01(pop * 1.5);
      ctx.translate(cxObj, CLEAN_OBJECT / 2 + float);
      ctx.scale(0.55 + 0.45 * pop, 0.55 + 0.45 * pop);
      ctx.translate(-cxObj, -CLEAN_OBJECT / 2);
      drawLiftObject(ctx, compare.object.id, leftOf(CLEAN_OBJECT), 0, CLEAN_OBJECT, VOLT);
      ctx.restore();
      // The count runs up to the figure, then gives a small punch.
      let y = CLEAN_OBJECT + 18 + 52;
      const run = beat(time, 0.45, 1.1, easeOut);
      const shown = countUp(compare.count, run, compare.count < 10 ? 1 : 0);
      const n = shown.toLocaleString(t.locale, { maximumFractionDigits: 1, minimumFractionDigits: compare.count < 10 && run < 1 ? 1 : 0 });
      const punch = 1 + 0.08 * Math.sin(Math.PI * beat(time, 1.55, 0.35, linear));
      if (run > 0) {
        ctx.save();
        ctx.globalAlpha = clamp01(run * 3);
        ctx.translate(0, y);
        ctx.scale(punch, punch);
        // The plural follows the final figure, so the word does not flicker while counting.
        text(s, t.n(compare.count, compare.object.one, compare.object.other, { n }), 0, 0, { size: 56, weight: 800, color: VOLT, align, maxWidth: width, tracking: -1 });
        ctx.restore();
      }
      y += 12 + 32;
      enter(1.7, () => text(s, t(compare.object.quip), 0, y, { size: 32, weight: 600, family: "grotesk", color: "rgba(244, 244, 245, 0.9)", align, maxWidth: width }));
    }
    ctx.restore();
  }

  ctx.translate(0, extraH * kExtra);
  ctx.scale(kText, kText);
  const width = inner / kText;
  // The text follows the picture: name and date, then the figures, each counting into place.
  const from = extra === "none" ? 0.15 : extra === "muscles" ? 1.5 : extra === "radar" ? 2 : 2.05;
  const soft = "rgba(244, 244, 245, 0.62)";
  /** Where a group `w` wide starts so it sits on the block's alignment. */
  const startOf = (w: number) => (align === "left" ? 0 : align === "right" ? -w : -w / 2);
  const measure = (str: string, size: number, weight: number, family: Family = "sans") => {
    setFont(s, size, weight, family);
    return ctx.measureText(str).width;
  };
  let y = 34;
  enter(from, () => text(s, data.title, 0, 34, { size: 34, weight: 700, align, maxWidth: width }));
  y += 32;
  const dateY = y;
  enter(from + 0.06, () => text(s, dateLabel(data), 0, dateY, { size: 22, weight: 500, family: "mono", color: soft, align, tracking: 1 }));

  // Volume, the hero: its label, then the figure counting up with the unit beside it.
  y += 56;
  const volLabelY = y;
  enter(from + 0.14, () => text(s, TL("Total volume"), 0, volLabelY, { size: 22, weight: 600, family: "mono", color: VOLT, align, tracking: 3 }));
  y += 128;
  const volY = y;
  const run = beat(time, from + 0.2, 0.9, easeOut);
  const [volNow, volUnit] = bigVolume(countUp(data.volumeKg, run), unit, t.locale);
  const [volEnd] = bigVolume(data.volumeKg, unit, t.locale);
  // Sized on the final figure, so the number does not grow while it counts.
  let volSize = 136;
  while (volSize > 72 && measure(volEnd, volSize, 800) + 14 + measure(volUnit, volSize * 0.36, 700) > width) volSize -= 4;
  const unitSize = Math.round(volSize * 0.36);
  const volW = measure(volEnd, volSize, 800) + 14 + measure(volUnit, unitSize, 700);
  enter(from + 0.2, () => {
    const x0 = startOf(volW);
    const w = text(s, volNow, x0, volY, { size: volSize, weight: 800, tracking: -volSize * 0.03 });
    text(s, volUnit, x0 + Math.max(w, measure(volEnd, volSize, 800) - 2) + 14, volY, { size: unitSize, weight: 700, color: soft });
  });

  // Time and sets side by side, each with its label.
  y += 56;
  const rowLabelY = y;
  y += 72;
  const rowY = y;
  const cols = [
    { label: TL("Time"), value: formatDuration(data.durationSec) },
    { label: TL("Sets"), value: String(data.setsDone) },
  ].map((c) => ({ ...c, w: Math.max(measure(c.value, 68, 800), measure(c.label, 22, 600, "mono") + 3 * c.label.length) }));
  const gap = 72;
  const rowW = cols[0]!.w + gap + cols[1]!.w;
  enter(from + 0.4, () => {
    let cx0 = startOf(rowW);
    for (const c of cols) {
      text(s, c.label, cx0, rowLabelY, { size: 22, weight: 600, family: "mono", color: soft, tracking: 3 });
      text(s, c.value, cx0, rowY, { size: 68, weight: 800, tracking: -1.5 });
      cx0 += c.w + gap;
    }
  });
  if (handle) {
    y += 16 + 30;
    const at = y;
    enter(from + 0.5, () => text(s, `@${handle}`, 0, at, { size: 30, weight: 700, family: "mono", color: VOLT, align, maxWidth: width }));
  }
  if (showMark) {
    y += 34 + 20;
    const at = y;
    const size = 40;
    setFont(s, size * 0.82, 800, "sans");
    const w = size * 1.28 + ctx.measureText("ABOT").width;
    enter(from + 0.6, () => wordmark(s, leftOf(w), at, size, VOLT));
  }
  ctx.restore();
}

const PAINTERS: Record<StoryPresetId, (s: Scene) => void> = {
  clean,
  headline,
  "top-set": topSet,
  sidebar,
  lineup,
  grid,
  "thermal-matrix": thermalMatrix,
  "trophy-vault": trophyVault,
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

export function renderStory(ctx: Ctx, data: StoryData, opts: StoryOptions, fonts: StoryFonts, time = STILL_TIME): void {
  const scene: Scene = { ctx, fonts, time, data, unit: data.unit, opts, onPhoto: opts.photo !== null };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  PAINTERS[opts.preset](scene);
  drawHandle(scene);
  drawFounderBadge(scene);
  endCard(scene);
  ctx.restore();
}


/** The closing card on any canvas (the streak video uses it too). */
export function closingCard(ctx: Ctx, fonts: StoryFonts, time: number, handle: string | null, hideWatermark: boolean) {
  const data = { handle } as StoryData;
  endCard({ ctx, fonts, time, data, unit: "kg", opts: { preset: "clean", photo: null, overlay: 0, grayscale: false, hideWatermark }, onPhoto: false });
}

/** The closing seconds of a video: the ABOT mark and the @handle over the card. Skipped without the watermark. */
function endCard(s: Scene) {
  if (s.time < END_CARD_AT || s.opts.hideWatermark) return;
  const p = beat(s.time, END_CARD_AT, 0.45, easeOut);
  const { ctx } = s;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.fillStyle = "rgba(9, 9, 11, 0.92)";
  ctx.fillRect(0, 0, W, H);
  const size = 220 * (0.85 + 0.15 * p);
  mark(ctx, W / 2 - size / 2, H / 2 - size, size, VOLT);
  s.onPhoto = false;
  text(s, "ABOT", W / 2, H / 2 + 120, { size: 120, family: "display", align: "center", tracking: 6 });
  text(s, tl("Logged with ABOT"), W / 2, H / 2 + 200, { size: 40, weight: 500, family: "grotesk", color: MUTED, align: "center" });
  const handle = s.data.handle?.trim();
  if (handle) text(s, `@${handle}`, W / 2, H / 2 + 270, { size: 40, weight: 700, family: "grotesk", color: VOLT, align: "center" });
  ctx.restore();
}
