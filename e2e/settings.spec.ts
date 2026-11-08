import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("switching to lbs changes the logger label and header unit", async ({ page }) => {
  await page.goto("/settings");
  await expectNoHorizontalOverflow(page);
  await page.getByText("lbs", { exact: true }).click();
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "135", "5");
  await expect(page.locator("dd").nth(1)).toHaveText("675 lbs");
  await expect(page.getByLabel("Set 1 weight in lbs")).toBeVisible();
});

test("RPE toggle hides the RPE column", async ({ page }) => {
  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: "Show RPE column in the logger" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await expect(page.getByLabel(/RPE, 6 to 10/)).toHaveCount(0);
});
