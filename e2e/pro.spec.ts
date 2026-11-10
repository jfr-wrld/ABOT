import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

async function simulate(page: Page, mode: "Beta mode" | "Free locked" | "Pro active") {
  await page.goto("/settings");
  const card = page.getByRole("region", { name: /FOUNDER UNIT/ });
  await card.getByRole("radio", { name: mode }).click();
  await expect(card.getByRole("radio", { name: mode })).toHaveAttribute("aria-checked", "true");
}

test("every beta install gets a founder unit, and the paywall shows plans and the beta pass", async ({ page }) => {
  await page.goto("/settings");
  const card = page.getByRole("region", { name: /^FOUNDER UNIT \/\/ #\d{4}$/ });
  await expect(card).toBeVisible();
  const plan = page.getByRole("region", { name: "Plan & billing" });
  await expect(plan).toContainText("FOUNDERS BETA");
  await expect(plan).toContainText("Every PRO feature is open while the founders beta runs.");
  const code = (await card.getByRole("heading").textContent())!;
  await page.reload();
  // The unit number is permanent.
  await expect(page.getByRole("region", { name: /FOUNDER UNIT/ }).getByRole("heading")).toHaveText(code);
  await expectNoHorizontalOverflow(page);

  await plan.getByRole("button", { name: "Get Black Pro" }).click();
  const pay = page.getByRole("dialog", { name: "Precision engineered for serious lifters." });
  await expect(pay).toBeVisible();
  await expect(pay.getByRole("table")).toContainText("Auto-overload coach");
  await expect(pay).toContainText("Rp 29.000");
  await expect(pay).toContainText("Rp 199.000");
  await expect(pay).toContainText("Save 43%");
  // Founders see the lifetime license at half price, the full price struck through.
  await expect(pay).toContainText("Rp 399.000");
  await expect(pay).toContainText("Rp 798.000");
  await expect(pay).toContainText("Founder 50% off privilege applied");
  await expect(pay.getByRole("status").first()).toContainText("Active: Founders Beta Pass");
  await expect(pay).toContainText(code.replace("FOUNDER UNIT", "FOUNDER"));
  await pay.getByRole("button", { name: "Close" }).click();
  await expect(pay).toBeHidden();
});

test("Free locked: the Coach Pill, the radar and PRO story layouts open the paywall; Pro active opens them", async ({ page }) => {
  // History so the pill and radar have something to show.
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  for (const n of [1, 2, 3]) {
    await logSet(page, n, "80", "8");
    await page.getByRole("button", { name: "Skip rest" }).click();
  }
  await addExercise(page, "Squat (Barbell)");
  for (const n of [1, 2, 3]) {
    await logSet(page, n, "100", "5", "Squat (Barbell)");
    await page.getByRole("button", { name: "Skip rest" }).click();
  }
  await finishWorkout(page);

  await simulate(page, "Free locked");
  await expect(page.getByRole("region", { name: "Plan & billing" })).toContainText("CORE");

  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  const pill = page.getByRole("group", { name: "Coach: Volume target" });
  await pill.getByRole("button", { name: /^Apply / }).click();
  const pay = page.getByRole("dialog", { name: "Precision engineered for serious lifters." });
  await expect(pay).toContainText("Unlock feature: Auto-overload coach");
  await expect(pay.getByRole("button", { name: "Activate Annual telemetry" })).toBeVisible();
  await pay.getByRole("button", { name: "Activate Annual telemetry" }).click();
  await expect(pay).toContainText("Payments are not set up in this version of ABOT yet.");
  await pay.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Set 1 reps")).toHaveValue("");

  await page.getByRole("button", { name: "Discard workout" }).click();
  await page.getByRole("button", { name: /^Discard/ }).last().click();

  // The balance radar lives on Progress > Muscles.
  await page.goto("/progress/muscles");
  const radar = page.getByRole("region", { name: "Muscle balance" });
  await expect(radar.getByText("Locked: ABOT // BLACK")).toBeVisible();
  await expect(radar.getByText(/SYMMETRY SCORE/)).toHaveCount(0);

  await simulate(page, "Pro active");
  await page.goto("/progress/muscles");
  await expect(page.getByRole("region", { name: "Muscle balance" }).getByRole("status")).toContainText("SYMMETRY SCORE");
});

test("Story Studio: free layouts export, PRO layouts and the watermark switch ask to unlock, founders get a badge", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.waitForURL(/\/workout\/summary\?id=/);
  const summary = page.url();

  await simulate(page, "Free locked");
  await page.goto(summary);
  await page.getByRole("button", { name: "Share to IG Story" }).click();
  const studio = page.getByRole("dialog", { name: "Share to Instagram Story" });
  await expect(studio.getByRole("button", { name: "Download High-Res PNG" })).toBeEnabled();
  await studio.getByRole("button", { name: "Brutalist Receipt", exact: true }).click();
  await expect(studio.getByText("PRO layout preview")).toBeVisible();
  await studio.getByRole("button", { name: "Download High-Res PNG" }).click();
  const pay = page.getByRole("dialog", { name: "Precision engineered for serious lifters." });
  await expect(pay).toContainText("Unlock feature: Story Studio pro presets");
  await pay.getByRole("button", { name: "Close" }).click();

  await studio.getByRole("tab", { name: "Pro" }).click();
  await studio.getByRole("switch", { name: "Hide ABOT watermark" }).click();
  await expect(pay).toContainText("Unlock feature: Story without watermark");
  await pay.getByRole("button", { name: "Close" }).click();
  const badge = studio.getByRole("switch", { name: "Show founder badge" });
  await badge.click();
  await expect(badge).toHaveAttribute("aria-checked", "true");
});
