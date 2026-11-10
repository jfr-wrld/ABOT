import { expect, test, type Page } from "@playwright/test";
import { freshStart } from "./helpers";

/** Scrolls the exercise list down and opens the first exercise in view; returns the offset. */
async function openFromDeepInList(page: Page): Promise<number> {
  await page.goto("/exercises");
  await expect(page.getByRole("link", { name: /\(Barbell\)/ }).first()).toBeVisible();
  await page.mouse.wheel(0, 1800);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => window.scrollY);
  const link = page.locator('a[href*="/exercises/detail"]').filter({ visible: true });
  // The first exercise link inside the viewport.
  const inView = await link.evaluateAll((els) => els.findIndex((el) => {
    const r = el.getBoundingClientRect();
    return r.top > 80 && r.bottom < window.innerHeight - 160;
  }));
  // A DOM click: Playwright's own click would scroll the link to the middle first.
  await link.nth(inView).evaluate((el) => (el as HTMLElement).click());
  await page.waitForURL(/\/exercises\/detail/);
  return y;
}

test("Back from a detail page lands where the list was scrolled", async ({ page }) => {
  await freshStart(page);
  const y = await openFromDeepInList(page);
  await page.getByRole("link", { name: "Exercises" }).first().click();
  await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === "/exercises");
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 }).toBeGreaterThan(y - 5);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(5);
});

test("the system Back button does the same, and a new page still opens at the top", async ({ page }) => {
  await freshStart(page);
  const y = await openFromDeepInList(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
  await page.goBack();
  await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === "/exercises");
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 }).toBeGreaterThan(y - 5);
});
