import { expect, test } from "@playwright/test";
import { addExercise, choose, freshStart, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page);
});

test("a plank is logged as a time, not weight and reps", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Plank");
  await expect(page.getByLabel("Set 1 reps")).toHaveCount(0);
  const time = page.getByLabel("Set 1 time, minutes and seconds");
  // Ticking with nothing typed asks for a time.
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(page.getByText("Enter a time before completing this set")).toBeVisible();
  // A plain number is seconds for a hold.
  await time.fill("45");
  await time.blur();
  await expect(time).toHaveValue("0:45");
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(page.getByRole("button", { name: "Set 1 done. Mark as not done" })).toBeVisible();
  // A new set (after the three a fresh exercise starts with) copies the last filled one.
  await page.getByRole("button", { name: "Add set" }).click();
  await expect(page.getByLabel("Set 4 time, minutes and seconds")).toHaveValue("0:45");
});

test("a custom cardio exercise logs distance and time", async ({ page }) => {
  await page.goto("/exercises");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Name").fill("Treadmill Run");
  await choose(page, page.getByLabel("Log as"), "Distance and time (run, row, bike)");
  await page.getByRole("button", { name: "Add to library" }).click();
  await startEmptyWorkout(page);
  await addExercise(page, "Treadmill Run");
  await page.getByLabel("Set 1 distance in km").fill("5");
  // A plain number is minutes for cardio.
  const time = page.getByLabel("Set 1 time, minutes");
  await time.fill("28:10");
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(page.getByRole("button", { name: "Set 1 done. Mark as not done" })).toBeVisible();
  await expect(time).toHaveValue("28:10");
});
