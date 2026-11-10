#!/usr/bin/env node
/**
 * The README screenshots, on the sample data from sample-data.mjs (imported through Settings like
 * a person would): each screen at 360 px (2x), written to docs/images/*.webp.
 *
 *   npm run dev            (in another terminal)
 *   node scripts/readme-screenshots.mjs [http://localhost:3000]
 *
 * Uses the preinstalled Playwright Chromium, and ffmpeg (libwebp) for the WebP files.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSampleData, pretendPhoneShare } from "./sample-data.mjs";

const BASE = process.argv[2] || process.env.ABOT_URL || "http://localhost:3000";
const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "docs/images");
const TMP = mkdtempSync(join(tmpdir(), "abot-shots-"));

/* ------------------------------------------------------------------ */
/* Capture                                                             */
/* ------------------------------------------------------------------ */

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 2, colorScheme: "dark" });
await pretendPhoneShare(ctx);
const page = await ctx.newPage();
const settle = (ms = 1800) => page.waitForTimeout(ms);

async function shot(name) {
  const png = join(TMP, `${name}.png`);
  await page.screenshot({ path: png });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", png, "-c:v", "libwebp", "-quality", "82", join(OUT, `${name}.webp`)]);
  console.log(`docs/images/${name}.webp`);
}

await loadSampleData(page, BASE, join(TMP, "sample-backup.json"));

await page.goto(BASE + "/");
await settle(3500);
await shot("home-dark");

await page.goto(BASE + "/profile");
await settle();
await shot("progress-dark");

await page.goto(BASE + "/phase");
await settle();
await shot("phase-dark");

// The newest workout from Home's recent list, then Story Studio from it.
await page.goto(BASE + "/");
await settle(2000);
await page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first().click();
await page.waitForURL(/\/history/);
await settle();
await page.getByRole("button", { name: "Share story" }).click();
await settle(2500);
await shot("story-studio");

// The week streak played again from Home, then its share studio.
await page.goto(BASE + "/");
await settle(2000);
await page.getByRole("button", { name: /-week streak$/ }).click();
await settle(2600);
await shot("streak-dark");
await page.getByRole("button", { name: "Share", exact: true }).click();
await settle(2200);
await shot("streak-share");

await page.emulateMedia({ colorScheme: "light" });
await page.goto(BASE + "/");
await settle(2500);
await shot("home-light");
await page.emulateMedia({ colorScheme: "dark" });

// A workout from the Push routine: two sets logged, rest skipped, the bar opened into shortcuts.
await page.goto(BASE + "/routines");
await settle();
await page.getByRole("button", { name: "Start Push Day" }).click();
await page.waitForURL(/\/workout/);
await settle();
for (const n of [1, 2]) {
  await page.getByRole("button", { name: `Mark Set ${n} done` }).first().click();
  await page.getByRole("button", { name: "Skip rest" }).click();
}
await page.getByRole("button", { name: /^Workout running/ }).click();
await settle(1500);
await shot("logger-dark");

await browser.close();
console.log("done");
