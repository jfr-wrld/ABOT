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

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export type StoryPresetId =
  | "obsidian-raw"
  | "thermal-matrix"
  | "brutalist-receipt"
  | "cyber-volt-hud"
  | "monochrome-steel"
  | "pr-trophy-vault"
  | "photo-backdrop"
  | "split-spec-sheet"
  | "loaded-bar"
  | "plate-grid"
  | "volt-poster";

export const STORY_PRESETS: { id: StoryPresetId; name: string; blurb: string }[] = [
  { id: "obsidian-raw", name: "Obsidian Raw", blurb: "Black plate, steel hairlines, one Volt point" },
  { id: "thermal-matrix", name: "Thermal Matrix", blurb: "Muscle map lit by sets worked" },
  { id: "brutalist-receipt", name: "Brutalist Receipt", blurb: "Every set itemised like a till slip" },
  { id: "cyber-volt-hud", name: "Cyber-Volt HUD", blurb: "Cockpit readout, massive figures" },
  { id: "monochrome-steel", name: "Monochrome Steel", blurb: "Black and white editorial" },
  { id: "pr-trophy-vault", name: "PR Trophy Vault", blurb: "Records first, with top tonnage" },
  { id: "photo-backdrop", name: "Photo Backdrop", blurb: "Your photo behind a glass card" },
  { id: "split-spec-sheet", name: "Split Spec Sheet", blurb: "Stats above, progress line below" },
  { id: "loaded-bar", name: "Loaded Bar", blurb: "Each lift a plate on the bar, sized by its volume" },
  { id: "plate-grid", name: "Plate Grid", blurb: "A honeycomb of plates, one per lift" },
  { id: "volt-poster", name: "Volt Poster", blurb: "Swiss poster in black on Volt" },
];

export interface StoryFonts {
  sans: string;
  mono: string;
}

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
 * Inter and JetBrains Mono are served by next/font under the family names published as CSS
 * variables on <html>. Canvas cannot use a font the page has not loaded yet, so every weight
 * the cards use is loaded first. Only the real family is loaded: next/font's "Fallback" face
 * points at the system Arial, which phones without Arial reject. A weight that fails to load
 * falls back to the next family in the stack instead of blocking the card.
 */
