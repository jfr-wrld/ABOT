import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("search reads short forms, Indonesian words and a typo", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  const search = dialog.getByLabel("Search exercises");
  await search.fill("db bench");
  await expect(dialog.getByRole("button", { name: /^Bench Press \(Dumbbell\)/ })).toBeVisible();
  await search.fill("benhc press");
  await expect(dialog.getByRole("button", { name: /^Bench Press \(Barbell\)/ })).toBeVisible();
  await search.fill("dada dumbel");
  await expect(dialog.getByRole("button", { name: /^Bench Press \(Dumbbell\)/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("check several, add them in the order checked; a plain tap still adds one", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  const search = dialog.getByLabel("Search exercises");
  for (const name of ["Squat (Barbell)", "Leg Press (Machine)", "Leg Extension (Machine)"]) {
    await search.fill(name);
    await dialog.getByRole("button", { name: `Select ${name}` }).first().click();
  }
  await dialog.getByRole("button", { name: "Add 3 exercises" }).click();
  await expect(page.getByRole("heading", { name: "Leg Extension (Machine)", exact: true })).toBeVisible();
  const names = await page.getByRole("heading").filter({ hasText: /^(Squat \(Barbell\)|Leg Press \(Machine\)|Leg Extension \(Machine\))$/ }).allTextContents();
  expect(names).toEqual(["Squat (Barbell)", "Leg Press (Machine)", "Leg Extension (Machine)"]);
  // One tap, one exercise, as before.
  await addExercise(page, "Plank");
});

test("filters by equipment, clears filters, and creates what is missing", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("group", { name: "Filter by equipment" }).getByRole("button", { name: "Kettlebell" }).click();
  await expect(dialog.getByRole("button", { name: /^Kettlebell Swing/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Bench Press \(Barbell\)/ })).toHaveCount(0);
  await dialog.getByLabel("Search exercises").fill("zzqx");
  await dialog.getByRole("button", { name: "Clear filters" }).click();
  await expect(dialog.getByLabel("Search exercises")).toHaveValue("");

  await dialog.getByLabel("Search exercises").fill("Kroc Row Special");
  await dialog.getByRole("button", { name: "Create “Kroc Row Special”" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kroc Row Special");
  await page.getByRole("button", { name: "Add to library" }).click();
  await expect(page.getByRole("heading", { name: "Kroc Row Special", exact: true })).toBeVisible();
});

test("recent exercises and favourites lead the picker", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Hammer Curl (Dumbbell)");
  await logSet(page, 1, "14", "10");
  await finishWorkout(page);

  await page.goto("/exercises/detail?id=squat-barbell");
  await page.getByRole("button", { name: "Favorite Squat (Barbell)" }).click();
  await waitForSavedSetting(page, "favoriteExercises", ["squat-barbell"]);

  await startEmptyWorkout(page);
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("region", { name: "Favorites" }).getByRole("button", { name: /^Squat \(Barbell\)/ })).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Recent" }).getByRole("button", { name: /^Hammer Curl \(Dumbbell\)/ })).toBeVisible();
});
