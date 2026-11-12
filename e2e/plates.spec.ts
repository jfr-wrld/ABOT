import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, freshStart, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("the plate calculator loads the bar, follows the gym's plates, and fills the set", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  const weight = page.getByLabel("Set 1 weight in kg");
  await weight.fill("100");
  await weight.press("Tab");

  await page.getByRole("button", { name: "Options for Bench Press (Barbell)" }).click();
  await page.getByRole("button", { name: "Plate calculator for Bench Press (Barbell)" }).click();
  const sheet = page.getByRole("dialog", { name: "Plate calculator" });
  await expect(sheet.getByLabel("Target weight in kg")).toHaveValue("100");
  const plates = sheet.getByRole("list", { name: "Plates on each side" });
  await expect(plates).toContainText("1 × 25 kg");
  await expect(plates).toContainText("1 × 15 kg");
  await expect(sheet.getByRole("img", { name: /Sleeve loaded with 1 × 25 kg, 1 × 15 kg/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // No 25s at this gym: two 20s instead.
  await sheet.getByRole("button", { name: "25", exact: true }).click();
  await expect(plates).toContainText("2 × 20 kg");

  // A 15 kg bar and a target the plates cannot make exactly.
  await sheet.getByText("15 kg", { exact: true }).click();
  await sheet.getByLabel("Target weight in kg").fill("101");
  await expect(sheet.getByText(/short of the target/)).toBeVisible();
  await sheet.getByRole("button", { name: "Lighter by 2.5 kg" }).click();
  await expect(sheet.getByLabel("Target weight in kg")).toHaveValue("98.5");

  await sheet.getByRole("button", { name: /^Use .* kg for set 1$/ }).click();
  await expect(sheet).toBeHidden();
  await expect(weight).toHaveValue("97.5");
});

test("only barbell exercises offer the calculator", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Dumbbell)");
  await page.getByRole("button", { name: "Options for Bench Press (Dumbbell)" }).click();
  const menu = page.getByRole("dialog", { name: "Bench Press (Dumbbell)" });
  await expect(menu.getByRole("button", { name: "How to do Bench Press (Dumbbell)" })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Plate calculator/ })).toHaveCount(0);
});
