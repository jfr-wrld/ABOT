import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test("profile opens from Home and starts honestly empty", async ({ page }) => {
  await freshStart(page);
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await expect(page.getByText("No finished workouts yet.")).toBeVisible();
  await expect(page.getByText("Guest on this device")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("name, bodyweight and height are saved on the device", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile");
  await page.getByLabel("Name", { exact: true }).fill("Jafar Shodiq");
  await page.getByLabel("Bodyweight in kg").fill("72.5");
  await page.getByLabel("Height in cm").fill("170");
  await expect(page.getByRole("img", { name: "JS" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Jafar Shodiq" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Jafar Shodiq");
  await expect(page.getByLabel("Bodyweight in kg")).toHaveValue("72.5");
  await expect(page.getByLabel("Height in cm")).toHaveValue("170");
});

test("bodyweight follows the weight unit", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile");
  await page.getByLabel("Bodyweight in kg").fill("100");
  await page.goto("/settings");
  await page.getByText("lbs", { exact: true }).click();
  await page.goto("/profile");
  await expect(page.getByLabel("Bodyweight in lbs")).toHaveValue("220.5");
});

test("lifetime stats and top lifts come from finished workouts", async ({ page }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "80", "5");
  await page.getByRole("button", { name: "Skip rest" }).click();
  await finishWorkout(page);

  await page.goto("/profile");
  const stats = page.getByRole("region", { name: "Lifetime" });
  await expect(stats.getByText("Workouts")).toBeVisible();
  await expect(stats.locator("dd").first()).toHaveText("1");
  const lifts = page.getByRole("region", { name: "Top lifts" });
  await expect(lifts.getByRole("link", { name: /Bench Press \(Barbell\)/ })).toBeVisible();
  await expect(lifts.getByText("80 kg × 5")).toBeVisible();
});

test("account and settings links lead somewhere real", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile");
  await page.getByRole("link", { name: "Back up with an account" }).click();
  await expect(page.getByRole("heading", { name: "Back up and sync" })).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("link", { name: "All settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("an impossible bodyweight is flagged, not silently kept", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile");
  const bw = page.getByLabel("Bodyweight in kg");
  await bw.fill("7");
  await expect(page.getByText("Enter 20 kg to 400 kg")).toBeVisible();
  await expect(bw).toHaveAttribute("aria-invalid", "true");
  await bw.fill("72");
  await expect(page.getByText("Enter 20 kg to 400 kg")).toHaveCount(0);
});
