import { expect, test } from "@playwright/test";
import { finishedSession, seedDb } from "./seed-db";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

// The last workout is seeded days back: real time, no test clock (which also kept the splash up).
test("after twelve days away Home offers the last workout and the Coach starts it lighter", async ({ page }) => {
  await seedDb(page, { sessions: [finishedSession({ "bench-press-barbell": [[60, 8]] }, { daysAgo: 12 })] });
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
  await expect(page.getByText(/days ago\. Today's Coach targets start about 10% lighter\./)).toBeVisible();

  await page.getByRole("button", { name: /^Repeat / }).click();
  await page.waitForURL("**/workout");
  // The Coach Pill starts the comeback 10% lighter: 60 kg becomes 52.5 kg (rounded down to a plate step).
  await expect(page.getByRole("group", { name: "Coach: Welcome back" })).toContainText("-10%");
});

test("Not now hides the welcome until the next workout", async ({ page }) => {
  await seedDb(page, { sessions: [finishedSession({ "squat-barbell": [[80, 5]] }, { daysAgo: 19 })] });
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toHaveCount(0);
});
