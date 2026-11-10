/**
 * Sample data for the README screenshots and the intro video: a backup file with 16 weeks of
 * Push / Pull / Legs (weights rising), three routines, a bodyweight log, a lean bulk and a
 * profile, and the import through Settings, done the way a person would.
 */
import { writeFileSync } from "node:fs";

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

export function buildBackup(now) {
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

/** A fresh start past the intro, then the sample backup replacing everything on this browser. */
export async function loadSampleData(page, base, backupFile, now = Date.now()) {
  writeFileSync(backupFile, JSON.stringify(buildBackup(now)));
  await page.goto(base + "/");
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem("abot.onboarded", "1");
    await new Promise((r) => {
      const q = indexedDB.deleteDatabase("abot");
      q.onsuccess = q.onerror = q.onblocked = () => r();
    });
  });
  await page.goto(base + "/settings?section=data");
  await page.getByLabel("Import backup").setInputFiles(backupFile);
  await page.getByRole("button", { name: "Replace all my data" }).click();
  await page.getByRole("button", { name: "Yes, replace everything" }).click();
  await page.getByRole("status").filter({ hasText: "Imported" }).waitFor();
}

/** Desktop Chromium has no share sheet; a phone does, so the studios show their phone state. */
export async function pretendPhoneShare(ctx) {
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: () => true });
    Object.defineProperty(navigator, "share", { value: async () => {} });
  });
}
