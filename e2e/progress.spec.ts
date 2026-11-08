import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("empty state on first run", async ({ page }) => {
  await page.goto("/progress");
  await expect(page.getByText("Charts fill in as you finish workouts.")).toBeVisible();
  await expect(page.getByText(/Nothing in the last 8 weeks yet/).first()).toBeVisible();
  await expect(page.getByText("No working sets in this range.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("charts render after a workout", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.goto("/progress");
  await expect(page.getByText(/1 workout logged/)).toBeVisible();
  const volume = page.getByRole("figure").filter({ hasText: "Volume per week" });
  await expect(volume.locator("svg.recharts-surface")).toBeVisible();
  await volume.getByText("Show as table").click();
  await expect(volume.locator("tbody tr")).toHaveCount(8);
  const split = page.getByRole("figure").filter({ hasText: "Sets per muscle" });
  await expect(split.getByText("Chest", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Last 8 weeks" }).click();
  await expect(page.getByText("Sets per muscle, last 8 weeks")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("range, chart tabs and the hero follow the data", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.goto("/progress");

  const hero = page.getByRole("region", { name: /Volume, last 8 weeks/ });
  await expect(hero.getByText("480", { exact: true }).first()).toBeVisible();
  await expect(hero.getByText("Nothing logged in the 8 weeks before, so no comparison yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "1-week streak" })).toBeVisible();

  await page.getByRole("button", { name: "12 wk" }).click();
  await expect(page.getByRole("button", { name: "12 wk" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: /Volume, last 12 weeks/ })).toBeVisible();
  await expect(page.getByText("Volume per week, last 12 weeks (kg)")).toBeVisible();

  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await expect(page.getByText("Workouts per week, last 12 weeks")).toBeVisible();
  await page.getByRole("button", { name: "Time", exact: true }).click();
  await expect(page.getByText(/Time training per week/)).toBeVisible();

  const lifts = page.getByRole("region", { name: "Main lifts" });
  await expect(lifts.getByRole("link", { name: /Bench Press \(Barbell\)/ })).toBeVisible();
  await expect(lifts.getByText("76 kg")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("share turns the range into a story with the eight layouts", async ({ page }) => {
  await page.goto("/progress");
  await expect(page.getByRole("button", { name: "Share" })).toHaveCount(0);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.goto("/progress");
  await page.getByRole("button", { name: "4 wk" }).click();
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: "Share to Instagram Story" });
  await expect(dialog.getByRole("img", { name: /^Obsidian Raw story card: Last 4 weeks, 480 kg/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Download High-Res PNG" })).toBeEnabled();
  await expect(dialog.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Split Spec Sheet", exact: true })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download High-Res PNG" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^abot-story-\d{4}-\d{2}-\d{2}-obsidian-raw\.png$/);
});

test("calendar moves months and links a day to its workout", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  await page.goto("/progress");
  const cal = page.locator("section").filter({ has: page.getByRole("grid") });
  const monthHeading = cal.getByRole("heading", { level: 2 });
  const before = await monthHeading.textContent();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(monthHeading).not.toHaveText(before ?? "");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(monthHeading).toHaveText(before ?? "");
  await page.getByRole("gridcell", { name: /1 workout/ }).click();
  await cal.getByRole("link").first().click();
  await page.waitForURL(/\/history\//);
});
