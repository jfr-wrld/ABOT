import { expect, type Page } from "@playwright/test";
import type { BodyweightEntry, Routine, WorkoutSession, WorkoutSet } from "@/types/workout";
import type { StoredSettings } from "@/data/repo/types";
import { freshStart } from "./helpers";

/**
 * What a test needs on the device before it starts: history, routines, settings (an active
 * body phase lives in settings.bodyPhase), weigh-ins. Written straight into the app's IndexedDB,
 * so a test about the summary or the recovery map does not first log a workout through the UI.
 */
export interface Seed {
  sessions?: WorkoutSession[];
  routines?: Routine[];
  /** Merged over the defaults on load, so only the fields the test cares about. */
  settings?: Partial<StoredSettings>;
  bodyweightLog?: BodyweightEntry[];
}

const DAY = 86_400_000;

/**
 * Starts from a clean device (freshStart, so the app has created its database), writes the seed
 * from a static file on the same origin (no app running, so nothing writes over it), then opens
 * Home with the seeded data loaded.
 */
export async function seedDb(page: Page, seed: Seed): Promise<void> {
  await freshStart(page);
  await page.goto("/globe.svg");
  await page.evaluate(async (s) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("abot");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(["sessions", "routines", "kv"], "readwrite");
    for (const x of s.sessions ?? []) tx.objectStore("sessions").put(x);
    for (const x of s.routines ?? []) tx.objectStore("routines").put(x);
    if (s.settings) tx.objectStore("kv").put({ key: "settings", value: s.settings });
    if (s.bodyweightLog) tx.objectStore("kv").put({ key: "bodyweightLog", value: s.bodyweightLog });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, seed);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "ABOT" })).toBeVisible();
}

let n = 0;
const id = (p: string) => `${p}-seed-${++n}`;

/** A finished workout `daysAgo` days back: each exercise as [kg, reps] working sets. */
export function finishedSession(
  exercises: Record<string, [number, number][]>,
  opts: { daysAgo?: number; name?: string; routineId?: string; now?: number } = {},
): WorkoutSession {
  const startedAt = (opts.now ?? Date.now()) - (opts.daysAgo ?? 1) * DAY;
  return {
    id: id("session"),
    name: opts.name ?? "Seeded workout",
    ...(opts.routineId ? { routineId: opts.routineId } : {}),
    startedAt,
    finishedAt: startedAt + 45 * 60_000,
    status: "completed",
    exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({
      id: id("item"),
      exerciseId,
      restSeconds: 90,
      sets: sets.map(([weightKg, reps], i): WorkoutSet => ({
        id: id("set"),
        type: "normal",
        weightKg,
        reps,
        rpe: null,
        completed: true,
        completedAt: startedAt + (i + 1) * 3 * 60_000,
      })),
    })),
  };
}
