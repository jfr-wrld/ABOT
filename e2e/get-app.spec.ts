import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const APK = "https://github.com/jfr-wrld/ABOT/releases/latest/download/abot.apk";

test.describe("Android browser", () => {
  test.use({ userAgent: ANDROID, viewport: { width: 390, height: 844 } });

  test("the intro ends on the app slide, with the web still one tap away", async ({ page }) => {
    await freshStart(page, { intro: true });
    await page.waitForURL("**/onboarding");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "ABOT hits harder as an app (beta)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download for Android" })).toHaveAttribute("href", APK);
    await page.getByRole("button", { name: "Keep using the web" }).click();
    await expect(page.getByRole("heading", { name: "What are you training for?" })).toBeVisible();
  });

  test("Home offers the app; the sheet downloads it, explains the beta, and Later hides the banner", async ({ page }) => {
    await freshStart(page);
    const banner = page.getByRole("region", { name: "ABOT app" });
    await expect(banner).toContainText("rings your rest timer");
    await banner.getByRole("button", { name: "Get the app" }).click();
    const sheet = page.getByRole("dialog", { name: "ABOT for Android (beta)" });
    await expect(sheet.getByRole("link", { name: "Download for Android" })).toHaveAttribute("href", APK);
    await expect(sheet.getByText("Beta", { exact: true })).toBeVisible();
    await sheet.getByText("How to install, and moving your data").click();
    await expect(sheet.getByText("Tap Download. Your browser saves abot.apk.")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await banner.getByRole("button", { name: "Hide for now" }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
    await expect(page.getByRole("region", { name: "ABOT app" })).toHaveCount(0);
  });
});

test.describe("desktop browser", () => {
  test.use({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });
  test("Settings opens the sheet with a QR code to scan", async ({ page }) => {
    await freshStart(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: /Get the Android app/ }).click();
    const sheet = page.getByRole("dialog", { name: "ABOT for Android (beta)" });
    await expect(sheet.getByRole("img", { name: "QR code to download ABOT for Android" })).toBeVisible();
    await expect(sheet.getByText(APK)).toBeVisible();
  });
});

test.describe("iPhone browser", () => {
  test.use({ userAgent: IPHONE, viewport: { width: 390, height: 844 } });

  test("no download, only how to add ABOT to the Home Screen", async ({ page }) => {
    await freshStart(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: /Add ABOT to your Home Screen/ }).click();
    const sheet = page.getByRole("dialog", { name: "ABOT on your iPhone" });
    await expect(sheet.getByText("Choose Add to Home Screen.")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Download for Android" })).toHaveCount(0);
  });
});
