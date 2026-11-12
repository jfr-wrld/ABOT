import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout, choose, waitForSavedSetting, showPill, sortAndFilter } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("filters by muscle and equipment", async ({ page }) => {
  await page.goto("/exercises");
  await expect(page.getByText("873 exercises", { exact: true })).toBeVisible();
  await showPill(page, "Chest");
  await sortAndFilter(page, "Cable");
  await expect(page.getByRole("button", { name: "Sort and filter, 1 set" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Cable Fly/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bench Press/ })).toHaveCount(0);
  await page.getByLabel("Search exercises").fill("nothing like this");
  await expect(page.getByText("No exercise matches these filters.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("creates a custom exercise and opens its detail", async ({ page }) => {
  await page.goto("/exercises");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("button", { name: "Add to library" }).click();
  await expect(page.getByText("Enter a name of at least two characters")).toBeVisible();
  await page.getByLabel("Name").fill("Kroc Row Variation");
  await choose(page, page.getByLabel("Primary muscle"), "Back");
  await choose(page, page.getByLabel("Equipment", { exact: true }).last(), "Barbell");
  await page.getByRole("button", { name: "Add to library" }).click();
  // 873 with photos, plus the lifter's own.
  await expect(page.getByText("874 exercises", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Kroc Row Variation/ }).click();
  await expect(page.getByRole("heading", { name: "Kroc Row Variation" })).toBeVisible();
  await expect(page.getByText("No completed working sets yet.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("detail shows records after a finished workout", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "100", "5");
  await finishWorkout(page);
  await page.goto("/exercises/detail?id=squat-barbell");
  await expect(page.getByText("Heaviest weight")).toBeVisible();
  await expect(page.getByText("100 kg", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("One point so far.")).toBeVisible();
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByRole("tabpanel", { name: "History" }).getByText("100 kg × 5")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the Show row: All, My favorites and a muscle, one at a time", async ({ page }) => {
  await page.goto("/exercises");
  const pills = page.getByRole("group", { name: "Show" });
  await expect(pills.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await showPill(page, "My favorites");
  await expect(page.getByText("No favorites yet. Tap the star on an exercise to keep it here.")).toBeVisible();
  await showPill(page, "All");
  await page.getByRole("button", { name: "Favorite Bench Press (Barbell)" }).first().click();
  await showPill(page, "My favorites");
  await expect(pills.getByRole("button", { name: "My favorites" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /^Bench Press \(Barbell\)/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link")).toHaveCount(1);
  await showPill(page, "Calves");
  await expect(pills.getByRole("button", { name: "My favorites" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("link", { name: /^Bench Press \(Barbell\)/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("the exercise page shows the muscle and equipment with their icons", async ({ page }) => {
  await page.goto("/exercises/detail?id=bench-press-barbell");
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1, name: "Bench Press (Barbell)" }) });
  await expect(header.getByText("Chest", { exact: true })).toBeVisible();
  await expect(header.getByText("Barbell", { exact: true })).toBeVisible();
  await expect(header.locator("svg g[fill='var(--color-accent)']").first()).toBeAttached();
});

test("the library switches between list and grid and remembers it", async ({ page }) => {
  await page.goto("/exercises");
  await sortAndFilter(page, "Grid");
  await expect(page.getByRole("link", { name: /Bench Press \(Barbell\)/ }).first().locator('[data-thumb="photo"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.reload();
  await page.getByRole("button", { name: /^Sort and filter/ }).click();
  await expect(page.getByRole("dialog", { name: "Sort & filter" }).getByRole("radio", { name: "Grid" })).toHaveAttribute("aria-checked", "true");
});

test("library: records in the lifter's unit, favourites first, other orders, clear filters", async ({ page }) => {
  await page.goto("/settings?section=general");
  await page.getByText("lbs", { exact: true }).click();
  // Saved before the next page load reads it.
  await waitForSavedSetting(page, "weightUnit", "lbs");
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "225", "5");
  await finishWorkout(page);

  await page.goto("/exercises");
  const search = page.getByLabel("Search exercises");
  await search.fill("squat barbell");
  const squat = page.getByRole("link", { name: /^Squat \(Barbell\)/ });
  await expect(squat).toContainText("best 225 lbs × 5");
  await page.getByRole("button", { name: "Favorite Squat (Barbell)" }).click();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(search).toHaveValue("");

  await page.reload();
  const favs = page.getByRole("region", { name: "Favorites" });
  await expect(favs.getByRole("link", { name: /^Squat \(Barbell\)/ })).toBeVisible();

  await sortAndFilter(page, "Last done");
  await expect(page.getByRole("region", { name: "All exercises" }).getByRole("link").first()).toContainText("Squat (Barbell)");
  await expectNoHorizontalOverflow(page);
});
