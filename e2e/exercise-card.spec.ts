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

test("the header's muscle map fills in as sets are ticked", async ({ page }) => {
  const map = page.getByRole("button", { name: /^Muscles worked: / });
  await expect(map).toHaveAccessibleName("Muscles worked: none yet. Show map");
  await logSet(page, 1, null, "8");
  await expect(map).toHaveAccessibleName("Muscles worked: Lats. Show map");
  await map.click();
  const sheet = page.getByRole("dialog", { name: "Muscles worked" });
  await expect(sheet.locator('[data-region="upper-back"][data-level="primary"]').first()).toBeVisible();
  await expect(sheet.getByRole("listitem").filter({ hasText: "Biceps" })).toBeVisible();
});
