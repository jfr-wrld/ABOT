import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("the built-in library: free-exercise-db photos offline, Atlas machines with the muscle map", async ({ page, context }) => {
  await page.goto("/exercises");
  await expect(page.getByText("1172 exercises", { exact: true })).toBeVisible();
  // No download to make any more.
  await expect(page.getByRole("button", { name: "Catalog", exact: true })).toHaveCount(0);
  await context.setOffline(true);
  const search = page.getByLabel("Search exercises");

  await search.fill("zercher");
  const zercher = page.getByRole("link", { name: /^Zercher Squats/ });
  await expect(zercher.locator('[data-thumb="photo"]')).toBeVisible();

  await search.fill("pendulum squat");
  const pendulum = page.getByRole("link", { name: /^Pendulum Squat \(Machine\)/ });
  await expect(pendulum.locator('[data-thumb="icon"]')).toBeVisible();
  // Offline in the browser also cuts the dev server off, so open the page online.
  await context.setOffline(false);
  await pendulum.click();
  await expect(page.getByRole("img", { name: /^Primary: / }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("a logged library exercise stays in history under its name", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Zercher Squats");
  await logSet(page, 1, "60", "5");
  await finishWorkout(page);
  await page.goto("/");
  await page.getByRole("link", { name: /300 kg/ }).click();
  await expect(page.getByRole("link", { name: "Zercher Squats" })).toBeVisible();
});