export async function loadStoryFonts(): Promise<StoryFonts> {
  const root = getComputedStyle(document.documentElement);
  const sansVar = root.getPropertyValue("--font-inter").trim();
  const monoVar = root.getPropertyValue("--font-jetbrains-mono").trim();
  const sans = `${sansVar ? `${sansVar}, ` : ""}Inter, system-ui, sans-serif`;
  const mono = `${monoVar ? `${monoVar}, ` : ""}"JetBrains Mono", ui-monospace, monospace`;
  const first = (stack: string, fallback: string) => stack.split(",")[0]?.trim() || fallback;
  const sansFace = first(sansVar, "Inter");
  const monoFace = first(monoVar, '"JetBrains Mono"');
  await Promise.allSettled([
    ...[400, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 48px ${sansFace}`, "ABOT abot")),
    ...[400, 700, 800].map((w) => document.fonts.load(`${w} 48px ${monoFace}`, "0123456789")),
  ]);
  return { sans, mono };
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
  data: StoryData;
  unit: WeightUnit;
  opts: StoryOptions;
  /** A photo is behind the text, so text gets a soft dark shadow to stay readable. */
  onPhoto: boolean;
}

interface TextOpts {
  size: number;
  weight?: number;
  family?: "sans" | "mono";
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
  tracking?: number;
  shadow?: boolean;
}

function setFont(s: Scene, size: number, weight = 400, family: "sans" | "mono" = "sans") {
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
function fitSize(s: Scene, str: string, width: number, max: number, min: number, weight: number, family: "sans" | "mono") {
  for (let size = max; size > min; size -= 4) {
    setFont(s, size, weight, family);
    setTracking(s.ctx, 0);
    if (s.ctx.measureText(str).width <= width) return size;
  }
  return min;
}

/** Splits text into at most `maxLines` lines that fit `width`; the last one is ellipsised. */
function wrap(s: Scene, str: string, width: number, size: number, weight: number, maxLines: number): string[] {
  setFont(s, size, weight, "sans");
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

function vline(ctx: Ctx, x: number, y1: number, y2: number, color: string, width = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
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

/** Rectangle with its four corners cut at 45 degrees: the HUD panel shape. */
function chamfer(ctx: Ctx, x: number, y: number, w: number, h: number, c: number) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

const MARK_PATH = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z M50 28 A22 22 0 1 0 50.01 28 Z";
let markPath: Path2D | null = null;

/** The ABOT plate mark, same geometry as components/brand/AbotMark. */
function mark(ctx: Ctx, x: number, y: number, size: number, color: string, ringColor: string) {
  markPath ??= new Path2D(MARK_PATH);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  ctx.fill(markPath, "evenodd");
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(50, 50, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Mark plus wordmark; `y` is the vertical centre. Returns the total width. */
function wordmark(s: Scene, x: number, y: number, size: number, color: string, wordColor = TEXT, ring = OBSIDIAN) {
  if (s.opts.hideWatermark) return 0;
  mark(s.ctx, x, y - size / 2, size, color, ring);
  const w = text(s, "ABOT", x + size + size * 0.28, y, {
    size: size * 0.82,
    weight: 900,
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

function workoutsLabel(n: number) {
  return `${n} ${n === 1 ? "workout" : "workouts"}`;
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

/** Obsidian Raw: black plate, steel hairline frame, bento cells in the corners, one Volt point. */
function obsidianRaw(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);
  const m = 56;
  const cellH = 300;
  const mid = W / 2;
  const top = m + cellH;
  const bottom = H - m - cellH;

  rrect(ctx, m, m, W - 2 * m, H - 2 * m, 44);
  ctx.strokeStyle = STEEL;
  ctx.lineWidth = 2;
  ctx.stroke();
  hline(ctx, m, W - m, top, STEEL);
  hline(ctx, m, W - m, bottom, STEEL);
  vline(ctx, mid, m, top, STEEL);
  vline(ctx, mid, bottom, H - m, STEEL);

  // Top cells: brand, date. Bottom cells: duration, sets.
  wordmark(s, m + 48, m + 190, 64, VOLT);
  caps(s, data.kind === "session" ? "Date" : "Range", mid + 48, m + 150);
  const date = data.kind === "session" ? dateDots(data.startedAt) : dateDots(data.endedAt);
  text(s, date, mid + 48, m + 214, { size: 52, weight: 700, family: "mono" });
  caps(s, data.kind === "session" ? `Start ${timeOf(data.startedAt)}` : `${workoutsLabel(data.workouts)} since ${dateDots(data.startedAt).slice(0, 5)}`, mid + 48, m + 258);

  caps(s, "Duration", m + 48, bottom + 92);
  text(s, formatDuration(data.durationSec), m + 48, bottom + 176, { size: 68, weight: 800, family: "mono" });
  caps(s, "Sets done", mid + 48, bottom + 92);
  text(s, String(data.setsDone), mid + 48, bottom + 176, { size: 68, weight: 800, family: "mono" });

  // Centre: title, the volume figure, the lifts.
  const x = m + 48;
  const inner = W - 2 * x;
  const titleSize = fitSize(s, data.title, inner, 76, 48, 800, "sans");
  text(s, data.title, x, top + 120, { size: titleSize, weight: 800, maxWidth: inner });

  ctx.fillStyle = VOLT;
  ctx.beginPath();
  ctx.arc(x + 10, top + 196, 10, 0, Math.PI * 2);
  ctx.fill();
  caps(s, "Total volume", x + 36, top + 205, { color: TEXT });

  const [vol, u] = volumeParts(data.volumeKg, unit);
  const volSize = fitSize(s, vol, inner - 140, 210, 96, 800, "mono");
  const vw = text(s, vol, x - 6, top + 205 + volSize * 0.95, { size: volSize, weight: 800, family: "mono", tracking: -4 });
  text(s, u, x + vw + 12, top + 205 + volSize * 0.95, { size: 48, weight: 700, family: "mono", color: MUTED });

  let y = top + 205 + volSize * 0.95 + 70;
  if (data.prs.length > 0) {
    caps(s, `${data.prs.length} new ${data.prs.length === 1 ? "record" : "records"}`, x, y, { color: CYAN, size: 28 });
    y += 50;
  }
  hline(ctx, x, W - x, y, STEEL);
  const rows = Math.max(1, Math.min(data.exercises.length, Math.floor((bottom - 70 - y) / 92)));
  const shown = data.exercises.length > rows ? rows - 1 : rows;
  for (const ex of data.exercises.slice(0, shown)) {
    const right = bestLabel(s, ex);
    const rw = text(s, right, W - x, y + 62, { size: 38, weight: 700, family: "mono", align: "right" });
    text(s, ex.name, x, y + 62, { size: 38, weight: 600, maxWidth: inner - rw - 32 });
    y += 92;
    hline(ctx, x, W - x, y, STEEL);
  }
  if (shown < data.exercises.length)
    caps(s, `+${data.exercises.length - shown} more ${data.exercises.length - shown === 1 ? "lift" : "lifts"}`, x, y + 58);
}

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
  // Range-finder ticks on the left edge.
  for (let y = 120; y < H - 120; y += 24) hline(ctx, 0, y % 120 === 0 ? 34 : 18, y, STEEL_LINE, 2);

  const x = 84;
  caps(s, "Thermal matrix // muscle load", x, SAFE_TOP + 20, { color: VOLT });
  caps(s, dateLabel(data), W - x, SAFE_TOP + 20, { align: "right" });
  text(s, data.title, x, SAFE_TOP + 100, { size: fitSize(s, data.title, W - 2 * x, 64, 44, 800, "sans"), weight: 800, maxWidth: W - 2 * x });

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
    text(s, MUSCLE_GROUP_LABELS[muscle], x, y, { size: 36, weight: 600 });
    const frac = max > 0 ? sets / max : 0;
    ctx.fillStyle = CARBON_2;
    ctx.fillRect(x + 330, y - 22, 480, 16);
    ctx.fillStyle = VOLT;
    ctx.fillRect(x + 330, y - 22, 480 * frac, 16);
    text(s, setsNumber(sets), W - x, y, { size: 36, weight: 700, family: "mono", align: "right" });
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
    text(s, value, cx, fy + 34, { size: 40, weight: 800, family: "mono", maxWidth: (W - 2 * x) / 3 - 20 });
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
  const ink = { family: "mono" as const, color: INK };
  const dashed = (y: number) => hline(ctx, x, r, y, INK, 3, [12, 10]);

  let y = py + 130;
  text(s, s.opts.hideWatermark ? "LIFT LOG" : "ABOT", W / 2, y, { size: 84, weight: 900, color: INK, align: "center", tracking: -2 });
  y += 52;
  text(s, "STRENGTH RECEIPT", W / 2, y, { ...ink, size: 26, align: "center", tracking: 6 });
  y += 64;
  const d = new Date(data.startedAt);
  const slash = (t: Date) => `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`;
  if (data.kind === "session") {
    text(s, `DATE ${slash(d)}`, x, y, { ...ink, size: 28 });
    text(s, `TIME ${timeOf(data.startedAt)}`, r, y, { ...ink, size: 28, align: "right" });
  } else {
    text(s, `FROM ${slash(d)}`, x, y, { ...ink, size: 28 });
    text(s, `TO ${slash(new Date(data.endedAt))}`, r, y, { ...ink, size: 28, align: "right" });
  }
  y += 42;
  text(s, `TICKET #${data.sessionId.slice(-6).toUpperCase()}`, x, y, { ...ink, size: 28 });
  if (data.locationName) text(s, data.locationName.toUpperCase(), r, y, { ...ink, size: 28, align: "right", maxWidth: inner / 2 });
  const handle = data.handle?.trim();
  if (handle) {
    y += 42;
    text(s, `MEMBER @${handle}`, x, y, { ...ink, size: 28, maxWidth: inner });
  }
  y += 36;
  dashed(y);
  y += 56;
  text(s, data.title.toUpperCase(), x, y, { ...ink, size: 32, weight: 800, maxWidth: inner });
  y += 28;

  // Itemised sets, cut off with a count when the slip runs out of paper.
  const totalsTop = py + ph - 700;
  const line = 40;
  let remaining = data.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  let budget = Math.floor((totalsTop - y) / line);
  for (const ex of data.exercises) {
    if (budget < 3) break;
    y += line + 6;
    text(s, ex.name.toUpperCase(), x, y, { ...ink, size: 28, weight: 700, maxWidth: inner });
    budget -= 1;
    ex.sets.forEach((set, i) => {
      if (budget < 2) return;
      y += line;
      const vol = set.volumeKg > 0 ? formatWeight(set.volumeKg, unit, false) : "";
      text(s, `${String(i + 1).padStart(2, " ")}  ${setLabel(set, unit)}${set.isPR ? "  PR" : ""}`, x + 20, y, { ...ink, size: 28 });
      if (vol) text(s, vol, r, y, { ...ink, size: 28, align: "right" });
      budget -= 1;
      remaining -= 1;
    });
  }
  if (remaining > 0) {
    y += line;
    text(s, `... +${remaining} MORE ${remaining === 1 ? "SET" : "SETS"}`, x + 20, y, { ...ink, size: 28, color: INK_MUTED });
  }

  y = totalsTop + 30;
  dashed(y);
  y += 60;
  const row = (label: string, value: string, big = false) => {
    text(s, label, x, y, { ...ink, size: big ? 36 : 28, weight: big ? 800 : 400 });
    text(s, value, r, y, { ...ink, size: big ? 44 : 28, weight: big ? 800 : 400, align: "right" });
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
    size: broke ? 36 : 40,
    weight: 800,
    family: "mono",
    color: STAMP_INK,
    align: "center",
  });
  text(s, broke ? `${data.prs.length} NEW ${data.prs.length === 1 ? "RECORD" : "RECORDS"}` : `${data.setsDone} SETS ON FILE`, 0, 38, {
    size: 24,
    family: "mono",
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

/** Cyber-Volt HUD: chamfered cockpit panels, system clock in the corner, massive figures. */
function cyberVoltHud(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, "#050507");
  const m = 44;
  chamfer(ctx, m, m, W - 2 * m, H - 2 * m, 60);
  ctx.strokeStyle = VOLT;
  ctx.lineWidth = 3;
  ctx.stroke();

  const x = 100;
  const d = new Date(data.kind === "session" ? data.startedAt : data.endedAt);
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${timeOf(d.getTime())}:${pad(d.getSeconds())}`;
  caps(s, `SYS.TIME ${stamp}`, x, SAFE_TOP - 40, { color: CYAN, size: 24 });
  caps(s, `SID ${data.sessionId.slice(0, 8).toUpperCase()}`, W - x, SAFE_TOP - 40, { size: 24, align: "right" });
  hline(ctx, x, W - x, SAFE_TOP - 14, "rgba(204, 255, 0, 0.35)", 2);

  caps(s, data.kind === "session" ? "Mission log" : `Campaign log // ${dateLabel(data)}`, x, SAFE_TOP + 60, { color: VOLT });
  text(s, data.title.toUpperCase(), x, SAFE_TOP + 130, {
    size: fitSize(s, data.title.toUpperCase(), W - 2 * x, 64, 40, 800, "sans"),
    weight: 800,
    maxWidth: W - 2 * x,
  });

  // Volume readout with a reticle.
  const [vol, u] = volumeParts(data.volumeKg, unit);
  let y = SAFE_TOP + 210;
  chamfer(ctx, x - 20, y, W - 2 * x + 40, 360, 34);
  ctx.fillStyle = "rgba(204, 255, 0, 0.05)";
  ctx.fill();
  ctx.strokeStyle = "rgba(204, 255, 0, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  caps(s, `Total load // ${unit}`, x + 20, y + 64, { color: VOLT });
  const volSize = fitSize(s, vol, W - 2 * x - 200, 240, 110, 800, "mono");
  text(s, vol, x + 14, y + 90 + volSize * 0.8, { size: volSize, weight: 800, family: "mono", color: VOLT, tracking: -6 });
  const rx = W - x - 70;
  const ry = y + 90;
  ctx.save();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(rx, ry, 40, 0, Math.PI * 2);
  ctx.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(rx + dx * 24, ry + dy * 24);
    ctx.lineTo(rx + dx * 58, ry + dy * 58);
    ctx.stroke();
  }
  ctx.restore();
  text(s, u, W - x, y + 330, { size: 40, weight: 700, family: "mono", color: MUTED, align: "right" });

  y += 400;
  const half = (W - 2 * x - 30) / 2;
  const panel = (px: number, py: number, label: string, value: string, color: string) => {
    chamfer(ctx, px, py, half, 220, 26);
    ctx.strokeStyle = color === TEXT ? STEEL_LINE : color;
    ctx.lineWidth = 2;
    ctx.stroke();
    caps(s, label, px + 34, py + 60, { color: color === TEXT ? MUTED : color });
    const size = fitSize(s, value, half - 68, 104, 56, 800, "mono");
    text(s, value, px + 30, py + 82 + size * 0.85, { size, weight: 800, family: "mono", color });
  };
  panel(x, y, "Duration", formatDuration(data.durationSec), TEXT);
  panel(x + half + 30, y, "New PRs", String(data.prs.length), CYAN);
  y += 250;
  panel(x, y, "Sets", String(data.setsDone), TEXT);
  if (data.kind === "session") panel(x + half + 30, y, "Modules", String(data.exercises.length), TEXT);
  else panel(x + half + 30, y, "Workouts", String(data.workouts), TEXT);

  y += 300;
  const rows = Math.max(1, Math.min(data.exercises.length, Math.floor((SAFE_BOTTOM - y) / 62)));
  data.exercises.slice(0, rows).forEach((ex, i) => {
    caps(s, `MOD ${pad(i + 1)}`, x, y, { color: VOLT, size: 24 });
    const right = bestLabel(s, ex);
    const rw = text(s, right, W - x, y, { size: 34, weight: 700, family: "mono", align: "right" });
    text(s, ex.name.toUpperCase(), x + 150, y, { size: 32, weight: 600, maxWidth: W - 2 * x - 150 - rw - 30 });
    y += 62;
  });

  wordmark(s, x, H - 140, 52, VOLT, TEXT, "#050507");
  caps(s, "Flight recorder", W - x, H - 130, { align: "right" });
}

/** Monochrome Steel: absolute black and white, editorial masthead, photo always grayscale. */
function monochromeSteel(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, "#000000", true);
  const x = 72;
  const inner = W - 2 * x;

  hline(ctx, x, W - x, SAFE_TOP - 50, "#ffffff", 4);
  if (!s.opts.hideWatermark) text(s, "ABOT", x, SAFE_TOP, { size: 44, weight: 900, color: "#ffffff", tracking: -1 });
  caps(s, `Issue ${dateLabel(data)}`, W - x, SAFE_TOP - 4, { color: "#ffffff", align: "right" });

  const head = data.title.toUpperCase();
  let size = 190;
  let lines = wrap(s, head, inner, size, 900, 3);
  while (size > 96 && lines.some((l) => l.endsWith("…"))) {
    size -= 10;
    lines = wrap(s, head, inner, size, 900, 3);
  }
  let y = SAFE_TOP + 40 + size * 0.85;
  for (const l of lines) {
    text(s, l, x - 4, y, { size, weight: 900, color: "#ffffff", tracking: -size * 0.04 });
    y += size * 0.92;
  }

  y += 40;
  hline(ctx, x, W - x, y, "#ffffff", 2);
  const [vol] = volumeParts(data.volumeKg, unit);
  const volSize = fitSize(s, vol, inner, 220, 100, 800, "mono");
  y += volSize * 0.95;
  text(s, vol, x - 6, y, { size: volSize, weight: 800, family: "mono", color: "#ffffff", tracking: -6 });
  y += 76;
  caps(s, unit === "kg" ? "Kilograms moved" : "Pounds moved", x, y, { color: "#ffffff", size: 28 });

  y += 70;
  hline(ctx, x, W - x, y, "#ffffff", 2);
  const colW = (inner - 40) / 2;
  const footTop = H - 230;
  const perCol = Math.max(1, Math.floor((footTop - 40 - y) / 110));
  const list = data.exercises.slice(0, perCol * 2);
  list.forEach((ex, i) => {
    const col = i < perCol ? 0 : 1;
    const cx = x + col * (colW + 40);
    const cy = y + 62 + (i % perCol) * 110;
    text(s, ex.name, cx, cy, { size: 34, weight: 700, color: "#ffffff", maxWidth: colW });
    text(s, bestLabel(s, ex), cx, cy + 44, { size: 30, family: "mono", color: "#d4d4d8", maxWidth: colW });
  });
  if (list.length > perCol) vline(ctx, x + colW + 20, y + 20, y + 20 + perCol * 110, "rgba(255,255,255,0.35)", 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, footTop, W, H - footTop);
  s.onPhoto = false;
  text(s, `${data.setsDone} SETS`, x, footTop + 100, { size: 56, weight: 900, color: "#000000", tracking: -1 });
  text(s, formatDuration(data.durationSec).toUpperCase(), W - x, footTop + 100, {
    size: 56,
    weight: 800,
    family: "mono",
    color: "#000000",
    align: "right",
  });
  caps(s, "Strength log", x, footTop + 150, { color: "#000000" });
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
function prTrophyVault(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);
  const x = 80;
  const inner = W - 2 * x;
  const prs = data.prs;

  caps(s, "PR trophy vault", x, SAFE_TOP, { color: GOLD });
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
  text(s, heading, x, y, { size: fitSize(s, heading, inner, 104, 60, 900, "sans"), weight: 900, tracking: -2 });
  y += 56;
  const sub = prs.length > 0 ? `on ${lifts.length} ${lifts.length === 1 ? "lift" : "lifts"}, ${data.title}` : data.title;
  text(s, sub, x, y, { size: 36, weight: 600, color: MUTED, maxWidth: inner });
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
      ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      const lead = lift.records[0];
      const v = prValue(lead, unit);
      text(s, "🏆 NEW PR", x + 36, y + 58, { size: 28, weight: 700, family: "mono", color: CYAN, tracking: 2 });
      caps(s, lift.records.map((p) => SHORT_KIND[p.kind]).join(" + "), x + inner - 36, y + 58, { align: "right" });
      const vw = text(s, v.main, x + inner - 36, y + 144, { size: 64, weight: 800, family: "mono", color: CYAN, align: "right" });
      text(s, lift.name, x + 36, y + 138, { size: 42, weight: 700, maxWidth: inner - vw - 100 });
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

/** Photo Backdrop: the lifter's photo full bleed, the numbers on a dark glass card. */
function photoBackdrop(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);
  const x = 72;
  wordmark(s, x, SAFE_TOP - 20, 60, VOLT);
  caps(s, dateLabel(data), W - x, SAFE_TOP - 10, { align: "right", color: TEXT });

  const cardX = 56;
  const cardW = W - 2 * cardX;
  const rows = Math.min(3, data.exercises.length);
  const cardH = 480 + rows * 76;
  const cardY = SAFE_BOTTOM - cardH;
  rrect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fillStyle = "rgba(9, 9, 11, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const onPhoto = s.onPhoto;
  s.onPhoto = false;
  const ix = cardX + 48;
  const inner = cardW - 96;
  ctx.fillStyle = VOLT;
  ctx.beginPath();
  ctx.arc(ix + 9, cardY + 72, 9, 0, Math.PI * 2);
  ctx.fill();
  caps(s, data.kind === "session" ? "Today's session" : `${workoutsLabel(data.workouts)} // ${dateLabel(data)}`, ix + 32, cardY + 81, { color: TEXT, maxWidth: inner - 40 });
  text(s, data.title, ix, cardY + 160, { size: fitSize(s, data.title, inner, 68, 44, 800, "sans"), weight: 800, maxWidth: inner });

  const [vol, u] = volumeParts(data.volumeKg, unit);
  const col = inner / 3;
  const stats: [string, string][] = [
    [`Volume ${u}`, vol],
    ["Duration", formatDuration(data.durationSec)],
    ["Sets", String(data.setsDone)],
  ];
  stats.forEach(([label, value], i) => {
    caps(s, label, ix + i * col, cardY + 236);
    text(s, value, ix + i * col, cardY + 310, {
      size: fitSize(s, value, col - 24, 64, 36, 800, "mono"),
      weight: 800,
      family: "mono",
      color: i === 0 ? VOLT : TEXT,
    });
  });
  let y = cardY + 370;
  hline(ctx, ix, ix + inner, y, "rgba(255,255,255,0.16)");
  for (const ex of data.exercises.slice(0, rows)) {
    const rw = text(s, bestLabel(s, ex), ix + inner, y + 54, { size: 34, weight: 700, family: "mono", align: "right" });
    text(s, ex.name, ix, y + 54, { size: 34, weight: 600, maxWidth: inner - rw - 30 });
    y += 76;
  }
  const more = data.exercises.length - rows;
  caps(s, more > 0 ? `+${more} more ${more === 1 ? "lift" : "lifts"}` : `${data.prs.length} new records`, ix, cardY + cardH - 44, {
    color: data.prs.length > 0 && more <= 0 ? CYAN : MUTED,
  });
  s.onPhoto = onPhoto;
}

/** Split Spec Sheet: stats on the top half, progress line and equipment on the bottom half. */
function splitSpecSheet(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);
  const half = H / 2;
  ctx.fillStyle = s.opts.photo ? withAlpha(CARBON, 0.92) : CARBON;
  ctx.fillRect(0, half, W, half);
  const x = 80;
  const inner = W - 2 * x;

  caps(s, data.kind === "session" ? "A // Session spec" : "A // Block spec", x, SAFE_TOP);
  caps(s, dateLabel(data), W - x, SAFE_TOP, { align: "right" });
  text(s, data.title, x, SAFE_TOP + 80, { size: fitSize(s, data.title, inner, 64, 44, 800, "sans"), weight: 800, maxWidth: inner });

  caps(s, `Total tonnage // ${unit}`, x, SAFE_TOP + 170, { color: VOLT });
  const [vol] = volumeParts(data.volumeKg, unit);
  const volSize = fitSize(s, vol, inner, 200, 100, 800, "mono");
  text(s, vol, x - 6, SAFE_TOP + 180 + volSize * 0.85, { size: volSize, weight: 800, family: "mono", tracking: -6 });

  let y = SAFE_TOP + 220 + volSize * 0.85;
  const spec = (label: string, value: string) => {
    hline(ctx, x, W - x, y, STEEL);
    caps(s, label, x, y + 58);
    text(s, value, W - x, y + 62, { size: 44, weight: 700, family: "mono", align: "right" });
    y += 92;
  };
  if (data.kind === "period") spec("Workouts", String(data.workouts));
  spec("Duration", formatDuration(data.durationSec));
  spec("Total sets", String(data.setsDone));
  if (y < half - 60) spec("Exercises", String(data.exercises.length));

  // The split, exactly at the middle.
  hline(ctx, 0, W, half, VOLT, 4);
  ctx.fillStyle = VOLT;
  ctx.fillRect(x, half - 22, 190, 44);
  s.ctx.save();
  text(s, "B // PROGRESS", x + 95, half + 9, { size: 22, weight: 800, family: "mono", color: "#000000", align: "center", shadow: false });
  s.ctx.restore();

  y = half + 100;
  const trend = data.trend;
  text(s, trend ? trend.exerciseName : "No loaded lift today", x, y, { size: 40, weight: 700, maxWidth: inner });
  caps(s, "Estimated 1RM, last sessions", x, y + 44);

  const gx = x;
  const gy = y + 90;
  const gw = inner;
  const gh = 330;
  rrect(ctx, gx, gy, gw, gh, 20);
  ctx.strokeStyle = STEEL;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 1; i < 4; i++) hline(ctx, gx + 20, gx + gw - 20, gy + (gh / 4) * i, "rgba(255,255,255,0.05)", 2);

  const pts = trend?.points ?? [];
  if (pts.length >= 2) {
    const vals = pts.map((p) => p.e1rmKg);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1;
    const px = (i: number) => gx + 50 + (i * (gw - 100)) / (pts.length - 1);
    const py = (v: number) => gy + gh - 60 - ((v - lo) / span) * (gh - 120);
    ctx.save();
    ctx.strokeStyle = VOLT;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(px(i), py(p.e1rmKg)) : ctx.lineTo(px(i), py(p.e1rmKg))));
    ctx.stroke();
    pts.forEach((p, i) => {
      const last = i === pts.length - 1;
      ctx.fillStyle = last ? VOLT : CARBON;
      ctx.strokeStyle = VOLT;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px(i), py(p.e1rmKg), last ? 14 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
    caps(s, formatWeight(hi, unit), gx + 24, gy + 44);
    caps(s, formatWeight(lo, unit), gx + 24, gy + gh - 20);
    const delta = vals[vals.length - 1] - vals[0];
    const sign = delta > 0 ? "+" : delta < 0 ? "-" : "±";
    y = gy + gh + 74;
    text(s, `${sign}${formatWeight(Math.abs(delta), unit)}`, x, y, { size: 52, weight: 800, family: "mono", color: delta > 0 ? VOLT : TEXT });
    caps(s, `over ${pts.length} sessions, now ${formatWeight(vals[vals.length - 1], unit)}`, W - x, y - 8, { align: "right" });
  } else {
    text(s, pts.length === 1 ? "First logged session of this lift." : "Log weight and reps to start a line.", gx + 40, gy + gh / 2 - 10, {
      size: 34,
      weight: 600,
      color: MUTED,
      maxWidth: gw - 80,
    });
    if (pts.length === 1)
      text(s, `Today: ${formatWeight(pts[0].e1rmKg, unit)} est. 1RM.`, gx + 40, gy + gh / 2 + 44, {
        size: 28,
        family: "mono",
        color: MUTED,
        maxWidth: gw - 80,
      });
    y = gy + gh + 74;
  }

  y += 40;
  const tech: [string, string][] = data.equipment.slice(0, 3).map((e) => [e.label, `${e.count} ${e.count === 1 ? "lift" : "lifts"}`]);
  if (data.locationName) tech.push(["Gym", data.locationName]);
  if (data.barWeightKg && data.equipment.some((e) => e.label === "Barbell")) tech.push(["Bar", formatWeight(data.barWeightKg, unit)]);
  for (const [label, value] of tech.slice(0, Math.max(0, Math.floor((SAFE_BOTTOM + 120 - y) / 70)))) {
    hline(ctx, x, W - x, y, STEEL);
    caps(s, label, x, y + 46);
    text(s, value, W - x, y + 48, { size: 32, weight: 700, family: "mono", align: "right", maxWidth: inner / 2 });
    y += 70;
  }
  if (!s.opts.hideWatermark) mark(ctx, W - x - 56, H - 130, 56, VOLT, CARBON);
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
  const titleSize = fitSize(s, data.title, W - 2 * m, 92, 52, 800, "sans");
  text(s, data.title, m, SAFE_TOP + 90, { size: titleSize, weight: 800, maxWidth: W - 2 * m });

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
    const rw = text(s, right, W - m, y, { size: 34, weight: 700, family: "mono", align: "right" });
    text(s, p.name, m + 44, y, { size: 36, weight: 600, maxWidth: W - 2 * m - rw - 80 });
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
  const vw = text(s, vol, m, by, { size: 96, weight: 800, family: "mono", tracking: -2 });
  text(s, u, m + vw + 10, by, { size: 40, weight: 700, family: "mono", color: MUTED });
  caps(s, "Time", W - m - 300, by - 92);
  text(s, formatDuration(data.durationSec), W - m - 300, by, { size: 56, weight: 800, family: "mono" });
  caps(s, "Sets", W - m, by - 92, { align: "right" });
  text(s, String(data.setsDone), W - m, by, { size: 56, weight: 800, family: "mono", align: "right" });
}

