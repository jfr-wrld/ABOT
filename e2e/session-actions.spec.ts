import { expect, test } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, reachSummary, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("a finished workout is renamed and saved as a routine, which then suggests today's next exercise", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await addExercise(page, "Triceps Pushdown (Cable)");
  await logSet(page, 1, "60", "8", "Bench Press (Barbell)");
  await page.getByRole("button", { name: "Skip rest" }).click();
  await logSet(page, 1, "30", "12", "Triceps Pushdown (Cable)");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);

  // Rename from the summary.
  await page.getByRole("button", { name: "Rename workout" }).click();
  const sheet = page.getByRole("dialog", { name: "Rename workout" });
  await sheet.getByLabel("Workout name").fill("Chest and Arms");
  await sheet.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText(/^Chest and Arms ·/)).toBeVisible();

  // Save as a routine: the button turns into a link to it.
  await page.getByRole("button", { name: "Save as routine" }).click();
  await page.getByRole("link", { name: "Saved to My Routines · Open" }).click();
  await page.waitForURL(/\/routines\/edit/);
  await expect(page.getByText("Bench Press (Barbell)").first()).toBeVisible();
  // It is in My Routines after a reload, with its exercises.
  await expect(async () => {
    await page.goto("/routines");
    await expect(page.getByRole("article").filter({ hasText: "Chest and Arms" }).getByText("Triceps Pushdown", { exact: false }).first()).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10_000 });

  // A new empty workout: the routine due next is that one, so chest and triceps are today's
  // targets. With bench in, the picker suggests triceps work first.
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByRole("button", { name: "Add exercise" }).first().click();
  const picker = page.getByRole("dialog", { name: "Add exercise" });
  const next = picker.getByRole("region", { name: "Still to train today · Chest and Arms" });
  await expect(next).toBeVisible();
  await expect(next.getByRole("button", { name: /Triceps Pushdown \(Cable\)/ })).toBeVisible();
  await expect(next.getByText("For Triceps, not trained yet today").first()).toBeVisible();
  // Searching hides the suggestions.
  await picker.getByLabel("Search exercises").fill("curl");
  await expect(next).toBeHidden();
});

test("replacing an exercise suggests similar ones first", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByRole("button", { name: "Options for Bench Press (Barbell)" }).click();
  await page.getByRole("button", { name: "Replace exercise" }).click();
  const picker = page.getByRole("dialog", { name: "Replace Bench Press (Barbell)" });
  const similar = picker.getByRole("region", { name: "Similar to Bench Press (Barbell)" });
  await expect(similar.getByRole("button", { name: /^Bench Press \(Dumbbell\)/ })).toBeVisible();
  await similar.getByRole("button", { name: /^Bench Press \(Dumbbell\)/ }).click();
  await expect(page.getByRole("heading", { name: "Bench Press (Dumbbell)" })).toBeVisible();
});

test("a past workout is renamed and saved as a routine from its page", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "100", "5");
  await finishWorkout(page);
  await page.getByRole("region", { name: "Recent workouts" }).getByRole("list").getByRole("link").first().click();
  await page.waitForURL(/\/history/);
  await page.getByRole("button", { name: "Workout options" }).click();
  await page.getByRole("button", { name: "Rename workout" }).click();
  const sheet = page.getByRole("dialog", { name: "Rename workout" });
  await sheet.getByLabel("Workout name").fill("Leg Day");
  await sheet.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Leg Day" })).toBeVisible();
  await page.getByRole("button", { name: "Workout options" }).click();
  await page.getByRole("button", { name: "Save as routine" }).click();
  await expect(page.getByRole("link", { name: "Saved to My Routines · Open" })).toBeVisible();
});
