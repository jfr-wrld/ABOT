/**
 * The primary colour a lifter picks (Settings > General > Appearance), turned into every token
 * the CSS reads: the fill, the colour of content on it, the 3D rim, tints and glows, and a text
 * shade that stays readable on the dark page. Pure, so it is tested without a browser.
 *
 * Volt keeps the hand-tuned values it always had (DESIGN.md), so the default looks exactly as before.
 */

export const DEFAULT_ACCENT = "#ccff00";

/** The curated choices; any other #rrggbb comes from the colour picker. */
export const ACCENT_SWATCHES: { id: string; label: string; hex: string }[] = [
  { id: "volt", label: "Volt", hex: "#ccff00" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "purple", label: "Purple", hex: "#a855f7" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "cyan", label: "Cyan", hex: "#22d3ee" },
  { id: "white", label: "White", hex: "#f4f4f5" },
];

const DARK_BG = "#09090b";
const LIGHT_BG = "#f4f4f2";
const INK_ON_LIGHT = "#18181b";

/** CSS custom properties, set on <html>; globals.css reads them as --brand*. */
export type AccentTokens = Record<`--brand${string}`, string>;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes `hex` toward `to` by `t` (0 keeps it, 1 is `to`). */
function mix(hex: string, to: string, t: number): string {
  const a = rgb(hex);
  const b = rgb(to);
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** Lightens toward white in small steps until it reaches `ratio` against `bg`. */
function lightenTo(hex: string, bg: string, ratio: number): string {
  let out = hex;
  for (let t = 0; t <= 1 && contrast(out, bg) < ratio; t += 0.04) out = mix(hex, "#ffffff", t);
  return out;
}

/** Black or white, whichever reads better on `hex`. */
export function onColor(hex: string): "#000000" | "#ffffff" {
  return contrast(hex, "#000000") >= contrast(hex, "#ffffff") ? "#000000" : "#ffffff";
}

/** Near-white or pale grey: a fill of it would vanish on the light page. */
function isPaleNeutral(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b) < 40 && luminance(hex) > 0.6;
}

const triple = (hex: string) => rgb(hex).join(" ");

/** Today's Volt values, kept exactly. */
const VOLT_TOKENS: AccentTokens = {
  "--brand": "#ccff00",
  "--brand-text": "#ccff00",
  "--brand-on": "#000000",
  "--brand-rgb": "204 255 0",
  "--brand-dim": "#4d5c12",
  "--brand-edge": "#b3e600",
  "--brand-lip": "#7fa300",
  "--brand-deep-rgb": "60 90 0",
  "--brand-glow-rgb": "150 200 0",
  "--brand-light": "#ccff00",
  "--brand-light-on": "#000000",
  "--brand-light-edge": "#8db300",
  "--brand-light-deep-rgb": "80 110 0",
  "--brand-light-glow-rgb": "110 150 0",
};

/** Every --brand* token for `hex`; anything that is not #rrggbb falls back to Volt. */
export function accentTokens(hex: string | undefined | null): AccentTokens {
  if (!isHex(hex) || hex.toLowerCase() === DEFAULT_ACCENT) return VOLT_TOKENS;
  const base = hex.toLowerCase();
  // On the dark page a fill or a ring needs 3:1 to be seen, and text 4.5:1 to be read.
  const fill = lightenTo(base, DARK_BG, 3);
  const text = lightenTo(base, DARK_BG, 4.5);
  // On the light page a pale colour cannot carry a fill; black does, as it did before.
  const lightFill = isPaleNeutral(base) ? INK_ON_LIGHT : base;
  return {
    "--brand": fill,
    "--brand-text": text,
    "--brand-on": onColor(fill),
    "--brand-rgb": triple(fill),
    "--brand-dim": mix(fill, DARK_BG, 0.65),
    "--brand-edge": mix(fill, "#000000", 0.12),
    "--brand-lip": mix(fill, "#000000", 0.38),
    "--brand-deep-rgb": triple(mix(fill, "#000000", 0.7)),
    "--brand-glow-rgb": triple(mix(fill, "#000000", 0.2)),
    "--brand-light": lightFill,
    "--brand-light-on": onColor(lightFill),
    "--brand-light-edge": mix(lightFill, "#000000", 0.3),
    "--brand-light-deep-rgb": triple(mix(lightFill, "#000000", 0.6)),
    "--brand-light-glow-rgb": triple(mix(lightFill, "#000000", 0.35)),
  };
}

/** A custom colour so dark it had to be lightened a lot to show on the dark page. */
export function isVeryDark(hex: string): boolean {
  return isHex(hex) && contrast(hex, DARK_BG) < 2;
}

export const LIGHT_PAGE = LIGHT_BG;
