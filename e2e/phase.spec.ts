import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("the setup wizard starts a cut, and the phase page logs weight, protein and water", async ({ page }) => {
  await page.getByRole("link", { name: "Choose a body phase" }).click();
  await page.waitForURL("**/phase/setup");
  await expect(page.getByRole("heading", { level: 1, name: "Pick a phase" })).toBeVisible();
  await page.getByRole("radio", { name: /^Cut/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  // 70 kg default: ten +0.5 steps make 75.
  for (let i = 0; i < 10; i++) await page.getByRole("button", { name: "Weight: +0.5" }).click();
  await expect(page.getByRole("group", { name: "Weight" }).locator("output")).toHaveText("75.0kg");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your goal" })).toBeVisible();
  await page.getByRole("radio", { name: /^12/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeVisible();
  await expect(page.getByText("Coach holds the weight when sets get hard")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Start phase" }).click();
  await page.waitForURL((u) => u.pathname === "/phase");

  await expect(page.getByRole("heading", { level: 1, name: "Cut" })).toBeVisible();
  await expect(page.locator("#hero-week")).toHaveText("1/12");
  await page.getByRole("button", { name: "Add 25 g protein" }).click();
  await page.getByRole("button", { name: "Add 500 ml water" }).click();
  await expect(page.getByRole("img", { name: "Protein: 25 / 165" })).toBeVisible();

  await page.getByRole("button", { name: "Weight: −0.1" }).click();
  await page.getByRole("button", { name: "Add body fat and waist" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Meals and foods" }).click();
  await page.waitForURL("**/phase/fuel");
  await expect(page.getByText("Before", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Drinks" }).click();
  const coconut = page.getByRole("button", { name: /Coconut water/ });
  await coconut.click();
  await expect(coconut).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("1 glass (~250 ml)")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await waitForSavedSetting(page, "bodyPhase", expect.objectContaining({ phaseType: "CUTTING", durationWeeks: 12 }));
  await page.goto("/");
  const card = page.getByRole("region", { name: "Cut" });
  await expect(card).toContainText("W1/12");
  await expect(card.getByRole("img", { name: "Protein: 25 / 165" })).toBeVisible();

  await page.goto("/routines");
  await expect(page.getByText("Fits your cut").first()).toBeVisible();
});

test("without a phase, the phase and fuel pages offer the setup", async ({ page }) => {
  await page.goto("/phase");
  await expect(page.getByText("No phase running.")).toBeVisible();
  await page.goto("/phase/fuel");
  await expect(page.getByRole("link", { name: "Choose a body phase" })).toBeVisible();
});
