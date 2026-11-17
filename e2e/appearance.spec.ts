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

test("a chosen app icon colours the logo tile in the app", async ({ page }) => {
  await page.goto("/settings?section=general");
  const icons = page.getByRole("radiogroup", { name: "App icon" });
  await expect(icons.getByRole("radio", { name: "Classic" })).toHaveAttribute("aria-checked", "true");
  await icons.getByRole("radio", { name: "Ocean" }).click();
  await waitForSavedSetting(page, "appIcon", "ocean");
  await page.goto("/");
  const tile = page.locator(".logo-tile").first();
  await expect.poll(() => tile.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(29, 78, 216)");
});

/** Visible controls and surfaces that still draw a bevel (a gradient face or a shadow). */
const raisedLeft = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const SKIP = ".liquid-glass, .glass-capsule, .logo-tile, [aria-hidden='true'], dialog *";
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("button, a, .tile, .panel, .chip, .raised-card, .glass-icon, .glass-btn, .wallet-card, .today-fab")) {
      if (el.closest(SKIP) || !el.checkVisibility()) continue;
      const cs = getComputedStyle(el);
      const shadow = cs.boxShadow === "none" || /^\S+ 0px 0px 0px 3px$/.test(cs.boxShadow) ? "" : cs.boxShadow;
      const face = /gradient/.test(cs.backgroundImage) && !el.style.background ? cs.backgroundImage : "";
      if (shadow || face) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join(".")} ${(el.textContent ?? "").trim().slice(0, 20)} | ${shadow || face}`);
    }
    return out;
  });

for (const theme of ["Dark", "Light"] as const) {
  test(`flat leaves no bevel on buttons, cards or icon buttons (${theme})`, async ({ page }) => {
    await page.goto("/settings?section=general");
    await page.getByRole("radiogroup", { name: "Theme" }).getByText(theme, { exact: true }).click();
    // In 3D the back button is raised glass; the flat rules must not leak into it.
    const back = page.locator("main header .glass-icon").first();
    expect(await back.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    await page.getByRole("radiogroup", { name: "Components" }).getByText("Flat", { exact: true }).click();
    await waitForSavedSetting(page, "componentStyle", "flat");
    // Chips animate their shadow away, so wait for the transitions to settle.
    await expect.poll(() => raisedLeft(page)).toEqual([]);
    await page.goto("/");
    await expect(page.locator(".today-fab")).toBeVisible();
    await expect.poll(() => raisedLeft(page)).toEqual([]);
  });
}
