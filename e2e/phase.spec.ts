import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("choosing a cut sets the daily target, logs weight, tallies protein and water, and survives a reload", async ({ page }) => {
  await page.getByRole("button", { name: "Choose a body phase" }).click();
  const sheet = page.getByRole("dialog", { name: "Choose a body phase" });
  await sheet.getByRole("radio", { name: /^Cut/ }).click();
  await sheet.getByLabel("Weight now (kg)").fill("80");
  await sheet.getByLabel("Height (cm)").fill("180");
  await sheet.getByLabel("Age").fill("30");
  // Mifflin-St Jeor 1780 × 1.375 = 2447.5, minus a 440 kcal deficit for −0.5%/wk.
  await expect(sheet.getByText("2,008")).toBeVisible();
  await sheet.getByRole("button", { name: "Start phase" }).click();
  await expect(sheet).toBeHidden();

  const card = page.getByRole("region", { name: /Active protocol/ });
  await expect(card).toContainText("Cut");
  await expect(card).toContainText("Week 1 of 8");
  await expect(card).toContainText("176 g protein");

  await card.getByRole("button", { name: "Add 25 g protein" }).click();
  await card.getByRole("button", { name: "Add 500 ml water" }).click();
  await expect(card.getByRole("progressbar", { name: "Protein today" })).toHaveAttribute("aria-valuenow", "25");
  await expect(card.getByRole("progressbar", { name: "Water today" })).toHaveAttribute("aria-valuenow", "500");

  await card.getByRole("button", { name: "Log weight" }).click();
  const log = page.getByRole("dialog", { name: "Log weight" });
  await log.getByLabel("Weight (kg)").fill("79.5");
  await log.getByLabel("Body fat (%), optional").fill("18");
  await log.getByRole("button", { name: "Save weigh-in" }).click();
  await expect(card).toContainText("79.5");

  await card.getByRole("button", { name: "Food guide" }).click();
  const guide = page.getByRole("dialog", { name: "Food guide" });
  await expect(guide.getByText("Before training (60 to 90 min)")).toBeVisible();
  await expect(guide.getByRole("paragraph").filter({ hasText: /^Chicken breast, skinless$/ })).toBeVisible();
  await guide.getByRole("button", { name: "Drinks" }).click();
  await expect(guide.getByText("Coconut water")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await guide.getByRole("button", { name: "Close" }).click();

  await waitForSavedSetting(page, "bodyPhase", expect.objectContaining({ phaseType: "CUTTING" }));
  await page.reload();
  await expect(page.getByRole("region", { name: /Active protocol/ })).toContainText("Week 1 of 8");
  await expect(page.getByRole("progressbar", { name: "Protein today" })).toHaveAttribute("aria-valuenow", "25");

  // Routines marks the templates that suit a cut.
  await page.goto("/routines");
  await expect(page.getByText("Fits your cut").first()).toBeVisible();
});

test("the full card on Profile charts scale weight against the trend", async ({ page }) => {
  await page.getByRole("button", { name: "Choose a body phase" }).click();
  const sheet = page.getByRole("dialog", { name: "Choose a body phase" });
  await sheet.getByRole("radio", { name: /^Lean bulk/ }).click();
  await sheet.getByLabel("Weight now (kg)").fill("70");
  await sheet.getByLabel("Height (cm)").fill("175");
  await sheet.getByLabel("Age").fill("25");
  await sheet.getByRole("button", { name: "Start phase" }).click();
  await page.goto("/profile");
  const card = page.getByRole("region", { name: /Active protocol/ });
  await expect(card).toContainText("Lean bulk");
  await expect(card.getByText("Log your weight on a few days to see the trend line.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
