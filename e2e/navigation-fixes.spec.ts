import { expect, test } from "@playwright/test";
import { freshStart } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("with nothing planned, the dock's centre button still leads somewhere", async ({ page }) => {
  await page.getByRole("button", { name: "No workout planned" }).click();
  const sheet = page.getByRole("dialog", { name: "No workout planned" });
  await expect(sheet.getByRole("button", { name: "Set up week" })).toBeVisible();
  await sheet.getByRole("button", { name: "Start empty" }).click();
  await page.waitForURL("**/workout**");
  await expect(page.getByRole("dialog", { name: "Add exercise" })).toBeVisible();
});

test("Settings opens from Profile and goes back there", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: "Profile" }).first().click();
  await page.waitForURL((u) => u.pathname === "/profile");
});

test("browsing exercises says how many more there are without a photo", async ({ page }) => {
  await page.goto("/exercises");
  // Scroll to the end of the browsing list, as a lifter would.
  for (let i = 0; i < 60; i++) {
    const more = page.getByRole("button", { name: /^Show \d+ more without/ });
    if (await more.count()) break;
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(120);
  }
  const more = page.getByRole("button", { name: /^Show \d+ more without/ });
  await expect(more).toBeVisible();
  await more.click();
  await expect(more).toHaveCount(0);
});

test("Back through Settings and its sections goes up one level each time, never in a loop", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: /^Settings/ }).first().click();
  await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === "/settings" && !u.search);
  await page.getByRole("link", { name: /^General/ }).first().click();
  await page.waitForURL(/section=general/);

  // The header's "‹ Settings", then "‹ Profile": each goes back in history, adding no entry, so
  // the phone's Back afterwards cannot walk into a page already left.
  const entries = await page.evaluate(() => history.length);
  await page.locator("main header").getByRole("link", { name: "Settings" }).click();
  await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === "/settings" && !u.search);
  await page.locator("main header").getByRole("link", { name: "Profile" }).click();
  await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === "/profile");

  expect(await page.evaluate(() => history.length)).toBe(entries);
});
