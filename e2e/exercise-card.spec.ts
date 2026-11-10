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
  await page.getByRole("region", { name: "Recent workouts" }).getByRole("list").getByRole("link").first().click();
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

test("an added set starts with the last set's numbers", async ({ page }) => {
  await page.getByRole("button", { name: "Options for Pull Up" }).press("Escape").catch(() => {});
  await logSet(page, 1, null, "8");
  await page.getByRole("button", { name: "Skip rest" }).click();
  // Sets 2 and 3 are still empty: the new set copies set 1, not the empty row above it.
  await page.getByRole("button", { name: "Add set" }).click();
  await expect(page.getByLabel("Set 4 reps")).toHaveValue("8");
});

test("a set is removed by swiping it left; a short swipe springs back", async ({ page }) => {
  const row = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Mark Set 2 done" }) });
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  const swipe = async (dx: number) => {
    // Start on the Prev column: a swipe that starts in a number field types instead.
    const from = box.x + 70;
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(from - dx, y, { steps: 12 });
    await page.waitForTimeout(50);
    await page.mouse.up();
  };
  await swipe(40);
  await expect(page.getByRole("button", { name: "Mark Set 2 done" })).toBeVisible();
  // Past a third of the row's width.
  await swipe(box.width * 0.5);
  // Three sets became two (the last one is now Set 2).
  await expect(page.getByRole("button", { name: "Mark Set 3 done" })).toBeHidden();
  await expect(page.getByRole("button", { name: /^Mark Set \d done$/ })).toHaveCount(2);
});

test("the exercise picker switches to a grid of photos and filters with muscle icons", async ({ page }) => {
  await page.getByRole("button", { name: "Add exercise" }).first().click();
  const picker = page.getByRole("dialog", { name: "Add exercise" });
  await picker.getByRole("button", { name: "Grid view" }).click();
  await expect(picker.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: /Chest/ }).first().click();
  await expect(picker.getByRole("button", { name: /^Bench Press \(Barbell\)/ })).toBeVisible();
});
