import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

/** Runs the plan steps from Home with the given days and place, saving without reminders. */
async function setUpWeek(page: Page, days: string, place: RegExp) {
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: days, exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: place }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Looks good" }).click();
  await page.getByRole("button", { name: "Save without reminders" }).click();
  await expect(page.getByRole("heading", { name: "Your week is set" })).toBeVisible();
}

test("Home sets up a week, then adjusting it replaces the old plan's workouts", async ({ page }) => {
  // Monday 16 November 2026.
  await page.clock.setFixedTime(new Date(2026, 10, 16, 9, 0));
  await freshStart(page);
  await page.getByRole("link", { name: "Set up week" }).click();
  await page.waitForURL("**/plan");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await setUpWeek(page, "3", /^Gym/);
  await page.getByRole("button", { name: "Go to Home" }).click();

  const rail = page.getByRole("list", { name: "This week" });
  await expect(page.getByRole("link", { name: "Adjust your plan" }).first()).toContainText("3 days · 17:30");
  await expect(page.getByRole("heading", { name: "Full Body Day 1" })).toBeVisible();
  await expect(page.getByText("Today · 17:30")).toBeVisible();
  // Any day of the week opens in the hero.
  await rail.getByRole("button", { name: /Wednesday/ }).click();
  await expect(page.getByRole("heading", { name: "Full Body Day 2" })).toBeVisible();
  await rail.getByRole("button", { name: /Tuesday/ }).click();
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();

  await page.getByRole("link", { name: "Adjust your plan" }).first().click();
  await expect(page.getByRole("button", { name: "2 years +" })).toBeVisible();
  await setUpWeek(page, "4", /^Gym/);
  await expect(page.getByText("3 old plan workouts replaced, 0 you edited kept.")).toBeVisible();
  await page.getByRole("button", { name: "Go to Home" }).click();
  await expect(page.getByRole("link", { name: "Adjust your plan" }).first()).toContainText("4 days · 17:30");
  await rail.getByRole("button", { name: /Thursday/ }).click();
  await expect(page.getByRole("heading", { name: "Upper day" })).toBeVisible();

  await page.goto("/routines");
  await expect(page.getByRole("heading", { name: "My plan · 4 days" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My plan · 3 days" })).toHaveCount(0);
  await expect(page.getByText("Full Body Day 1")).toHaveCount(0);
});

test("a rest day says so and offers the next workout", async ({ page }) => {
  // Tuesday 17 November 2026: the default three days are Monday, Wednesday and Friday.
  await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0));
  await freshStart(page);
  await page.goto("/plan");
  await setUpWeek(page, "3", /^Gym/);
  await page.getByRole("button", { name: "Go to Home" }).click();
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();
  await expect(page.getByText("Next: Full Body Day 2 · Tomorrow")).toBeVisible();
  await page.getByRole("button", { name: "Train anyway: Full Body Day 2" }).click();
  await page.waitForURL("**/workout");
});

test("training with no equipment builds bodyweight days", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await freshStart(page);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /^No equipment/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  const week = page.getByRole("list", { name: "Your week" });
  await expect(week.getByText("Bodyweight upper")).toHaveCount(2);
  await expect(week.getByText("Bodyweight lower and core")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await week.getByRole("button", { name: /Bodyweight lower and core/ }).click();
  await expect(week.getByText(/Barbell|Machine|Cable|Dumbbell/)).toHaveCount(0);
});
