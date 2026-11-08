import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("tapping the exercise name opens the how-to sheet without leaving the workout", async ({ page }) => {
  // A finished workout first, so the sheet has records to show.
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "80", "5");
  await finishWorkout(page);

  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Skip rest" }).click();
  const duration = page.getByRole("button", { name: /^Duration/ });
  const before = await duration.textContent();

  await page.getByRole("button", { name: "Bench Press (Barbell)", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Bench Press (Barbell)" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("region", { name: "Exercise media" })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Form cues" })).toBeVisible();
  await expect(sheet.getByText("Retract and depress the shoulder blades before unracking")).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Personal records" })).toBeVisible();
  await expect(sheet.getByText("80 kg", { exact: true }).first()).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Full exercise details" })).toHaveAttribute("href", "/exercises/bench-press-barbell");
  await expectNoHorizontalOverflow(page);

  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/workout$/);
  await expect(duration).not.toHaveText(before ?? "");
  await expect(page.getByRole("button", { name: /Set 1 done\. Mark as not done/ })).toBeVisible();
});

test("the info icon opens the same sheet", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await page.getByRole("button", { name: "How to do Squat (Barbell)" }).click();
  const sheet = page.getByRole("dialog", { name: "Squat (Barbell)" });
  await expect(sheet.getByText("Brace the core before each rep")).toBeVisible();
  await expect(sheet.getByText("No completed working sets yet.")).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
});

test("exercise detail shows full instructions and form cues", async ({ page }) => {
  await page.goto("/exercises/squat-barbell");
  const steps = page.getByRole("list", { name: "Instructions" }).getByRole("listitem");
  await expect(steps.nth(2)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Form cues" })).toBeVisible();
  await expect(page.getByText("Knees track over the toes")).toBeVisible();
  await expect(page.getByText("Instructions from free-exercise-db (public domain).")).toBeVisible();
});

test("a custom exercise without steps says so honestly", async ({ page }) => {
  await page.goto("/exercises");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Name").fill("Spider Curl");
  await page.getByRole("button", { name: "Add to library" }).click();
  await page.getByRole("link", { name: /Spider Curl/ }).click();
  await expect(page.getByText("No step-by-step instructions for this exercise.")).toBeVisible();
  await expect(page.getByText("No form cues for this exercise yet.")).toBeVisible();
});