/* ------------------------------------------------------------------ */
/* Plate Grid                                                          */
/* ------------------------------------------------------------------ */

function hexPath(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Plate Grid: a honeycomb of flat-top plates, the ABOT shape. The centre plate holds the total;
 * each plate around it is one lift with its best set, Cyan-edged when it set a record.
 */
function plateGrid(s: Scene) {
  const { ctx, data, unit } = s;
  paintBackground(s, OBSIDIAN);
  const m = 72;
  const records = recordLifts(data);

  wordmark(s, m, SAFE_TOP - 40, 56, VOLT);
  caps(s, dateLabel(data), W - m, SAFE_TOP - 30, { align: "right" });
  const titleSize = fitSize(s, data.title, W - 2 * m, 88, 52, 800, "sans");
  text(s, data.title, m, SAFE_TOP + 86, { size: titleSize, weight: 800, maxWidth: W - 2 * m });

  const R = 150;
  const gap = 14;
  const d = Math.sqrt(3) * R + gap;
  const cx = W / 2;
  const cy = 900;
  const lifts = data.exercises.slice(0, 6);

  // Centre: the total.
  hexPath(ctx, cx, cy, R);
  ctx.fillStyle = VOLT;
  ctx.fill();
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const vs = fitSize(s, vol, R * 1.5, 92, 44, 800, "mono");
  text(s, vol, cx, cy + 14, { size: vs, weight: 800, family: "mono", color: INK, align: "center" });
  caps(s, `${u} lifted`, cx, cy + 66, { align: "center", color: INK, size: 24 });

  // Ring: the lifts spread evenly around the centre (3 lifts take every other plate), clockwise
  // from the top; the plates between stay empty.
  const slot = new Map<number, (typeof lifts)[number]>();
  lifts.forEach((l, i) => slot.set(Math.floor((i * 6) / lifts.length), l));
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (Math.PI / 3) * i;
    const x = cx + d * Math.cos(a);
    const y = cy + d * Math.sin(a);
    const lift = slot.get(i);
    hexPath(ctx, x, y, R);
    ctx.fillStyle = lift ? CARBON : withAlpha(CARBON, 0.45);
    ctx.fill();
    ctx.lineWidth = lift && records.has(lift.name) ? 5 : 2;
    ctx.strokeStyle = lift && records.has(lift.name) ? CYAN : STEEL;
    ctx.stroke();
    if (!lift) continue;
    const lines = wrap(s, lift.name, R * 1.45, 30, 600, 2);
    const top = y - (lines.length === 2 ? 46 : 26);
    lines.forEach((l, k) => text(s, l, x, top + k * 36, { size: 30, weight: 600, align: "center" }));
    text(s, bestLabel(s, lift), x, y + 52, {
      size: 30,
      weight: 700,
      family: "mono",
      align: "center",
      color: records.has(lift.name) ? CYAN : VOLT,
      maxWidth: R * 1.5,
    });
  }

  // Totals under the honeycomb.
  const by = SAFE_BOTTOM - 30;
  hline(ctx, m, W - m, by - 140, STEEL);
  const stats: [string, string][] = [
    ["Time", formatDuration(data.durationSec)],
    ["Sets", String(data.setsDone)],
    ["Records", String(records.size)],
  ];
  const col = (W - 2 * m) / 3;
  stats.forEach(([label, value], i) => {
    const x = m + col * i;
    caps(s, label, x, by - 80);
    text(s, value, x, by, { size: 56, weight: 800, family: "mono", color: label === "Records" && records.size ? CYAN : TEXT });
  });
  if (data.exercises.length > 6) caps(s, `+${data.exercises.length - 6} more lifts`, W - m, by - 170, { align: "right" });
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
    mark(ctx, m, SAFE_TOP - 80, 60, INK, VOLT);
    ink("ABOT", m + 78, SAFE_TOP - 34, { size: 46, weight: 900 });
  }
  ink(dateLabel(data).toUpperCase(), W - m, SAFE_TOP - 34, { size: 30, weight: 700, family: "mono", align: "right", tracking: 2 });
  hline(ctx, m, W - m, SAFE_TOP + 8, INK, 8);

  // The figure.
  const [vol, u] = volumeParts(data.volumeKg, unit);
  const vs = fitSize(s, vol, inner, 330, 140, 900, "mono");
  ink(vol, m - 8, SAFE_TOP + 40 + vs * 0.86, { size: vs, weight: 900, family: "mono", tracking: -8 });
  // The figure's comma and digits hang below the baseline; leave them room.
  let y = SAFE_TOP + 40 + vs * 0.86 + 110;
  ink(`${u.toUpperCase()} LIFTED`, m, y, { size: 58, weight: 900, tracking: 2 });
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
    ink(value, m, y, { size: 128, weight: 900, family: "mono", tracking: -4 });
    ink(label, W - m, y, { size: 44, weight: 900, align: "right", tracking: 4 });
    y += 34;
    hline(ctx, m, W - m, y, INK, 4);
  }

  // Title and lifts.
  y += 86;
  const lines = wrap(s, data.title.toUpperCase(), inner, 64, 900, 2);
  for (const l of lines) {
    ink(l, m, y, { size: 64, weight: 900 });
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
  // Under the wordmark, in the brand cell.
  "obsidian-raw": { x: 104, y: 318, align: "left", color: MUTED },
  // Between the load bars and the stats row.
  "thermal-matrix": { x: W - 84, y: 1652, align: "right", color: VOLT },
  // A MEMBER line in the receipt header.
  "brutalist-receipt": null,
  // Above the ABOT plate on the recorder line.
  "cyber-volt-hud": { x: 100, y: 1716, align: "left", color: CYAN },
  // Above the white band, on the black.
  "monochrome-steel": { x: 72, y: 1630, align: "left", color: TEXT },
  // Above the tonnage footer.
  "pr-trophy-vault": { x: 80, y: 1690, align: "left", color: GOLD },
  // Under the date, over the photo.
  "photo-backdrop": { x: W - 72, y: 270, align: "right", color: TEXT },
  // Beside the closing plate mark.
  "split-spec-sheet": { x: 80, y: 1810, align: "left", color: MUTED },
  // Under the totals.
  "loaded-bar": { x: 72, y: 1722, align: "left", color: MUTED },
  "plate-grid": { x: 72, y: 1722, align: "left", color: MUTED },
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
  "obsidian-raw": obsidianRaw,
  "thermal-matrix": thermalMatrix,
  "brutalist-receipt": brutalistReceipt,
  "cyber-volt-hud": cyberVoltHud,
  "monochrome-steel": monochromeSteel,
  "pr-trophy-vault": prTrophyVault,
  "photo-backdrop": photoBackdrop,
  "split-spec-sheet": splitSpecSheet,
  "loaded-bar": loadedBar,
  "plate-grid": plateGrid,
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

export function renderStory(ctx: Ctx, data: StoryData, opts: StoryOptions, fonts: StoryFonts): void {
  const scene: Scene = { ctx, fonts, data, unit: data.unit, opts, onPhoto: opts.photo !== null };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  PAINTERS[opts.preset](scene);
  drawHandle(scene);
  drawFounderBadge(scene);
  ctx.restore();
}
