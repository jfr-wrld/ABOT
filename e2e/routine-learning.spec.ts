import { expect, test } from "@playwright/test";
import { addExercise, freshStart, logSet, reachSummary, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page);
});

test("a heavier workout from a routine offers to update the routine", async ({ page }) => {
  // A routine made from a first workout: bench 60 x 8.
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);
  await page.getByRole("button", { name: "Save as routine" }).click();
  await page.getByRole("link", { name: "Back to Home" }).click();

  // Started from the routine, lifted heavier.
  await page.getByRole("button", { name: /^Start Chest/ }).first().click();
  await page.waitForURL("**/workout");
  await logSet(page, 1, "62.5", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);

  await expect(page.getByRole("heading", { name: /^Update .+\?$/ })).toBeVisible();
  await expect(page.getByText("new targets for 1 lift")).toBeVisible();
  await page.getByRole("button", { name: "Update routine" }).click();
  await expect(page.getByRole("link", { name: /updated · Open$/ })).toBeVisible();
});

test("warm-up sets ramp to the working weight on the gym's plates", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByLabel(/^Set 1 weight in /).first().fill("100");
  await page.getByRole("button", { name: "Add 4 warm-up sets up to 80 kg" }).click();
  // Bar, 40, 60, 80 kg, then the working sets; the button goes once warm-ups are in.
  const warm = page.getByLabel(/^Warm-up set weight in /);
  await expect(warm).toHaveCount(4);
  await expect(warm.first()).toHaveValue("20");
  await expect(warm.last()).toHaveValue("80");
  await expect(page.getByRole("button", { name: /warm-up sets up to/ })).toHaveCount(0);
});
