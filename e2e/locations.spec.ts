import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

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
  await page.goto("/settings");
  await expect(page.getByText("No gyms yet.")).toBeVisible();
  await addGym(page, "Gym A");
  await addGym(page, "Gym B");
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await startEmptyWorkout(page);
  await expect(page.getByLabel("Gym")).toHaveValue(/.+/);
  await page.getByLabel("Gym").selectOption({ label: "Gym A" });
  await addExercise(page, "Lat Pulldown (Cable)");
  await logSet(page, 1, "60", "10");
  await finishWorkout(page);

  await startEmptyWorkout(page);
  await page.getByLabel("Gym").selectOption({ label: "Gym B" });
  await addExercise(page, "Lat Pulldown (Cable)");
  await expect(page.getByLabel("No previous set").first()).toBeVisible();
  await page.getByLabel("Gym").selectOption({ label: "Gym A" });
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
  await page.getByLabel("Name").fill("Spider Curl");
  await page.getByLabel("Equipment", { exact: true }).last().selectOption("dumbbell");
  await expect(page.getByLabel("Load")).toHaveValue("per_hand");
  await page.getByLabel("Load").selectOption("unilateral");
  await page.getByRole("button", { name: "Add to library" }).click();
  await startEmptyWorkout(page);
  await addExercise(page, "Spider Curl");
  await expect(page.getByText("kg/side", { exact: true })).toBeVisible();
});
