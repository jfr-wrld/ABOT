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
import { END_CARD_AT, STILL_TIME, STORY_SECONDS, backOut, beat, clamp01, countUp, easeInOut, easeOut, linear, stagger, typed, type Ease } from "@/lib/story-motion";

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
  "Logged with ABOT", "{n} set", "Most worked: {axis}", "Push", "Pull", "Quads", "Hamstrings", "Arms", "Core",
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

export type StoryPresetId =
  | "clean"
  | "matchday"
  | "thermal-matrix"
  | "brutalist-receipt"
  | "editorial"
  | "arcade"
  | "loaded-bar"
  | "trophy-vault"
  | "volt-poster";

/**
 * The layouts, each its own look: typeface, palette, texture and the way it moves. Clean is always
 * free; of the rest, the first `tunables().story.freePresets` (2) are, so the order sets what is PRO.
 */
export const STORY_PRESETS: { id: StoryPresetId; name: string; blurb: string }[] = [
  { id: "clean", name: "Clean", blurb: "Your photo first, a few quiet lines" },
  { id: "matchday", name: "Matchday", blurb: "Full-time scoreboard: your volume is the score" },
  { id: "thermal-matrix", name: "Thermal Matrix", blurb: "Muscle map lit by sets worked" },
  { id: "brutalist-receipt", name: "Brutalist Receipt", blurb: "Every set itemised like a till slip" },
  { id: "editorial", name: "Editorial", blurb: "A magazine cover, your top lift the story" },
  { id: "arcade", name: "Arcade", blurb: "Level cleared: score, XP and a star per record" },
  { id: "loaded-bar", name: "Loaded Bar", blurb: "Each lift a plate on the bar, sized by its volume" },
  { id: "trophy-vault", name: "Trophy Vault", blurb: "Records first, engraved in gold" },
  { id: "volt-poster", name: "Volt Poster", blurb: "Swiss poster in black on Volt" },
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

/** Brutalist Receipt: a till slip on light carbon, every set itemised, stamped at the bottom. */
function brutalistReceipt(s: Scene) {
  const { ctx, data, unit } = s;
  s.onPhoto = false;
  paintBackground(s, "#d4d4d8");
  // In the video the slip prints up from the bottom of the screen, then the stamp lands.
  const printed = beat(s.time, 0.1, 2.4, easeOut);
  ctx.save();
  ctx.translate(0, (1 - printed) * (H - 200));

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
  if (s.opts.hideWatermark) text(s, TL("Lift log"), W / 2, y, { size: 84, weight: 800, color: INK, align: "center", tracking: -2 });
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
  text(s, TL("Strength receipt"), W / 2, y, { ...ink, size: 34, align: "center", tracking: 6 });
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
    text(s, TL(remaining === 1 ? "... +{n} more set" : "... +{n} more sets", { n: remaining }), x + 20, y, { ...ink, size: 38, color: INK_MUTED });
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
  row(TL("Sets"), String(data.setsDone));
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
  const stamped = beat(s.time, 2.9, 0.4, backOut);
  ctx.scale(1 + (1 - stamped) * 0.9, 1 + (1 - stamped) * 0.9);
  ctx.globalAlpha = 0.9 * beat(s.time, 2.9, 0.15, linear);
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
  text(s, broke ? TL(data.prs.length === 1 ? "{n} new record" : "{n} new records", { n: data.prs.length }) : TL("{n} sets on file", { n: data.setsDone }), 0, 38, {
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
  text(s, TL("Keep this slip."), r, by + 36, { ...ink, size: 24, align: "right" });
  text(s, TL("Next time, beat it."), r, by + 72, { ...ink, size: 24, align: "right" });
  ctx.restore();
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
/* Loaded Bar                                                          */
/* ------------------------------------------------------------------ */

/** Names of lifts that set a record in this story, to colour their plates gold. */
function recordLifts(data: StoryData): Set<string> {
  return new Set(data.prs.map((p) => p.exerciseName));
}

/**
 * Loaded Bar: the workout as a loaded barbell seen from the side. Each lift is a plate, heaviest
 * volume nearest the collar, its height set by its share of the volume, mirrored on both sleeves;
 * lifts that set a record are gold, as records are across the app. A legend names the plates;
 * totals sit below.
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
      // In the video the plates slide onto the bar, heaviest first, both sides together.
      const on = stagger(s.time, i, 0.7, 0.35, 0.55, backOut);
      ctx.save();
      ctx.translate(side * (1 - on) * 520, 0);
      ctx.globalAlpha = Math.min(1, Math.max(0, on));
      const left = side === 1 ? x : x - w;
      ctx.fillStyle = shade(i);
      rrect(ctx, left, cy - h / 2, w, h, 10);
      ctx.fill();
      // The plate's rim, so neighbours read apart.
      ctx.strokeStyle = OBSIDIAN;
      ctx.lineWidth = 4;
      ctx.stroke();
      // A record-setting lift wears a gold cap.
      if (records.has(p.name)) {
        ctx.fillStyle = GOLD;
        rrect(ctx, left + 4, cy - h / 2 + 4, w - 8, 18, 6);
        ctx.fill();
      }
      ctx.restore();
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
      ctx.fillStyle = GOLD;
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
  caps(s, tl("Total volume"), m, by - 92);
  const vw = text(s, vol, m, by, { size: 96, weight: 800, family: "grotesk", tracking: -2 });
  text(s, u, m + vw + 10, by, { size: 40, weight: 700, family: "grotesk", color: MUTED });
  caps(s, tl("Time"), W - m - 300, by - 92);
  text(s, formatDuration(data.durationSec), W - m - 300, by, { size: 56, weight: 800, family: "grotesk" });
  caps(s, tl("Sets"), W - m, by - 92, { align: "right" });
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
  const slideIn = beat(s.time, 0.2, 0.9, easeOut);
  ctx.save();
  ctx.translate((1 - slideIn) * -W, 0);
  ink(vol, m - 8, SAFE_TOP + 40 + vs * 0.86, { size: vs, family: "display", tracking: -4 });
  ctx.restore();
  // The figure's comma and digits hang below the baseline; leave them room.
  let y = SAFE_TOP + 40 + vs * 0.86 + 110;
  ink(`${u.toUpperCase()} LIFTED`, m, y, { size: 64, family: "display", tracking: 2 });
  y += 46;
  hline(ctx, m, W - m, y, INK, 8);

  // Full-width lines.
  const rows: [string, string][] = [
    [String(data.setsDone), TL("Sets")],
    [formatDuration(data.durationSec).toUpperCase(), TL("Time")],
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
    [TL("Time"), formatDuration(data.durationSec).toUpperCase()],
    [TL("Sets"), String(data.setsDone)],
    [recordLifts(data).size === 1 ? "GOAL" : "GOALS", String(recordLifts(data).size)],
  ];
  // Time reads longest ("45M 00S"), so it gets the widest column.
  const share = [0.46, 0.24, 0.3];
  stats.forEach(([label, value], i) => {
    const pi = stagger(time, i, 2.0, 0.15, 0.4, backOut);
    ctx.save();
    ctx.globalAlpha = Math.min(1, pi);
    const colW = inner * share[i]!;
    const cx = m + inner * share.slice(0, i).reduce((a, b) => a + b, 0);
    ctx.translate(0, (1 - pi) * 40);
    const size = fitSize(s, value, colW - 24, 96, 48, 400, "display");
    text(s, value, cx, 1080, { size, family: "display", color: i === 2 && recordLifts(data).size ? VOLT : TEXT });
    text(s, label, cx, 1126, { size: 28, weight: 700, family: "grotesk", color: MUTED, tracking: 4 });
    ctx.restore();
  });
  hline(ctx, m, W - m, 1176, STEEL, 3);

  // The line-up: numbered like shirts, each record marked as a goal.
  text(s, TL("Line-up"), m, 1236, { size: 34, family: "display", color: VOLT, tracking: 4 });
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
    text(s, TL("Strength edition"), W - m, SAFE_TOP + ms * 0.72 + 56, { size: 26, weight: 600, family: "serif", color: accent, align: "right", tracking: 3 });
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
    text(s, TL("The cover story"), m, y, { size: 26, weight: 600, family: "serif", color: accent, tracking: 4 });
    const lines = wrap(s, top ? top.name : data.title, inner, 104, 600, 2, "serif");
    lines.forEach((l, i) => text(s, l, m, y + 100 + i * 104, { size: 104, weight: 600, family: "serif", color: fg, tracking: -2 }));
    if (top) text(s, `${bestLabel(s, top)}, set by set.`, m, y + 100 + lines.length * 104, { size: 40, weight: 400, family: "serif", color: sub, maxWidth: inner });
  });

  // Teasers down the side: the numbers, then each record.
  y = 1440;
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const teasers: [string, string][] = [
    [`${vol} ${u}`, "moved, in all"],
    [formatDuration(data.durationSec), tl("{n} sets", { n: data.setsDone })],
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
    [TL("Time"), formatDuration(data.durationSec).toUpperCase()],
    [TL("Sets"), String(data.setsDone)],
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
  const blink = time >= STILL_TIME || Math.floor(time * 2) % 2 === 0;
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
  // Inside its own text block.
  clean: null,
  // Under the date line, beside the score band.
  matchday: { x: W - 72, y: 1236, align: "right", color: MUTED },
  // Between the load bars and the stats row.
  "thermal-matrix": { x: W - 84, y: 1652, align: "right", color: VOLT },
  // A MEMBER line in the receipt header.
  "brutalist-receipt": null,
  // The cover credit, under the teasers.
  editorial: { x: 64, y: 1700, align: "left", color: "#a8a29e" },
  // The player, centred under the stage name.
  arcade: { x: W / 2, y: SAFE_TOP + 268, align: "center", color: "#ff3ea5" },
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
  const textH = (lines: number) => 28 + 24 + 72 + (lines - 1) * 80 + 18 + 34 + (handle ? 16 + 30 : 0) + (showMark ? 34 + 40 : 0);
  let title = wrap(s, data.title, inner / kText, 72, 800, 2);
  const room = SAFE_BOTTOM - SAFE_TOP;
  const tall = extraH * kExtra + textH(title.length) * kText;
  if (tall > room) {
    kText *= room / tall;
    kExtra *= room / tall;
    title = wrap(s, data.title, inner / kText, 72, 800, 2);
  }
  const h = extraH * kExtra + textH(title.length) * kText;
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
  // The text follows the picture, line by line.
  const from = extra === "none" ? 0.15 : extra === "muscles" ? 1.5 : extra === "radar" ? 2 : 2.05;
  let y = 28;
  enter(from, () => text(s, dateLabel(data), 0, 28, { size: 28, weight: 500, family: "mono", color: "rgba(244, 244, 245, 0.78)", align, tracking: 1 }));
  y += 24 + 72;
  for (const line of title) {
    const at = y;
    enter(from + 0.12, () => text(s, line, 0, at, { size: 72, weight: 800, align, tracking: -1.5 }));
    y += 80;
  }
  y += 18 + 34 - 80;
  // Volume counts up with the stats line.
  const volRun = beat(time, from + 0.24, 0.9, easeOut);
  const statsNow = [formatVolume(countUp(data.volumeKg, volRun), unit), formatDuration(data.durationSec), t.n(data.setsDone, "{n} set", "{n} sets")].join(" · ");
  const statsY = y;
  enter(from + 0.24, () => text(s, statsNow, 0, statsY, { size: 34, weight: 600, family: "grotesk", color: "rgba(244, 244, 245, 0.92)", align, maxWidth: width }));
  if (handle) {
    y += 16 + 30;
    const at = y;
    enter(from + 0.36, () => text(s, `@${handle}`, 0, at, { size: 30, weight: 700, family: "mono", color: VOLT, align, maxWidth: width }));
  }
  if (showMark) {
    y += 34 + 20;
    const at = y;
    const size = 40;
    setFont(s, size * 0.82, 800, "sans");
    const w = size * 1.28 + ctx.measureText("ABOT").width;
    enter(from + 0.48, () => wordmark(s, leftOf(w), at, size, VOLT));
  }
  ctx.restore();
}

const PAINTERS: Record<StoryPresetId, (s: Scene) => void> = {
  clean,
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
  endCard({ ctx, fonts, time, data, unit: "kg", opts: { preset: "matchday", photo: null, overlay: 0, grayscale: false, hideWatermark }, onPhoto: false });
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
