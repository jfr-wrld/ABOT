import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout, choose } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("filters by muscle and equipment", async ({ page }) => {
  await page.goto("/exercises");
  await expect(page.getByText("1172 exercises")).toBeVisible();
  await choose(page, page.getByLabel("Muscle group"), "Chest");
  await choose(page, page.getByLabel("Equipment"), "Cable");
  await expect(page.getByRole("link", { name: /^Cable Fly/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Low to High Cable Fly/ })).toBeVisible();
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
  await expect(page.getByText("1173 exercises")).toBeVisible();
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

test("the filter dropdowns work from the keyboard and match the theme", async ({ page }) => {
  await freshStart(page);
  await page.goto("/exercises");
  const muscle = page.getByLabel("Muscle group");
  await muscle.focus();
  await page.keyboard.press("ArrowDown");
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  await expect(list.getByRole("option", { name: "All muscles" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("c"); // jumps to the next option starting with C
  await page.keyboard.press("Enter");
  await expect(list).toHaveCount(0);
  await expect(muscle).toHaveText("Chest");
  await expect(muscle).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(muscle).toHaveText("Chest");
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
  const grid = page.getByRole("button", { name: "Grid view" });
  await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
  await grid.click();
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Bench Press \(Barbell\)/ }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
});

test("library: records in the lifter's unit, favourites first, other orders, clear filters", async ({ page }) => {
  await page.goto("/settings?section=general");
  await page.getByText("lbs", { exact: true }).click();
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

  await choose(page, page.getByLabel("Order"), "Last done");
  await expect(page.getByRole("region", { name: "All exercises" }).getByRole("link").first()).toContainText("Squat (Barbell)");
  await expectNoHorizontalOverflow(page);
});
