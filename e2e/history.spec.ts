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
  // The first time a lift is logged it sets no record worth a badge: there was nothing to beat.
  await expect(page.getByText("PR", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  // Delete sits behind the options menu, away from the thumb's path.
  await page.getByRole("button", { name: "Workout options" }).click();
  await page.getByRole("button", { name: "Delete this workout" }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Workout options" }).click();
  await page.getByRole("button", { name: "Delete this workout" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("No workouts yet.")).toBeVisible();
});

test("a past workout can be repeated, its sets folded, and has no dock", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.getByRole("link", { name: /480 kg/ }).click();
  await page.waitForURL(/\/history\//);
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Primary: Chest/ })).toBeVisible();

  const fold = page.getByRole("button", { name: "Hide sets of Bench Press (Barbell)" });
  await fold.click();
  await expect(page.getByText("60 kg × 8")).toHaveCount(0);
  await page.getByRole("button", { name: "Show sets of Bench Press (Barbell)" }).click();
  await expect(page.getByText("60 kg × 8")).toBeVisible();

  await page.getByRole("button", { name: "Repeat" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByLabel("Set 1 weight in kg")).toHaveValue("60");
  await expect(page.getByLabel("Set 1 reps")).toHaveValue("8");
});

test("unknown workout id shows a not-found message", async ({ page }) => {
  await page.goto("/history/does-not-exist");
  await expect(page.getByRole("heading", { name: "Workout not found" })).toBeVisible();
});
