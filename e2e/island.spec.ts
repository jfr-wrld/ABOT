import { expect, test } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout } from "./helpers";

test("the workout bar names the set and opens into shortcuts", async ({ page }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Skip rest" }).click();

  await page.goto("/");
  const bar = page.getByRole("button", { name: /^Workout running/ });
  await expect(bar).toHaveAccessibleName(/Bench Press \(Barbell\), Set 2 of 3 · last 60 kg × 8$/);
  await expect(bar).toContainText("1/3 sets");

  await bar.click();
  const shortcuts = page.getByRole("group", { name: "Workout shortcuts" });
  await shortcuts.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: /^Workout paused/ })).toBeVisible();
  await shortcuts.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: /^Workout running/ })).toBeVisible();

  await shortcuts.getByRole("button", { name: "Add set" }).click();
  await expect(bar).toContainText("1/4 sets");

  // Ticks set 2 with the numbers the bar showed, and rest starts.
  await shortcuts.getByRole("button", { name: "Done set" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await expect(page.getByRole("button", { name: /^Workout running/ })).toContainText("2/4 sets");

  await page.getByRole("button", { name: /^Workout running/ }).click();
  await page.getByRole("link", { name: "Open the workout in progress" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByLabel("Set 2 reps").first()).toHaveValue("8");
  await expect(page.getByRole("group", { name: "Workout shortcuts" })).toHaveCount(0);
});
