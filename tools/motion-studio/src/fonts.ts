import { continueRender, delayRender, staticFile } from "remotion";
import { loadStoryFonts, type StoryFonts } from "@/lib/story-exporter";

/**
 * The app's seven faces, from the same files (linked into public/), declared under the CSS
 * variables loadStoryFonts reads, so the painters pick them up exactly as in the app.
 */
const FACES: { cssVar: string; family: string; file: string; weight: string }[] = [
  { cssVar: "--font-sans-face", family: "ABOT Jakarta", file: "app-fonts/plus-jakarta-sans-latin.woff2", weight: "200 800" },
  { cssVar: "--font-jetbrains-mono", family: "ABOT Mono", file: "app-fonts/jetbrains-mono-latin.woff2", weight: "100 800" },
  { cssVar: "--font-anton", family: "ABOT Anton", file: "story-fonts/anton-latin.woff2", weight: "400" },
  { cssVar: "--font-fraunces", family: "ABOT Fraunces", file: "story-fonts/fraunces-latin.woff2", weight: "400 900" },
  { cssVar: "--font-silkscreen", family: "ABOT Silkscreen", file: "story-fonts/silkscreen-400-latin.woff2", weight: "400" },
  { cssVar: "--font-silkscreen", family: "ABOT Silkscreen", file: "story-fonts/silkscreen-700-latin.woff2", weight: "700" },
  { cssVar: "--font-space-grotesk", family: "ABOT Grotesk", file: "story-fonts/space-grotesk-latin.woff2", weight: "400 700" },
  { cssVar: "--font-vt323", family: "ABOT VT323", file: "story-fonts/vt323-latin.woff2", weight: "400" },
];

let loading: Promise<StoryFonts> | null = null;

/** Declares the faces once and resolves with the stacks the painters draw with. */
export function storyFonts(): Promise<StoryFonts> {
  if (!loading) {
    const css = FACES.map(
      (f) => `@font-face { font-family: "${f.family}"; src: url("${staticFile(f.file)}") format("woff2"); font-weight: ${f.weight}; font-display: block; }`,
    ).join("\n");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    for (const f of FACES) document.documentElement.style.setProperty(f.cssVar, `"${f.family}"`);
    loading = loadStoryFonts();
  }
  return loading;
}

/** Holds the render until the fonts are in, so no frame is drawn in a fallback face. */
export function waitForFonts(set: (f: StoryFonts) => void) {
  const handle = delayRender("Loading the story fonts");
  storyFonts()
    .then((f) => set(f))
    .finally(() => continueRender(handle));
}
