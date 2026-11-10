import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

/** The build under test has Supabase when .env carries it; then the console is in server mode. */
function supabaseConfigured(): boolean {
  try {
    return /^NEXT_PUBLIC_SUPABASE_URL=.+$/m.test(fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8")) && process.env.E2E_REUSE_SERVER !== "1";
  } catch {
    return false;
  }
}
const configured = supabaseConfigured();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page);
});

/** Five taps on the build tag at the foot of Settings, then the PIN. */
async function openConsole(page: Page, expectMode = "● LOCAL MODE") {
  await page.goto("/settings");
  const tag = page.getByRole("button", { name: /\/\/ TELEMETRY BUILD$/ });
  for (let i = 0; i < 5; i++) await tag.click();
  await page.waitForURL(/\/admin/);
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Wrong PIN." })).toBeVisible();
  await page.getByLabel("PIN").fill("2026");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText(expectMode)).toBeVisible();
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Modules" }).getByRole("button", { name });

test.describe("local mode (no Supabase in the build)", () => {
  test.skip(configured, "this build has Supabase: see the server-mode test");

test("hidden entry, PIN gate, and the monetization switch with prices and banner reaching the app", async ({ page }) => {
  await openConsole(page);
  await nav(page, "Monetization").click();
  await page.getByRole("radio", { name: /COMMERCIAL_LIVE/ }).click();
  await page.getByLabel("Monthly IDR").fill("35000");
  await page.getByLabel(/Broadcast banner/).fill("v1.2 is out: Mission Control.");
  await page.getByRole("button", { name: "Push monetization config" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();

  await page.goto("/");
  const banner = page.getByRole("complementary", { name: "Announcement" });
  await expect(banner).toContainText("v1.2 is out: Mission Control.");
  await banner.getByRole("button", { name: "Dismiss announcement" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Announcement" })).toHaveCount(0);

  // Commercial mode: a free user is locked, and the paywall shows the new price.
  await page.goto("/settings");
  const card = page.getByRole("region", { name: "Plan & billing" });
  await expect(card).toContainText("PRO features are locked on this phone.");
  await card.getByRole("button", { name: "Get Black Pro" }).click();
  await expect(page.getByRole("dialog", { name: "Precision engineered for serious lifters." })).toContainText("Rp 35.000");
});

test("a code made in the console is redeemed on the device; built-in codes stop in commercial mode", async ({ page }) => {
  await openConsole(page);
  await nav(page, "Monetization").click();
  await page.getByRole("radio", { name: /COMMERCIAL_LIVE/ }).click();
  await page.getByRole("button", { name: "Push monetization config" }).click();
  await nav(page, "Licenses").click();
  await page.getByRole("radio", { name: "30-day influencer trial" }).click();
  await page.getByRole("button", { name: /Generate & copy/ }).click();
  const message = await page.getByLabel("Invite message").inputValue();
  const code = /ABOT-VIP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/.exec(message)![0];
  await expect(page.getByRole("table", { name: "Redeem codes" })).toContainText(code);
  await expect(page.getByRole("table", { name: "Redeem codes" })).toContainText("0/1");

  await page.goto("/settings");
  const card = page.getByRole("region", { name: "Plan & billing" });
  await expect(card).toContainText("PRO features are locked on this phone.");
  await card.getByRole("button", { name: "Redeem code" }).click();
  const redeem = page.getByRole("dialog", { name: "Redeem license code" });
  await redeem.getByLabel("VIP, influencer or promo code").fill("ABOT-NOPE-0000");
  await redeem.getByRole("button", { name: "Activate" }).click();
  await expect(redeem.getByRole("alert")).toHaveText("This code is not valid, or it has been used up.");
  await redeem.getByLabel("VIP, influencer or promo code").fill(code.toLowerCase());
  await redeem.getByRole("button", { name: "Activate" }).click();
  await expect(redeem.getByRole("status")).toContainText("License activated: ABOT // BLACK PRO");
  await expect(redeem.getByRole("status")).toContainText("30 days access");
  await redeem.getByRole("button", { name: "Done" }).click();
  await expect(card).toContainText("BLACK PRO");
  await expect(card.getByText("Days left")).toBeVisible();

  // Used once: a second redeem of the same code is refused.
  await card.getByRole("button", { name: "Redeem code" }).click();
  await redeem.getByLabel("VIP, influencer or promo code").fill(code);
  await redeem.getByRole("button", { name: "Activate" }).click();
  await expect(redeem.getByRole("alert")).toBeVisible();
  // Built-in codes are public, so once the app sells PRO they no longer unlock it.
  await redeem.getByLabel("VIP, influencer or promo code").fill("abot pro 30d");
  await redeem.getByRole("button", { name: "Activate" }).click();
  await expect(redeem.getByRole("alert")).toHaveText("This code is not valid, or it has been used up.");
  await page.keyboard.press("Escape");
  await expect(card).toContainText("BLACK PRO");
  // Days left is a counting figure (a visible copy and a screen-reader copy).
  await expect(card.getByText("30", { exact: true }).first()).toBeVisible();
});

test("algorithm calibration, exercise CMS and database tools change the app for real", async ({ page }) => {
  await openConsole(page);
  await nav(page, "Algorithms").click();
  await page.getByLabel("Body weight when unknown").fill("100");
  await page.getByRole("button", { name: "Push calibration" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Applied on this device" })).toBeVisible();

  await nav(page, "Exercises").click();
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill("Landmine Press");
  await page.getByLabel("Primary muscle").selectOption("shoulders");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Exercise added." })).toBeVisible();

  // The new exercise is in the app, and the calorie text uses the calibrated weight.
  await startEmptyWorkout(page);
  await addExercise(page, "Landmine Press");
  await logSet(page, 1, "20", "10");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.waitForURL(/\/workout\/summary\?id=/);
  await expect(page.getByText("Worked out for 100 kg.", { exact: false })).toBeVisible();

  await page.goto("/admin#database");
  await expect(page.getByRole("heading", { name: "Database", level: 1 })).toBeVisible();
  await expect(page.getByText("OK · No problems found")).toBeVisible();
  await page.getByRole("tab", { name: /^sessions 1$/ }).click();
  await expect(page.getByLabel("sessions as JSON")).toContainText("custom-");
  await page.getByLabel(/Type RESET/).fill("RESET");
  await page.getByRole("button", { name: "Reset device data" }).click();
  await expect(page.getByRole("status").filter({ hasText: "fresh install" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^sessions 0$/ })).toBeVisible();
});

test("desktop: sidebar layout with every module", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openConsole(page);
  for (const m of ["Overview", "Monetization", "Licenses", "Algorithms", "Exercises", "Routines & gyms", "Database", "Device"]) {
    await nav(page, m).click();
    await expect(page.getByRole("heading", { name: m, level: 1 })).toBeVisible();
  }
  const box = await page.getByRole("navigation", { name: "Modules" }).boundingBox();
  expect(box!.width).toBeLessThan(260);
  expect(box!.height).toBeGreaterThan(300);
});
});

test("server mode: signed out, Global modules stay closed and Device modules work", async ({ page }) => {
  test.skip(!configured, "needs a build with Supabase (.env)");
  await openConsole(page, "● NOT AN ADMIN");
  for (const m of ["Monetization", "Licenses", "Algorithms"]) {
    await nav(page, m).click();
    await expect(page.getByText("Admin account needed")).toBeVisible();
    await expect(page.getByText(/Sign in with the founder's Google account/)).toBeVisible();
  }
  await nav(page, "Database").click();
  await expect(page.getByText("OK · No problems found")).toBeVisible();
  await nav(page, "Exercises").click();
  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
});
