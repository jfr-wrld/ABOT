import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("empty state on first run", async ({ page }) => {
  await page.goto("/progress");
  await expect(page.getByText("Charts fill in as you finish workouts.")).toBeVisible();
  await expect(page.getByText(/Nothing in the last 8 weeks yet/).first()).toBeVisible();
  await expect(page.getByText("No working sets in this range.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("charts render after a workout", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.goto("/progress");
  await expect(page.getByText(/1 workout logged/)).toBeVisible();
  const volume = page.getByRole("figure").filter({ hasText: "Volume per week" });
  await expect(volume.locator("svg.recharts-surface")).toBeVisible();
  await volume.getByText("Show as table").click();
  await expect(volume.locator("tbody tr")).toHaveCount(8);
  const split = page.getByRole("figure").filter({ hasText: "Sets per muscle" });
  await expect(split.getByText("Chest")).toBeVisible();
  await page.getByRole("button", { name: "Last 4 weeks" }).click();
  await expect(page.getByText("Sets per muscle, last 4 weeks")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("calendar moves months and links a day to its workout", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.goto("/progress");
  const cal = page.locator("section").filter({ has: page.getByRole("grid") });
  const monthHeading = cal.getByRole("heading", { level: 2 });
  const before = await monthHeading.textContent();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(monthHeading).not.toHaveText(before ?? "");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(monthHeading).toHaveText(before ?? "");
  await page.getByRole("gridcell", { name: /1 workout/ }).click();
  await cal.getByRole("link").first().click();
  await page.waitForURL(/\/history\//);
});
