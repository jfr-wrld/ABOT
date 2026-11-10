#!/usr/bin/env node
/**
 * Renders the ABOT intro video: 1080 x 1920, 30 fps, about 60 s, with its synthesised soundtrack.
 *
 *   npm run dev                                   (in another terminal)
 *   node scripts/intro-video/render.mjs [http://localhost:3000] [--skip-capture] [--preview]
 *
 * 1. capture.mjs: real ABOT screens on the sample data (skip with --skip-capture to reuse them).
 * 2. audio.mjs: the soundtrack from timeline.mjs's cues.
 * 3. film.js: every frame drawn by renderAt(t) in Playwright, piped to ffmpeg with the audio.
 * --preview renders only a contact sheet of key moments (video-out/abot-intro-preview.png).
 * Output: video-out/abot-intro.mp4 (git-ignored). Needs ffmpeg (libx264, aac) and curl.
 */
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { capture } from "./capture.mjs";
import { renderAudio } from "./audio.mjs";
import { DURATION, FPS, SCENES } from "./timeline.mjs";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) || process.env.ABOT_URL || "http://localhost:3000";
const ROOT = join(import.meta.dirname, "../..");
const OUT = join(ROOT, "video-out");
const SRC = join(OUT, "frames-src");
const FONTS = join(OUT, "fonts");
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/** The paths from the app's own sources, so the video draws the same logo and flame. */
function readPaths() {
  const read = (file, name) => {
    const m = new RegExp(`export const ${name} =\\s*"([^"]+)"`).exec(readFileSync(join(ROOT, file), "utf8"));
    if (!m) throw new Error(`${name} not found in ${file}`);
    return m[1];
  };
  const mark = {
    A: read("src/components/brand/mark-path.ts", "MARK_A"),
    BAR: read("src/components/brand/mark-path.ts", "MARK_BAR"),
    L: read("src/components/brand/mark-path.ts", "MARK_PLATE_LEFT"),
    R: read("src/components/brand/mark-path.ts", "MARK_PLATE_RIGHT"),
  };
  mark.all = [mark.A, mark.BAR, mark.L, mark.R].join(" ");
  const flame = {
    outer: read("src/components/streak/flame-path.ts", "FLAME_OUTER"),
    middle: read("src/components/streak/flame-path.ts", "FLAME_MIDDLE"),
    core: read("src/components/streak/flame-path.ts", "FLAME_CORE"),
  };
  return { mark, flame };
}

/** Plus Jakarta Sans and JetBrains Mono, downloaded once into video-out/fonts with a local CSS. */
function ensureFonts() {
  const css = join(FONTS, "fonts.css");
  if (existsSync(css)) return;
  mkdirSync(FONTS, { recursive: true });
  const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
  const url = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=block";
  let text = execFileSync("curl", ["-sfL", "-A", ua, url], { encoding: "utf8" });
  let n = 0;
  text = text.replace(/url\((https:[^)]+\.woff2)\)/g, (_, u) => {
    const file = `f${n++}.woff2`;
    execFileSync("curl", ["-sfL", "-o", join(FONTS, file), u]);
    return `url(/video-out/fonts/${file})`;
  });
  writeFileSync(css, text);
  console.log(`fonts: ${n} files`);
}

/** Serves the repo root, so film.html, timeline.mjs and video-out assets load from one origin. */
function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

if (!args.includes("--skip-capture") || !existsSync(join(SRC, "meta.json"))) {
  console.log("capturing ABOT screens…");
  await capture(BASE, SRC);
}
ensureFonts();
const meta = JSON.parse(readFileSync(join(SRC, "meta.json"), "utf8"));
const server = await serve();
const origin = `http://localhost:${server.address().port}`;

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("film:", e.message));
await page.addInitScript((assets) => (window.ASSETS = assets), { src: "/video-out/frames-src", meta, ...readPaths() });
await page.goto(`${origin}/scripts/intro-video/film.html`);
await page.waitForFunction(() => window.ready !== undefined);
await page.evaluate(() => window.ready);
const canvas = page.locator("#film");

if (args.includes("--preview")) {
  // One frame from the middle-to-late part of each scene, as a contact sheet.
  const times = Object.values(SCENES).map(([a, b]) => a + (b - a) * 0.62);
  const files = [];
  for (const [i, t] of times.entries()) {
    await page.evaluate((x) => window.renderAt(x), t);
    const f = join(OUT, `preview-${i}.png`);
    await canvas.screenshot({ path: f });
    files.push(f);
  }
  const inputs = files.flatMap((f) => ["-i", f]);
  const filter = files.map((_, i) => `[${i}]scale=360:-1[v${i}]`).join(";") + ";" + files.map((_, i) => `[v${i}]`).join("") + `hstack=${files.length}`;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...inputs, "-filter_complex", filter, join(OUT, "abot-intro-preview.png")]);
  console.log("video-out/abot-intro-preview.png");
  await browser.close();
  server.close();
  process.exit(0);
}

console.log("soundtrack…");
const wav = join(OUT, "abot-intro.wav");
renderAudio(wav);

console.log("frames…");
const mp4 = join(OUT, "abot-intro.mp4");
const ff = spawn(
  "ffmpeg",
  [
    "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-i", wav,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    // Social apps play at about -14 LUFS; level the mix there, peaks under -1.5 dBTP.
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart",
    mp4,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const total = Math.round(DURATION * FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate((x) => window.renderAt(x), f / FPS);
  const jpg = await canvas.screenshot({ type: "jpeg", quality: 95 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 150 === 0) console.log(`  ${(f / FPS).toFixed(0)} s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
server.close();
console.log("video-out/abot-intro.mp4");
