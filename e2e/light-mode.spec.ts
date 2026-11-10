import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout, reachSummary } from "./helpers";

const SCAN = readFileSync(path.join(__dirname, "support", "contrast-scan.js"), "utf8");

type Finding = { text: string; ratio: number; need: number; color: string; bg: string };
const scan = (page: import("@playwright/test").Page) => page.evaluate(SCAN) as Promise<Finding[]>;

test.describe("light theme", () => {
  test.use({ colorScheme: "light", reducedMotion: "reduce", viewport: { width: 390, height: 844 } });

  test("text meets WCAG AA contrast on the main screens", async ({ page }) => {
    await freshStart(page);
    await startEmptyWorkout(page);
    await addExercise(page, "Squat (Barbell)");
    await logSet(page, 1, "100", "5");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    expect(await scan(page), "logger").toEqual([]);
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();
    await reachSummary(page);
    await page.waitForTimeout(800);
    expect(await scan(page), "summary").toEqual([]);
    const detail = page.url().replace("/workout/summary?", "/history?");
    for (const route of [detail, "/", "/exercises", "/exercises/detail?id=squat-barbell", "/settings", "/settings?section=workout", "/settings?section=data"]) {
      await page.goto(route);
      await expect(page.getByRole("main").first()).toBeVisible();
      await page.waitForTimeout(800);
      expect(await scan(page), route).toEqual([]);
    }
  });
});

test("with reduced motion, pages hydrate without errors", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  for (const route of ["/", "/settings", "/exercises"]) {
    await page.goto(route);
    await expect(page.getByRole("main").first()).toBeVisible();
    await page.waitForTimeout(500);
  }
  expect(errors).toEqual([]);
  await ctx.close();
});
