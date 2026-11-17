import { expect, test } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("a typo in a finished workout is fixed from its page, and a set added", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "600", "8"); // meant 60
  await finishWorkout(page);
  await page.getByRole("region", { name: "Recent workouts" }).getByRole("list").getByRole("link").first().click();
  await page.waitForURL(/\/history\?id=/);

  await page.getByRole("button", { name: /^(More|Options|Workout options)/ }).first().click();
  await page.getByRole("button", { name: "Edit workout" }).click();
  await page.waitForURL(/\/history\/edit\?id=/);
  await page.getByLabel("Set 1 weight in kg").fill("60");
  await page.getByRole("button", { name: "Add set" }).click();
  await expect(page.getByLabel("Set 2 reps")).toHaveValue("8");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await page.waitForURL(/\/history\?id=/);
  // 60 × 8 twice.
  await expect(page.getByText("960 kg").first()).toBeVisible();
});

test("a workout done without the app is logged afterwards, on its own day", async ({ page }) => {
  await page.goto("/history/all");
  await page.getByRole("link", { name: "Log a past workout" }).click();
  await page.waitForURL(/\/history\/edit$/);

  const y = new Date(Date.now() - 86_400_000);
  const day = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Name").fill("Gym without signal");
  await page.getByLabel("Date").fill(day);

  // Nothing to save yet: it says what is missing.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add at least one set" })).toBeVisible();

  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill("Squat (Barbell)");
  await page.getByRole("dialog").getByRole("button", { name: /^Squat \(Barbell\)/ }).first().click();
  await page.getByLabel("Set 1 weight in kg").fill("100");
  await page.getByLabel("Set 1 reps").fill("5");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await page.waitForURL(/\/history\?id=/);
  await expect(page.getByRole("heading", { name: "Gym without signal" })).toBeVisible();
  await expect(page.getByText("500 kg").first()).toBeVisible();
  await page.goto("/history/all");
  await expect(page.getByText("Gym without signal")).toBeVisible();
  await expect(page.getByText("Yesterday").first()).toBeVisible();
});

test("a weighted pull-up's added load can be corrected afterwards", async ({ page }) => {
  await page.goto("/history/all");
  await page.getByRole("link", { name: "Log a past workout" }).click();
  await page.waitForURL(/\/history\/edit$/);
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill("Pull Up");
  await page.getByRole("dialog").getByRole("button", { name: /^Pull Up/ }).first().click();
  await expect(page.getByLabel("Set 1 added weight in kg")).toBeVisible();
  await page.getByLabel("Set 1 added weight in kg").fill("20");
  await page.getByLabel("Set 1 reps").fill("6");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/history\?id=/);
});
