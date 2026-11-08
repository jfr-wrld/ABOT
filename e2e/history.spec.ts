import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("opens a finished workout from home and deletes it", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.getByRole("link", { name: /480 kg/ }).click();
  await page.waitForURL(/\/history\//);
  await expect(page.getByRole("link", { name: "Bench Press (Barbell)" })).toBeVisible();
  await expect(page.getByText("60 kg × 8")).toBeVisible();
  await expect(page.getByText(/personal record/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Delete this workout" }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Delete this workout" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("Nothing logged yet.")).toBeVisible();
});

test("unknown workout id shows a not-found message", async ({ page }) => {
  await page.goto("/history/does-not-exist");
  await expect(page.getByRole("heading", { name: "Workout not found" })).toBeVisible();
});
