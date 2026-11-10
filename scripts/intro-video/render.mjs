#!/usr/bin/env node
/**
 * Renders the ABOT intro video: 1080 x 1920, 30 fps, about 104 s, with its synthesised soundtrack.
 *
 *   npm run dev                                   (in another terminal)
 *   node scripts/intro-video/render.mjs [http://localhost:3000] [--skip-capture] [--preview]
 *
 * 1. capture.mjs: real ABOT screens on the sample data (skip with --skip-capture to reuse them).
 * 2. audio.mjs: the soundtrack from timeline.mjs's cues.
 * 3. film.js: every frame drawn by renderAt(t) in Playwright, piped to ffmpeg with the audio.
 * --preview renders only a contact sheet of key moments (video-out/abot-intro-preview.png).
 * Voice-over: put the take at video-out/vo.mp3; timeline.mjs's VO table places its lines and the
 * soundtrack ducks under them. Without the file the video renders with music and effects only.
 * Output: video-out/abot-intro.mp4 (git-ignored). Needs ffmpeg (libx264, aac) and curl.
 */
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { capture } from "./capture.mjs";
import { renderAudio } from "./audio.mjs";
import { DURATION, FPS, SCENES, VO } from "./timeline.mjs";

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

/** Plus Jakarta Sans, JetBrains Mono and Anton (meme captions), downloaded once into video-out/fonts. */
function ensureFonts() {
  const css = join(FONTS, "fonts.css");
  if (existsSync(css) && readFileSync(css, "utf8").includes("Anton")) return;
  mkdirSync(FONTS, { recursive: true });
  const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
  const url = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Anton&display=block";
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

/**
 * The audio filter. Each voice line is cut from the take with a little air either side, faded at
 * the cuts so they do not click, and delayed to its place. The soundtrack ducks about 6 dB while
 * the voice speaks (sidechain), then the whole mix is mastered.
 */
const VO_FILE = join(OUT, "vo.mp3");
const hasVo = existsSync(VO_FILE);
// Social apps play at about -14 LUFS. The 15 kHz low-pass comes first: AAC cuts there anyway, and
// cutting the synth's bright clicks inside the encoder made them ring about 3 dB over the limiter.
const master = "lowpass=f=15000,loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.8:level=false";
let audioArgs;
if (hasVo) {
  const pre = 0.08;
  const post = 0.15;
  const lines = VO.map(({ src: [a, b], at }, i) => {
    const len = b - a + pre + post;
    const delay = Math.round(Math.max(0, at - pre) * 1000);
    return `[v${i}]atrim=start=${Math.max(0, a - pre)}:end=${b + post},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${(len - 0.06).toFixed(3)}:d=0.06,adelay=${delay}|${delay}[l${i}]`;
  });
  const filter = [
    `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=${VO.length}${VO.map((_, i) => `[v${i}]`).join("")}`,
    ...lines,
    `${VO.map((_, i) => `[l${i}]`).join("")}amix=inputs=${VO.length}:normalize=0,volume=1.6[vo]`,
    "[vo]asplit[vomix][vokey]",
    "[1:a][vokey]sidechaincompress=threshold=0.02:ratio=4:attack=15:release=350:makeup=1[bed]",
    `[bed][vomix]amix=inputs=2:normalize=0,${master}[mix]`,
  ].join(";");
  audioArgs = ["-i", VO_FILE, "-filter_complex", filter, "-map", "0:v", "-map", "[mix]"];
} else {
  audioArgs = ["-af", master];
}
console.log(hasVo ? "voice-over: video-out/vo.mp3" : "no voice-over (video-out/vo.mp3 missing)");

console.log("frames…");
const mp4 = join(OUT, "abot-intro.mp4");
const ff = spawn(
  "ffmpeg",
  [
    "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-i", wav,
    ...audioArgs,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
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
