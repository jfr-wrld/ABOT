import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

// The intro's three slides as a desktop browser sees them; Android browsers get a fourth, the
// app pitch (e2e/get-app.spec.ts).
test.use({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });

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
  await expect(page.getByRole("heading", { name: "Rest sits by your thumb" })).toBeVisible();

  // Swipe left with a finger-like drag.
  const slide = page.getByRole("group", { name: "2 of 3" });
  const box = (await slide.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "Your training stays on this phone" })).toBeVisible();

  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.getByRole("heading", { name: "What are you training for?" })).toBeVisible();
  await page.getByRole("button", { name: "Look around first" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === "/");
});

test("the intro ends at a training week: routines, schedule and Home follow it", async ({ page }) => {
  // A Monday, so today is a training day.
  await page.clock.setFixedTime(new Date(2026, 10, 16, 9, 0));
  await freshStart(page, { intro: true });
  await page.waitForURL("**/onboarding");
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Start training" }).click();

  await expect(page.getByRole("heading", { name: "What are you training for?" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "2 years +" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "How many days a week?" })).toBeVisible();
  await page.getByRole("button", { name: "5", exact: true }).click();
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) await expect(page.getByRole("button", { name: day })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "Where do you train?" })).toBeVisible();
  await page.getByRole("button", { name: /^Gym/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  // Five days: push, pull, legs, then upper and lower.
  await expect(page.getByRole("heading", { name: "Your week" })).toBeVisible();
  const week = page.getByRole("list", { name: "Your week" });
  for (const name of ["Push A: Strength", "Pull A: Width", "Legs A: Quads", "Upper day", "Lower day"]) await expect(week.getByText(name)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await week.getByRole("button", { name: /Push A: Strength/ }).click();
  await expect(week.getByText("Bench Press (Barbell)")).toBeVisible();
  await page.getByRole("button", { name: "Looks good" }).click();

  await expect(page.getByRole("heading", { name: "When do you train?" })).toBeVisible();
  await page.getByRole("button", { name: "Save without reminders" }).click();
  await expect(page.getByRole("heading", { name: "Your week is set" })).toBeVisible();
  await page.getByRole("button", { name: "Go to Home" }).click();

  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("link", { name: "Adjust your plan" }).first()).toContainText("5 days · 17:30");
  const rail = page.getByRole("list", { name: "This week" });
  await expect(rail.getByRole("button", { name: /Wednesday.*Legs, planned$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Push A: Strength" })).toBeVisible();
  await rail.getByRole("button", { name: /Wednesday/ }).click();
  await expect(page.getByRole("heading", { name: "Legs A: Quads" })).toBeVisible();

  await page.goto("/routines");
  await expect(page.getByRole("heading", { name: "My plan · 5 days" })).toBeVisible();
  await page.goto("/settings?section=notifications");
  await expect(page.getByRole("switch", { name: "Workout reminders" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Wednesday" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Sunday" })).toHaveAttribute("aria-pressed", "false");
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

for (const [w, h] of [
  [360, 640],
  [390, 844],
]) {
  test(`the intro and the permissions step fit a ${w}x${h} screen without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await freshStart(page, { intro: true });
    await page.waitForURL("**/onboarding");
    await expect(page.getByRole("heading", { name: "Log a set in one tap" })).toBeVisible();
    const fits = () => page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight);
    expect(await fits()).toBe(true);
    await page.goto("/permissions");
    await expect(page.getByRole("heading", { name: "Allow access" })).toBeVisible();
    expect(await fits()).toBe(true);
    await expect(page.getByRole("button", { name: "Allow all" })).toBeInViewport();
  });
}
