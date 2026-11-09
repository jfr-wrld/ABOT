import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout, waitForSavedSetting } from "./helpers";

async function logWeighIn(page: Page, value: string) {
  await page.getByLabel(/^Weight to log in /).fill(value);
  await page.getByRole("button", { name: /^(Log weight|Update)$/ }).click();
}

test("profile opens from Home and starts honestly empty", async ({ page }) => {
  await freshStart(page);
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Progress", selected: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lifetime" }).locator("dd").first()).toHaveText("0");
  await expect(page.getByRole("region", { name: "Identity" }).getByText("0 workouts", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // The backup chip opens About at the Account section.
  await page.getByRole("link", { name: "Guest, not backed up" }).click();
  await expect(page).toHaveURL(/\/profile\?tab=about$/);
  await expect(page.getByRole("tab", { name: "About", selected: true })).toBeVisible();
  await expect(page.getByText("Guest on this device")).toBeVisible();
  await expect(page.getByText("One weigh-in a day builds your trend.")).toBeVisible();
  await page.getByRole("tab", { name: "Lifts" }).click();
  await expect(page.getByText("Finish a workout to rank your lifts.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("name and height are saved on the device", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile?tab=about");
  await page.getByLabel("Name", { exact: true }).fill("Jafar Shodiq");
  await page.getByLabel("Height in cm").fill("170");
  await expect(page.getByRole("img", { name: "JS" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Jafar Shodiq" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Jafar Shodiq");
  await expect(page.getByLabel("Height in cm")).toHaveValue("170");
});

test("height switches to feet and inches with lbs, and back", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile?tab=about");
  await page.getByLabel("Height in cm").fill("170");
  await waitForSavedSetting(page, "heightCm", 170);
  await page.goto("/settings?section=general");
  await page.getByText("lbs", { exact: true }).click();
  await waitForSavedSetting(page, "weightUnit", "lbs");
  await page.goto("/profile?tab=about");
  await expect(page.getByLabel("Height, feet")).toHaveValue("5");
  await expect(page.getByLabel("Height, inches")).toHaveValue("7");
  await page.getByLabel("Height, inches").fill("11");
  await waitForSavedSetting(page, "heightCm", 180.3);
  await page.goto("/settings?section=general");
  await page.getByText("kg", { exact: true }).click();
  await waitForSavedSetting(page, "weightUnit", "kg");
  await page.goto("/profile?tab=about");
  await expect(page.getByLabel("Height in cm")).toHaveValue("180.3");
});

test("weigh-ins build a history; the same day updates, a mistake can be deleted", async ({ page }) => {
  await freshStart(page);
  // Yesterday's weigh-in, as if logged then.
  await page.evaluate(async () => {
    const day = new Date(Date.now() - 86_400_000);
    const id = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("abot");
      open.onsuccess = () => {
        const tx = open.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put({ key: "bodyweightLog", value: [{ id, date: day.getTime(), weightKg: 81 }] });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto("/profile?tab=about");
  await page.getByText("History", { exact: true }).click();
  const recent = page.getByRole("list", { name: "Recent weigh-ins" });
  await expect(recent.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Log another day to see the trend.")).toBeVisible();

  await logWeighIn(page, "80");
  await expect(recent.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Bodyweight over time in kg")).toBeAttached();
  await expect(page.getByText("−1 kg in 30 days")).toBeVisible();

  await logWeighIn(page, "79.5");
  await expect(recent.getByRole("listitem")).toHaveCount(2);
  await expect(recent.getByRole("listitem").first()).toContainText("79.5 kg");

  await recent.getByRole("button", { name: /^Delete weigh-in on/ }).first().click();
  await expect(recent.getByRole("listitem")).toHaveCount(1);
  await page.reload();
  await expect(recent.getByRole("listitem")).toHaveCount(1);
  await expect(recent).toContainText("81 kg");
});

test("an impossible weigh-in is refused with the range", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile?tab=about");
  await logWeighIn(page, "7");
  await expect(page.locator("#bw-log-error")).toHaveText("Enter 20 kg to 400 kg");
  await expect(page.getByLabel("Weight to log in kg")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("One weigh-in a day builds your trend.")).toBeVisible();
});

test("a profile photo is resized on the device, shown, and removable", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile?tab=about");
  await page.getByLabel("Name", { exact: true }).fill("Jafar");
  await page.getByLabel("Profile photo file").setInputFiles(path.join(__dirname, "fixtures", "frame0.jpg"));
  const avatar = page.getByRole("img", { name: "Photo of Jafar" });
  await expect(avatar).toBeVisible();
  const stored = await avatar.locator("image").getAttribute("href");
  expect(stored).toMatch(/^data:image\/jpeg;base64,/);
  expect(stored!.length).toBeLessThan(300_000);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Profile" }).locator("image")).toBeAttached();

  await page.goto("/profile?tab=about");
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByRole("img", { name: "J", exact: true })).toBeVisible();
});

test("lifetime stats and top lifts come from finished workouts", async ({ page }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "80", "5");
  await page.getByRole("button", { name: "Skip rest" }).click();
  await finishWorkout(page);

  await page.goto("/profile");
  const stats = page.getByRole("region", { name: "Lifetime" });
  await expect(stats.getByText("Workouts")).toBeVisible();
  await expect(stats.locator("dd").first()).toHaveText("1");
  await page.getByRole("tab", { name: "Lifts" }).click();
  const lifts = page.getByRole("region", { name: "Top lifts" });
  await expect(lifts.getByRole("link", { name: /Bench Press \(Barbell\)/ })).toBeVisible();
  await expect(lifts.getByText("80 kg × 5")).toBeVisible();
});

test("account and settings links lead somewhere real", async ({ page }) => {
  await freshStart(page);
  await page.goto("/profile?tab=about");
  await page.getByRole("link", { name: "Back up with an account" }).click();
  await expect(page.getByRole("heading", { name: "Back up and sync" })).toBeVisible();
  await page.goto("/profile?tab=about");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});
