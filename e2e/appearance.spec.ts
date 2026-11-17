import { expect, test } from "@playwright/test";
import { freshStart, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

const brand = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());

test("a chosen primary colour recolours the app and is there from the first paint after a reload", async ({ page }) => {
  await page.goto("/settings?section=general");
  const colours = page.getByRole("radiogroup", { name: "Primary colour" });
  await expect(colours.getByRole("radio", { name: "Volt" })).toHaveAttribute("aria-checked", "true");
  await colours.getByRole("radio", { name: "Blue" }).click();
  await expect(colours.getByRole("radio", { name: "Blue" })).toHaveAttribute("aria-checked", "true");
  await waitForSavedSetting(page, "accentColor", "#3b82f6");
  await expect.poll(() => brand(page)).toBe("#3b82f6");

  // The pre-paint script puts it back before React runs.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { firstBrand: string }).firstBrand = document.documentElement.style.getPropertyValue("--brand");
    });
  });
  await page.goto("/");
  expect(await page.evaluate(() => (window as unknown as { firstBrand: string }).firstBrand)).toBe("#3b82f6");
});

test("flat components lose their raise", async ({ page }) => {
  await page.goto("/settings?section=general");
  const style = page.getByRole("radiogroup", { name: "Components" });
  const preview = page.locator(".panel").first();
  expect(await preview.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  await style.getByText("Flat", { exact: true }).click();
  await waitForSavedSetting(page, "componentStyle", "flat");
  await expect(page.locator("html")).toHaveAttribute("data-style", "flat");
  expect(await preview.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
});
