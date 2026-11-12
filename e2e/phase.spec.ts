import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("the setup wizard starts a cut, and the phase page logs weight, protein and water", async ({ page }) => {
  await page.getByRole("link", { name: "Choose a body phase" }).click();
  await page.waitForURL("**/phase/setup");
  // The first question is the goal in plain words; nothing is picked for the lifter.
  await expect(page.getByRole("heading", { level: 1, name: "What is your goal?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick a goal" })).toBeDisabled();
  await page.getByRole("radio", { name: /^Lose fat\s*Cut/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  // The weight can be typed: no ten taps from the 70 kg default.
  const weight = page.getByRole("group", { name: "Weight" }).getByRole("textbox");
  await weight.fill("75");
  await weight.press("Enter");
  await expect(weight).toHaveValue("75.0");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "How long, and where to" })).toBeVisible();
  await page.getByRole("radio", { name: /^12/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeVisible();
  await expect(page.getByText("Coach holds the weight when sets get hard")).toBeVisible();
  // Where the number comes from, one tap away.
  await expect(page.getByText(/average of your workouts over the last 4 weeks/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Start phase" }).click();
  await page.waitForURL((u) => u.pathname === "/phase");

  await expect(page.getByRole("heading", { level: 1, name: "Cut" })).toBeVisible();
  await expect(page.locator("#hero-week")).toHaveText("1/12");
  // The answers became the profile's: the weigh-in, age and sex are not asked again.
  await waitForSavedSetting(page, "bodyweightKg", 75);
  await waitForSavedSetting(page, "biologicalSex", "male");
  await page.getByText("How the target is worked out").first().click();
  await expect(page.getByText("Target today").first()).toBeVisible();
  await page.getByRole("button", { name: "Add 25 g protein" }).click();
  await page.getByRole("button", { name: "Add 500 ml water" }).click();
  await expect(page.getByRole("img", { name: "Protein: 25 / 165" })).toBeVisible();

  await page.getByRole("button", { name: "Weight: −0.1" }).click();
  await page.getByRole("button", { name: "Add body fat and waist" }).click();
  // The setup logged today's weigh-in, so this one updates it.
  await page.getByRole("button", { name: "Update" }).click();
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
  // The protein tap is a log entry; the water tap is not listed as food.
  await expect(page.getByText("Protein", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Water", { exact: true })).toHaveCount(0);
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
