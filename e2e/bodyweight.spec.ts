import { expect, test, type Page } from "@playwright/test";
import { addExercise, freshStart, startEmptyWorkout } from "./helpers";

async function setBodyWeight(page: Page, kg: string): Promise<void> {
  await page.goto("/settings?section=health");
  const field = page.getByLabel("Body weight (kg)");
  await field.fill(kg);
  await field.press("Enter");
  await expect(field).toHaveValue(kg);
}

const volume = (page: Page) => page.locator("dd").nth(1);

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("a pull-up counts body weight, plus added load or minus assistance", async ({ page }) => {
  await setBodyWeight(page, "70");
  await startEmptyWorkout(page);
  await addExercise(page, "Pull Up");
  await expect(page.getByText("Body weight 70 kg")).toBeVisible();

  // Body weight only: 70 × 10.
  await page.getByLabel("Set 1 reps").fill("10");
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(volume(page)).toHaveText("700 kg");

  // Plus 10 kg on a belt: 80 × 8 more.
  await page.getByLabel("Set 2 added weight in kg").fill("10");
  await page.getByLabel("Set 2 reps").fill("8");
  await page.getByRole("button", { name: "Mark Set 2 done" }).click();
  await expect(volume(page)).toHaveText("1,340 kg");

  // Switched to assisted: the 10 kg becomes 10 kg of help, so set 2 is 60 × 8.
  await page.getByRole("button", { name: "Assisted" }).click();
  await expect(page.getByText("−kg", { exact: true })).toBeVisible();
  await expect(volume(page)).toHaveText("1,180 kg");
  await expect(page.getByLabel("Set 3 assistance in kg")).toBeVisible();
});

test("without a body weight on record, the card says where to add it", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Pull Up");
  await expect(page.getByRole("link", { name: "Add your body weight to count it in volume" })).toBeVisible();
  await page.getByLabel("Set 1 reps").fill("10");
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(volume(page)).toHaveText("0 kg");
});
