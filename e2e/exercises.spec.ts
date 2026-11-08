import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("filters by muscle and equipment", async ({ page }) => {
  await page.goto("/exercises");
  await expect(page.getByText("81 in your library")).toBeVisible();
  await page.getByLabel("Muscle group").selectOption("chest");
  await page.getByLabel("Equipment").selectOption("cable");
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
  await page.getByLabel("Primary muscle").selectOption("back");
  await page.getByLabel("Equipment", { exact: true }).last().selectOption("barbell");
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
