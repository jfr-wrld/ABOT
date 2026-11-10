import { expect, test } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Pull Up");
});

test("a variation is chosen on the card and kept in history", async ({ page }) => {
  await page.getByRole("button", { name: "Choose a variation" }).click();
  const sheet = page.getByRole("dialog", { name: "Variation for Pull Up" });
  await sheet.getByRole("radio", { name: "Neutral grip" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "Variation: Neutral grip. Change" })).toBeVisible();

  await logSet(page, 1, null, "8");
  await finishWorkout(page);
  await page.goto("/");
  await page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first().click();
  await expect(page.getByText(/Bodyweight · Neutral grip · 1 set/)).toBeVisible();
});

test("a note shows on the card", async ({ page }) => {
  await page.getByRole("button", { name: "Add a note for Pull Up" }).click();
  const sheet = page.getByRole("dialog", { name: "Note for Pull Up" });
  await sheet.getByLabel("Notes for this exercise").fill("Band 2 for the last set");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Note for Pull Up: Band 2 for the last set. Edit" })).toBeVisible();
});

test("a finished exercise shows the muscles it worked", async ({ page }) => {
  const muscles = page.getByRole("region", { name: "Muscles worked by Pull Up" });
  for (const n of [1, 2]) await logSet(page, n, null, "8");
  await expect(muscles).toBeHidden();
  await logSet(page, 3, null, "8");
  await expect(muscles).toBeVisible();
  await expect(muscles.locator('[data-region="upper-back"][data-level="primary"]').first()).toBeVisible();
  // Unticking a set hides it again.
  await page.getByRole("button", { name: /Set 3 done\. Mark as not done/ }).click();
  await expect(muscles).toBeHidden();
});
