import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

test("splash covers the first paint, then gets out of the way", async ({ page }) => {
  await freshStart(page);
  await page.reload();
  await expect(page.getByRole("status", { name: "Loading ABOT" })).toBeAttached();
  await expect(page.getByRole("status", { name: "Loading ABOT" })).toHaveCount(0, { timeout: 3000 });
  await page.getByRole("button", { name: "Start an empty workout" }).click();
  await page.waitForURL("**/workout");
});

test("a new device sees the intro once, with Next and swipe", async ({ page }) => {
  await freshStart(page, { intro: true });
  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: "Log a set in one tap" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Rest runs up top" })).toBeVisible();

  // Swipe left with a finger-like drag.
  const slide = page.getByRole("group", { name: "2 of 3" });
  const box = (await slide.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "Your training stays on this phone" })).toBeVisible();

  await page.getByRole("button", { name: "Start training" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === "/");
});

test("skipping the intro goes straight to Home", async ({ page }) => {
  await freshStart(page, { intro: true });
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
});

test("login offers Google sign-in only when this build can use it", async ({ page }) => {
  await freshStart(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Back up and sync" })).toBeVisible();
  const google = page.getByRole("button", { name: "Sign in with Google" });
  // A build without Supabase settings says so; with them the button is live (not clicked here:
  // it would leave for Google). e2e/sync.spec.ts covers the signed-in flow.
  if (await page.getByText("Cloud sync is not set up for this build.").isVisible()) {
    await expect(google).toBeDisabled();
  } else {
    await expect(google).toBeEnabled();
  }
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "Continue without an account" }).click();
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
});

test("switching tabs lands on each page", async ({ page }) => {
  await freshStart(page);
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const [tab, heading] of [
    ["Exercises", "Exercises"],
    ["Profile", "Profile"],
    ["Workout", "Workout"],
  ] as const) {
    await nav.getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
});
