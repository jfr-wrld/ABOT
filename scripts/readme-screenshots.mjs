#!/usr/bin/env node
/**
 * The README screenshots, on sample data. Builds a backup file (16 weeks of Push / Pull / Legs
 * with weights rising, three routines, a bodyweight log, a lean bulk and a profile), imports it
 * through Settings like a person would, then captures each screen at 360 px (2x) and writes
 * docs/images/*.webp.
 *
 *   npm run dev            (in another terminal)
 *   node scripts/readme-screenshots.mjs [http://localhost:3000]
 *
 * Uses the preinstalled Playwright Chromium, and ffmpeg (libwebp) for the WebP files.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] || process.env.ABOT_URL || "http://localhost:3000";
const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "docs/images");
const TMP = mkdtempSync(join(tmpdir(), "abot-shots-"));

const DAY = 86_400_000;
let seq = 0;
const id = (p) => `${p}-${(++seq).toString(36)}`;

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

const PLAN = {
  Push: [
    ["bench-press-barbell", 60, 8, 4],
    ["overhead-press-barbell", 35, 8, 3],
    ["incline-bench-press-dumbbell", 22, 10, 3],
    ["lateral-raise-dumbbell", 8, 15, 3],
    ["triceps-pushdown-cable", 25, 12, 3],
  ],
  Pull: [
    ["deadlift-barbell", 100, 5, 3],
    ["lat-pulldown-cable", 50, 10, 3],
    ["seated-row-cable", 45, 10, 3],
    ["face-pull-cable", 20, 15, 3],
    ["bicep-curl-dumbbell", 12, 12, 3],
  ],
  Legs: [
    ["squat-barbell", 80, 6, 4],
    ["romanian-deadlift-barbell", 70, 8, 3],
    ["leg-press-machine", 140, 10, 3],
    ["leg-curl-machine", 35, 12, 3],
    ["standing-calf-raise-machine", 60, 15, 3],
  ],
};
const NAMES = { Push: "Push Day", Pull: "Pull Day", Legs: "Leg Day" };

function startOfWeek(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function buildBackup(now) {
  const weeks = 16;
  const sessions = [];
  const firstWeek = startOfWeek(now) - (weeks - 1) * 7 * DAY;
  for (let w = 0; w < weeks; w++) {
    // Monday Push, Wednesday Pull, Friday Legs; this week only what is already over.
    [
      ["Push", 0],
      ["Pull", 2],
      ["Legs", 4],
    ].forEach(([day, offset]) => {
      const start = firstWeek + w * 7 * DAY + offset * DAY + 18 * 3_600_000;
      if (start > now - 2 * 3_600_000) return;
      let t = start + 4 * 60_000;
      const exercises = PLAN[day].map(([exerciseId, base, reps, n]) => ({
        id: id("se"),
        exerciseId,
        restSeconds: 120,
        sets: Array.from({ length: n }, (_, i) => {
          t += 150_000;
          // Weight rises every third week; the last set of the day is a rep short.
          const weightKg = Math.round((base + Math.floor(w / 3) * (base >= 60 ? 5 : 2.5)) * 2) / 2;
          return { id: id("s"), type: "normal", weightKg, reps: i === n - 1 ? reps - 1 : reps, rpe: i === n - 1 ? 8.5 : null, completed: true, completedAt: t };
        }),
      }));
      sessions.push({ id: id("w"), name: NAMES[day], startedAt: start, finishedAt: t + 60_000, status: "completed", exercises });
    });
  }

  const created = firstWeek - 3 * DAY;
  const routines = Object.entries(PLAN).map(([day, lifts]) => ({
    id: id("r"),
    name: NAMES[day],
    folder: "Push / Pull / Legs",
    createdAt: created,
    updatedAt: created,
    exercises: lifts.map(([exerciseId, base, reps, n]) => ({
      id: id("re"),
      exerciseId,
      restSeconds: 120,
      // Targets at the latest weights, as a lifter keeps them.
      sets: Array.from({ length: n }, () => ({
        id: id("rs"),
        type: "normal",
        targetWeightKg: Math.round((base + Math.floor((weeks - 1) / 3) * (base >= 60 ? 5 : 2.5)) * 2) / 2,
        targetReps: reps,
      })),
    })),
  }));

  // A lean bulk: a weigh-in most days, the trend rising about 0.25 kg a week.
  const bodyweightLog = [];
  for (let d = 112; d >= 1; d--) {
    if (d % 3 === 1) continue;
    const date = new Date(now - d * DAY);
    date.setHours(7, 30, 0, 0);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const kg = 70.6 + ((112 - d) / 7) * 0.22 + Math.sin(d * 1.7) * 0.35;
    bodyweightLog.push({ id: day, date: date.getTime(), weightKg: Math.round(kg * 10) / 10 });
  }
  const phaseStart = new Date(now - 5 * 7 * DAY);
  const startDate = `${phaseStart.getFullYear()}-${String(phaseStart.getMonth() + 1).padStart(2, "0")}-${String(phaseStart.getDate()).padStart(2, "0")}`;

  return {
    app: "ABOT",
    schemaVersion: 1,
    exportedAt: new Date(now).toISOString(),
    data: {
      sessions,
      routines,
      exercises: [],
      locations: [],
      activeWorkout: null,
      exerciseMedia: {},
      bodyweightLog,
      settings: {
        weightUnit: "kg",
        firstDayOfWeek: 1,
        profileName: "Raka Pratama",
        profileHandle: "rakalifts",
        language: "en",
        theme: "system",
        visualEffects: "full",
        bodyweightKg: 74,
        heightCm: 175,
        bodyPhase: {
          id: "phase-sample",
          phaseType: "BULKING",
          title: "LEAN BULK // 12 WEEKS",
          startDate,
          durationWeeks: 12,
          startWeightKg: 72.4,
          targetWeightKg: 75.4,
          heightCm: 175,
          age: 27,
          biologicalSex: "male",
          activityMultiplier: 1.45,
          weeklyRatePercent: 0.35,
          isActive: true,
        },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Capture                                                             */
/* ------------------------------------------------------------------ */

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const backupFile = join(TMP, "sample-backup.json");
writeFileSync(backupFile, JSON.stringify(buildBackup(Date.now())));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 2, colorScheme: "dark" });
// Desktop Chromium has no share sheet; the phone does, so the studios show their phone state.
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, "canShare", { value: () => true });
  Object.defineProperty(navigator, "share", { value: async () => {} });
});
const page = await ctx.newPage();
const settle = (ms = 1800) => page.waitForTimeout(ms);

async function shot(name) {
  const png = join(TMP, `${name}.png`);
  await page.screenshot({ path: png });
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", png, "-c:v", "libwebp", "-quality", "82", join(OUT, `${name}.webp`)]);
  console.log(`docs/images/${name}.webp`);
}

// A fresh start past the intro, then the sample backup replacing everything.
await page.goto(BASE + "/");
await page.evaluate(async () => {
  localStorage.clear();
  localStorage.setItem("abot.onboarded", "1");
  await new Promise((r) => {
    const q = indexedDB.deleteDatabase("abot");
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
});
await page.goto(BASE + "/settings?section=data");
await page.getByLabel("Import backup").setInputFiles(backupFile);
await page.getByRole("button", { name: "Replace all my data" }).click();
await page.getByRole("button", { name: "Yes, replace everything" }).click();
await page.getByRole("status").filter({ hasText: "Imported" }).waitFor();

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
