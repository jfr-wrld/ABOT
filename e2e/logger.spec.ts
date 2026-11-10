import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout, reachSummary } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("starts an empty workout and adds an exercise", async ({ page }) => {
  await startEmptyWorkout(page);
  await expect(page.getByText("This workout has no exercises yet")).toBeVisible();
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill("zzzz");
  await expect(page.getByText("No exercise matches")).toBeVisible();
  await page.getByLabel("Search exercises").fill("");
  await page.keyboard.press("Escape");
  await addExercise(page, "Bench Press (Barbell)");
  await expect(page.getByRole("button", { name: /^Mark Set \d done$/ })).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
});

test("refuses to complete a set without reps", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(page.getByText("Enter reps before completing this set")).toBeVisible();
  await expect(page.getByLabel("Set 1 reps")).toBeFocused();
});

test("completing a set starts the rest timer and updates the header", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  const timer = page.getByRole("timer");
  await expect(timer).toHaveAttribute("aria-label", /Rest, 1:(29|30) left/);
  await expect(page.locator("dd").nth(1)).toHaveText("480 kg");
  await expect(page.locator("dd").nth(2)).toHaveText("1 / 3");
  await expect(page.getByText(/New record/)).toHaveCount(1);
  await page.getByRole("button", { name: "Extend rest by 15 seconds" }).click();
  await expect(timer).toHaveAttribute("aria-label", /Rest, 1:4\d left/);
  await page.getByRole("button", { name: "Skip rest" }).click();
  await expect(timer).toHaveCount(0);
});

test("active workout survives reload", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByRole("button", { name: /Set 1 done\. Mark as not done/ })).toBeVisible();
});

test("set type menu changes type and closes on Escape", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByRole("button", { name: "Set 2: change type or remove" }).click();
  await page.getByRole("button", { name: /Warm-up/ }).click();
  const chip = page.getByRole("button", { name: "Warm-up set: change type or remove" });
  await expect(chip).toBeVisible();
  await chip.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add set" }).click();
  await page.getByRole("button", { name: "Set 3: change type or remove" }).click();
  await page.getByRole("button", { name: "Remove this set" }).click();
  await expect(page.getByRole("button", { name: /^Mark (Set \d|Warm-up set) done$/ })).toHaveCount(3);
});

test("finish saves the workout and the previous column autofills next time", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByText("2 sets were not marked done and will not be saved.")).toBeVisible();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first()).toContainText(/480 kg\s*1 set/);

  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  const prev = page.getByRole("button", { name: /^Previous 60 × 8/ });
  await expect(prev).toBeVisible();
  await page.setViewportSize({ width: 360, height: 780 });
  const clipped = await prev.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(clipped, "Prev value is cut off at 360px").toBe(false);
  await expectNoHorizontalOverflow(page);
  await prev.click();
  await expect(page.getByLabel("Set 1 weight in kg")).toHaveValue("60");
  await expect(page.getByLabel("Set 1 reps")).toHaveValue("8");
  await page.getByLabel("Set 1 weight in kg").fill("62.5");
  await page.getByRole("button", { name: "Mark Set 1 done" }).click();
  await expect(page.getByText(/New record/)).toHaveCount(1);
  await finishWorkout(page);
});

test("discard removes the active workout", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByRole("button", { name: "Discard workout" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("Workout in progress", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
});

test("mark remaining sets done from the finish dialog", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByLabel("Set 2 weight in kg").fill("60");
  await page.getByLabel("Set 2 reps").fill("8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Mark 1 remaining set done" }).click();
  await expect(page.getByText("1 set was not marked done and will not be saved.")).toBeVisible();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first()).toContainText(/960 kg\s*2 sets/);
});

test("adjust start time", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByRole("button", { name: /^Duration/ }).click();
  const input = page.getByLabel("Started at");
  const d = new Date(Date.now() + 60 * 60_000);
  await input.fill(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  await page.getByRole("button", { name: "Save start time" }).click();
  await expect(page.getByText("The start time cannot be in the future")).toBeVisible();
  const e = new Date(Date.now() - 45 * 60_000);
  if (e.getDate() !== new Date().getDate()) test.skip(true, "45 minutes ago is yesterday");
  await input.fill(`${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`);
  await page.getByRole("button", { name: "Save start time" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Duration/ })).toContainText(/4[45]m/);
});
