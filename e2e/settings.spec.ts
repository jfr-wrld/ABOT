import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, freshStart, logSet, startEmptyWorkout, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("switching to lbs changes the logger label and header unit", async ({ page }) => {
  await page.goto("/settings?section=general");
  await expectNoHorizontalOverflow(page);
  await page.getByText("lbs", { exact: true }).click();
  await waitForSavedSetting(page, "weightUnit", "lbs");
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "135", "5");
  await expect(page.locator("dd").nth(1)).toHaveText("675 lbs");
  await expect(page.getByLabel("Set 1 weight in lbs")).toBeVisible();
});

test("RPE is off for a new lifter and the toggle shows the column", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await expect(page.getByLabel(/RPE, 6 to 10/)).toHaveCount(0);
  await page.goto("/settings?section=workout");
  const toggle = page.getByRole("switch", { name: "RPE column" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.goto("/workout");
  await expect(page.getByLabel("Set 1 RPE, 6 to 10")).toBeVisible();
});

test("storage protection status is shown", async ({ page }) => {
  await page.goto("/settings?section=data");
  await expect(page.getByRole("heading", { name: "Storage on this device" })).toBeVisible();
  await expect(page.getByText(/^(Protected|Not protected|This browser cannot)/)).toBeVisible();
});

test("each setting keeps its explanation behind an info button", async ({ page }) => {
  await freshStart(page);
  await page.goto("/settings?section=general");
  const text = page.getByText("Stored in kg; this only changes what you see and type.");
  await expect(text).toBeHidden();
  const info = page.getByRole("button", { name: "About weight unit" });
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  await expect(text).toBeVisible();
  await info.click();
  await expect(text).toBeHidden();
});

test("Settings lists its groups and opens each section", async ({ page }) => {
  await page.goto("/settings");
  await expectNoHorizontalOverflow(page);
  for (const group of ["Account", "Preferences", "Support"]) await expect(page.getByRole("region", { name: group })).toBeVisible();
  await expect(page.getByRole("link", { name: /Contact us/ })).toHaveAttribute("href", /^mailto:aljasidik@gmail\.com\?subject=ABOT/);
  // Social accounts show once they exist; none has a link yet, so there is no dead "Soon" row.
  await expect(page.getByRole("region", { name: "Follow ABOT" })).toHaveCount(0);
  // Signed out: no Sign out button.
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);

  await page.getByRole("link", { name: /FAQ/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "FAQ" })).toBeVisible();
  await page.getByRole("button", { name: "Do I need an account?" }).click();
  await expect(page.getByText(/Sign in with Google only if/)).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: /About ABOT/ }).click();
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("old #sync links open the Data section", async ({ page }) => {
  await page.goto("/settings#sync");
  await page.waitForURL(/section=data/);
  await expect(page.getByRole("region", { name: "Backup & Sync" })).toBeVisible();
});

test("language and theme choices are saved", async ({ page }) => {
  await page.goto("/settings?section=general");
  await page.getByRole("radiogroup", { name: "Theme" }).getByText("Light").click();
  await waitForSavedSetting(page, "theme", "light");
  await page.getByRole("radiogroup", { name: "Language" }).getByText("Bahasa Indonesia").click();
  await waitForSavedSetting(page, "language", "id");
  // The app switches at once and stays Indonesian after a reload.
  await expect(page.getByRole("heading", { level: 1, name: "Umum" })).toBeVisible();
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  await expect(nav.getByRole("link", { name: "Beranda" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await page.reload();
  await expect(nav.getByRole("link", { name: "Profil" })).toBeVisible();
});


test("search finds a setting and opens its section at it", async ({ page }) => {
  await page.goto("/settings");
  const search = page.getByRole("searchbox", { name: "Search settings" });
  await search.fill("week");
  const results = page.getByRole("region", { name: "Results" });
  await results.getByRole("link", { name: /^Week starts on/ }).click();
  await expect(page).toHaveURL(/section=general#first-day$/);
  await expect(page.getByRole("combobox", { name: "Week starts on" })).toBeInViewport();

  await page.goto("/settings");
  await search.fill("zzzz");
  await expect(page.getByRole("status").filter({ hasText: "Nothing in Settings matches “zzzz”." })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
