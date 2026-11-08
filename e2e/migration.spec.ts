import { expect, test } from "@playwright/test";
import { freshStart } from "./helpers";

test("workouts saved by the localStorage version appear after upgrading", async ({ page }) => {
  await freshStart(page);
  await page.evaluate(async () => {
    const session = {
      id: "legacy-1",
      name: "Legacy Leg Day",
      startedAt: Date.now() - 86_400_000,
      finishedAt: Date.now() - 86_400_000 + 3_600_000,
      status: "completed",
      exercises: [
        {
          id: "e",
          exerciseId: "squat-barbell",
          restSeconds: 90,
          sets: [{ id: "s", type: "normal", weightKg: 100, reps: 5, rpe: null, completed: true }],
        },
      ],
    };
    localStorage.setItem("heavy.workouts", JSON.stringify({ state: { sessions: [session], active: null, restTimer: null }, version: 0 }));
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("abot");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByText("Legacy Leg Day")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Legacy Leg Day")).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("heavy.workouts"))).not.toBeNull();
});
