import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout, choose } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("filters by muscle and equipment", async ({ page }) => {
  await page.goto("/exercises");
  await expect(page.getByText("81 in your library")).toBeVisible();
  await choose(page, page.getByLabel("Muscle group"), "Chest");
  await choose(page, page.getByLabel("Equipment"), "Cable");
  await expect(page.getByRole("link", { name: /Cable Fly/ })).toBeVisible();
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
  await page.getByLabel("Name").fill("Pendlay Row");
  await choose(page, page.getByLabel("Primary muscle"), "Back");
  await choose(page, page.getByLabel("Equipment", { exact: true }).last(), "Barbell");
  await page.getByRole("button", { name: "Add to library" }).click();
  await expect(page.getByText("82 in your library")).toBeVisible();
  await page.getByRole("link", { name: /Pendlay Row/ }).click();
  await expect(page.getByRole("heading", { name: "Pendlay Row" })).toBeVisible();
  await expect(page.getByText("No completed working sets yet.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("detail shows records after a finished workout", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "100", "5");
  await finishWorkout(page);
  await page.goto("/exercises/squat-barbell");
  await expect(page.getByText("Heaviest weight")).toBeVisible();
  await expect(page.getByText("100 kg", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("One point so far.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
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
  await page.goto("/exercises/bench-press-barbell");
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1, name: "Bench Press (Barbell)" }) });
  await expect(header.getByText("Chest", { exact: true })).toBeVisible();
  await expect(header.getByText("Barbell", { exact: true })).toBeVisible();
  await expect(header.locator("svg g[fill='#ccff00']").first()).toBeAttached();
});
