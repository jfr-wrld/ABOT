import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout, choose, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

async function addGym(page: Page, name: string) {
  await page.getByLabel("New gym name").fill(name);
  await page.getByRole("button", { name: "Add gym" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test("machine records and previous sets are kept per gym", async ({ page }) => {
  await page.goto("/settings?section=gyms");
  await expect(page.getByText("No gyms yet.")).toBeVisible();
  await addGym(page, "Gym A");
  await addGym(page, "Gym B");
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await startEmptyWorkout(page);
  await expect(page.getByLabel("Gym", { exact: true })).not.toHaveText("No gym");
  await choose(page, page.getByLabel("Gym", { exact: true }), "Gym A");
  await addExercise(page, "Lat Pulldown (Cable)");
  await logSet(page, 1, "60", "10");
  await finishWorkout(page);

  await startEmptyWorkout(page);
  await choose(page, page.getByLabel("Gym", { exact: true }), "Gym B");
  await addExercise(page, "Lat Pulldown (Cable)");
  await expect(page.getByLabel("No previous set").first()).toBeVisible();
  await choose(page, page.getByLabel("Gym", { exact: true }), "Gym A");
  await expect(page.getByRole("button", { name: /^Previous 60 × 10/ })).toBeVisible();
});

test("per-hand dumbbell volume counts both hands", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Dumbbell)");
  await expect(page.getByText("kg/hand", { exact: true })).toBeVisible();
  await logSet(page, 1, "30", "10");
  await expect(page.locator("dd").nth(1)).toHaveText("600 kg");
});

test("bodyweight exercises accept added weight", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Pull Up");
  await expect(page.getByText("+kg", { exact: true })).toBeVisible();
  await page.getByLabel("Set 1 added weight in kg").fill("10");
  await page.getByLabel("Set 1 reps").fill("8");
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(page.locator("dd").nth(1)).toHaveText("80 kg");
});

test("custom exercise form sets the load mode", async ({ page }) => {
  await page.goto("/exercises");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Name").fill("Bayesian Curl");
  await choose(page, page.getByLabel("Equipment", { exact: true }).last(), "Dumbbell");
  await expect(page.getByLabel("Load")).toHaveText("Per hand (volume counts both)");
  await choose(page, page.getByLabel("Load"), "One side at a time (volume counts both sides)");
  await page.getByRole("button", { name: "Add to library" }).click();
  await startEmptyWorkout(page);
  await addExercise(page, "Bayesian Curl");
  await expect(page.getByText("kg/side", { exact: true })).toBeVisible();
});

test("a gym keeps a name, can be marked in pounds, and caps plates by the pairs it has", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /^Gyms/ }).click();
  await addGym(page, "Iron Barn");
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("");
  await expect(page.getByRole("alert").filter({ hasText: "A gym needs a name" })).toBeVisible();
  await name.blur();
  await expect(name).toHaveValue("Iron Barn");
  await expect(page.getByRole("heading", { name: "Iron Barn", exact: true })).toBeVisible();

  // Pounds: the 45 lb bar and the lb plates replace the kg set.
  await page.getByRole("radio", { name: "lb" }).click();
  await expect(page.getByRole("combobox", { name: "Bar" })).toContainText("45 lb");
  await expect(page.getByRole("button", { name: "45 lb", pressed: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // One pair of 45s: 225 lb takes one 45, then 35 + 25 + 10 + 5 a side.
  await page.getByLabel("Pairs of 45 lb").fill("1");
  await page.getByLabel("Pairs of 45 lb").blur();
  await page.goto("/settings");
  await page.getByRole("link", { name: /^General/ }).click();
  await page.getByText("lbs", { exact: true }).click();
  await waitForSavedSetting(page, "weightUnit", "lbs");
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await page.getByLabel("Set 1 weight in lbs").fill("225");
  await page.getByRole("button", { name: "Plate calculator for Squat (Barbell)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 × 45 lbs");
  await expect(dialog).toContainText("1 × 35 lbs");
});
