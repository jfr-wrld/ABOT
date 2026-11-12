import { expect, test } from "@playwright/test";
import { addExercise, freshStart, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("the next set moves weight and reps by tap, and typing still works", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  const weight = page.getByLabel("Set 1 weight in kg");
  const reps = page.getByLabel("Set 1 reps");
  await page.getByRole("button", { name: "2.5 kg more on Set 1" }).click();
  await page.getByRole("button", { name: "2.5 kg more on Set 1" }).click();
  await expect(weight).toHaveValue("5");
  await page.getByRole("button", { name: "2.5 kg less on Set 1" }).click();
  await expect(weight).toHaveValue("2.5");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "One rep more on Set 1" }).click();
  await page.getByRole("button", { name: "One rep fewer on Set 1" }).click();
  await expect(reps).toHaveValue("2");
  await weight.fill("60");
  await weight.press("Tab");
  await page.getByRole("button", { name: "2.5 kg more on Set 1" }).click();
  await expect(weight).toHaveValue("62.5");
  // Only the set waiting to be done carries the steppers; ticking it hands them to set 2.
  await expect(page.getByRole("button", { name: /more on Set 2$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(page.getByRole("button", { name: "2.5 kg more on Set 2" })).toBeVisible();

  // Dumbbells step by 1.25 kg.
  await addExercise(page, "Bench Press (Dumbbell)");
  await expect(page.getByRole("button", { name: "1.25 kg more on Set 1" })).toBeVisible();
});

test("a swap in a routine workout asks: today only, or update the routine", async ({ page }) => {
  await page.goto("/routines");
  await page.getByRole("button", { name: "Save to My Routines: Push A: Strength" }).click();
  await page.getByRole("tab", { name: "My Routines" }).click();
  const mine = page.getByRole("tabpanel", { name: "My Routines" });
  await mine.getByRole("button", { name: "Start Push A: Strength" }).click();
  await page.waitForURL("**/workout");

  await page.getByRole("button", { name: "Swap Bench Press (Barbell) for another exercise" }).click();
  const sheet = page.getByRole("dialog", { name: "Swap Bench Press (Barbell)" });
  await sheet.getByRole("button", { name: "Dumbbell / Home" }).click();
  await expect(sheet.getByRole("listitem")).toHaveCount(3);
  const row = sheet.getByRole("button", { name: /^Bench Press \(Dumbbell\)/ });
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: "Update routine" }).click();
  await expect(page.getByRole("heading", { name: "Bench Press (Dumbbell)", exact: true })).toBeVisible();

  await page.goto("/routines");
  await page.getByRole("tab", { name: "My Routines" }).click();
  await mine.getByRole("link", { name: "Edit Push A: Strength" }).click();
  await expect(page.getByText("Bench Press (Dumbbell)", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Bench Press (Barbell)", { exact: true })).toHaveCount(0);
});
