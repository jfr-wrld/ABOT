import { expect, test } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("after twelve days away Home offers the last workout and the Coach starts it lighter", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 1, 18, 0, 0) });
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toHaveCount(0);

  // Twelve days later.
  await page.clock.setSystemTime(new Date(2026, 9, 13, 18, 0, 0));
  await page.goto("/");
  // The splash's fade runs on the test clock; move it on so it stops covering the page.
  await page.clock.runFor(2000);
  await expect(page.getByRole("status", { name: "Loading ABOT" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
  await expect(page.getByText(/days ago\. Today's Coach targets start about 10% lighter\./)).toBeVisible();

  await page.getByRole("button", { name: /^Repeat / }).click();
  await expect(page.getByRole("link", { name: /^Workout in progress/ })).toBeVisible();
  // Under the test clock the client-side push to the logger can stall; open it directly.
  await page.goto("/workout");
  // The Coach Pill starts the comeback 10% lighter: 60 kg becomes 52.5 kg (rounded down to a plate step).
  // One locator for both: under the test clock the card's entrance can leave a child mid-fade.
  await expect(page.getByRole("group", { name: "Coach: Welcome back" })).toContainText("-10%", { timeout: 15_000 });
  // The summary's "First workout in N days" line is covered by returnAfter's unit test: logging
  // under a clock moved 12 days ahead stalls the logger's animations in the test browser.
});

test("Not now hides the welcome until the next workout", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 1, 18, 0, 0) });
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "80", "5");
  await finishWorkout(page);
  await page.clock.setSystemTime(new Date(2026, 9, 20, 18, 0, 0));
  await page.goto("/");
  // The splash's fade runs on the test clock; move it on so it stops covering the page.
  await page.clock.runFor(2000);
  await expect(page.getByRole("status", { name: "Loading ABOT" })).toHaveCount(0);
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toHaveCount(0);
});
