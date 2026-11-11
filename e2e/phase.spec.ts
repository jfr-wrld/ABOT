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
  // Plan: a day sized to the cut's target, logged whole; the around-training meals stay.
  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.getByText("Before", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log the whole day" }).click();
  await expect(page.getByRole("button", { name: "Day logged" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Shopping list" })).toBeVisible();
  await expect(page.getByText(/^Uncooked (white|brown) rice$/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  // Today: the log fills the rings.
  await page.getByRole("tab", { name: "Today" }).click();
  await expect(page.getByText(/kcal left today|kcal over today's target/)).toBeVisible();
  // Foods: a drink's detail with its portion.
  await page.getByRole("tab", { name: "Foods" }).click();
  await page.getByRole("tab", { name: "Drinks" }).click();
  await page.getByRole("button", { name: /Coconut water/ }).click();
  const sheet = page.getByRole("dialog", { name: "Coconut water" });
  await expect(sheet.getByRole("button", { name: /1 glass · 250 ml/ })).toHaveAttribute("aria-pressed", "true");
  await expectNoHorizontalOverflow(page);
  await sheet.getByRole("button", { name: "Close" }).click();

  await waitForSavedSetting(page, "bodyPhase", expect.objectContaining({ phaseType: "CUTTING", durationWeeks: 12 }));
  await page.goto("/");
  const card = page.getByRole("region", { name: "Cut" });
  await expect(card).toContainText("W1/12");
  // The tap plus the logged day's protein.
  await expect(card.getByRole("img", { name: /^Protein: \d+ \/ 165$/ })).toBeVisible();

  await page.goto("/routines");
  await expect(page.getByText("Fits your cut").first()).toBeVisible();
});

test("without a phase, the phase and fuel pages offer the setup", async ({ page }) => {
  await page.goto("/phase");
  await expect(page.getByText("No phase running.")).toBeVisible();
  await page.goto("/phase/fuel");
  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.getByRole("link", { name: "Choose a body phase" })).toBeVisible();
});
