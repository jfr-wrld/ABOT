import { expect, test, type Page } from "@playwright/test";
import { freshStart } from "./helpers";

// The lens follows the finger on springs: motion on, as on a phone.
test.use({ reducedMotion: "no-preference" });

const SHOTS = process.env.DOCK_SHOTS;

/** With motion on, the splash stays its full length over the page; wait it out. */
async function ready(page: Page) {
  await freshStart(page);
  await expect(page.getByRole("status", { name: "Loading ABOT" })).toHaveCount(0);
}

async function tabCenter(page: Page, name: string) {
  const box = (await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name }).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("dragging along the dock moves the lens with the finger and opens the tab it is let go on", async ({ page }) => {
  await ready(page);
  const from = await tabCenter(page, "Home");
  const to = await tabCenter(page, "Exercises");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2 + 20, from.y, { steps: 8 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dock-drag.png` });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  // Still on Home while the finger is down; the tab under the lens lights up.
  await expect(page).toHaveURL(/\/$/);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/exercises\/?$/);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Exercises" })).toHaveAttribute("aria-current", "page");
  if (SHOTS) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/dock-settled.png` });
  }
});

test("a drag let go over the current tab stays put, and a plain tap still opens a tab", async ({ page }) => {
  await ready(page);
  const home = await tabCenter(page, "Home");
  await page.mouse.move(home.x, home.y);
  await page.mouse.down();
  await page.mouse.move(home.x + 30, home.y, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Workout" }).click();
  await expect(page).toHaveURL(/\/workout\/?$/);
});
