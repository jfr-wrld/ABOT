import { expect, test } from "@playwright/test";
import { freshStart, expectNoHorizontalOverflow, sortAndFilter } from "./helpers";
import { finishedSession, seedDb } from "./seed-db";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("the library grid shows real photos only, with a small equipment badge; custom exercises stay", async ({ page }) => {
  await freshStart(page);
  await page.goto("/exercises");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Name").fill("Band Pull Apart Mine");
  await page.getByRole("button", { name: "Add to library" }).click();
  await sortAndFilter(page, "Grid");

  const thumbs = page.locator("main [data-thumb]");
  await expect(thumbs.first()).toBeVisible();
  // Every tile in browsing has a photo, except the lifter's own exercise.
  const icons = await page.locator('main li:has([data-thumb="icon"])').allInnerTexts();
  expect(icons.every((txt) => txt.includes("Custom"))).toBe(true);
  await expect(page.getByRole("link", { name: /^Band Pull Apart Mine/ })).toBeVisible();

  const badge = (await page.locator("main [data-equipment]").first().boundingBox())!;
  expect(badge.width).toBeLessThanOrEqual(26);
  await expectNoHorizontalOverflow(page);
});

test("the exercise page counts every workout and keeps the open tab through Back", async ({ page }) => {
  const sessions = Array.from({ length: 12 }, (_, i) => finishedSession({ "bench-press-barbell": [[60 + i, 5]] }, { daysAgo: 12 - i }));
  await seedDb(page, { sessions });
  await page.goto("/exercises/detail?id=bench-press-barbell");
  const stats = page.locator("dl").first();
  await expect(stats).toContainText("Workouts");
  await expect(stats).toContainText("12");
  // The best of all twelve, not of the last ten: 71 kg × 5.
  await expect(stats).toContainText("71 kg");

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.getByText("The last 10 of 12 workouts. The rest are in History.")).toBeVisible();
  await page.getByRole("tabpanel").getByRole("link").first().click();
  await page.waitForURL(/\/history/);
  await page.goBack();
  await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
});

test("a link to a library exercise opens even before the larger library has loaded", async ({ page }) => {
  await freshStart(page);
  await page.goto("/exercises/detail?id=atlas-pendulum-squat");
  await expect(page.getByRole("heading", { level: 1, name: /Pendulum Squat/ })).toBeVisible();
  await expect(page.getByText("Exercise not found")).toHaveCount(0);
});

test("a bodyweight lift's records show its best set in reps, with no 1RM", async ({ page }) => {
  await seedDb(page, { sessions: [finishedSession({ "pull-up": [[0, 9], [0, 7]] }, { daysAgo: 2, bodyLoadKg: 72 })] });
  await page.goto("/exercises/detail?id=pull-up");
  const records = page.getByRole("region", { name: "Personal records" });
  await expect(records).toContainText("Best set");
  await expect(records).toContainText("9 reps");
  await expect(records).not.toContainText("1RM");
});
