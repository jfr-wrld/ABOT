import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await freshStart(page);
});

test("all workouts: reached from Home, searchable by exercise, filtered by focus", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "80", "5");
  await finishWorkout(page);

  await page.getByRole("link", { name: "See all" }).click();
  await page.waitForURL("**/history/all");
  await expect(page.getByRole("heading", { name: "All workouts" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "2 workouts" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Search workouts").fill("squat");
  await expect(page.getByText("1 of 2 workouts")).toBeVisible();
  await page.getByLabel("Search workouts").fill("");

  await page.getByRole("group", { name: "Filter by focus" }).getByRole("button", { name: "Push" }).click();
  await expect(page.getByText("1 of 2 workouts")).toBeVisible();

  await page.getByLabel("Search workouts").fill("deadlift");
  await expect(page.getByText("No workout matches. Try another name, or clear the filters.")).toBeVisible();
});
