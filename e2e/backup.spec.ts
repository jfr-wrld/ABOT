import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("export, wipe the device, import with replace", async ({ page }, info) => {
  await startEmptyWorkout(page);
  await page.getByLabel("Workout name").fill("Backup Day");
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "100", "5");
  await finishWorkout(page);

  await page.goto("/settings?section=data");
  await expectNoHorizontalOverflow(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export backup" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^ABOT_BACKUP_\d{4}_\d{2}_\d{2}\.json$/);
  const file = info.outputPath("backup.json");
  await download.saveAs(file);
  const json = JSON.parse(await readFile(file, "utf8"));
  expect(json.app).toBe("ABOT");
  expect(json.data.sessions).toHaveLength(1);

  await freshStart(page);
  await expect(page.getByText("Backup Day")).toHaveCount(0);
  await page.goto("/settings?section=data");
  await page.getByLabel("Import backup").setInputFiles(file);
  await expect(page.getByText(/1 workout, 0 routines, 0 custom exercises/)).toBeVisible();
  await page.getByRole("button", { name: "Replace all my data" }).click();
  await page.getByRole("button", { name: "Yes, replace everything" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Backup Day").first()).toBeVisible();
});

test("an invalid file shows why it was refused", async ({ page }, info) => {
  const file = info.outputPath("bad.json");
  await writeFile(file, "{ not json");
  await page.goto("/settings?section=data");
  await page.getByLabel("Import backup").setInputFiles(file);
  await expect(page.getByRole("alert").filter({ hasText: "This file is not valid JSON" })).toBeVisible();
});

test("Delete my data: this phone only clears everything and starts over", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByLabel("Workout name").fill("Gone Day");
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "100", "5");
  await finishWorkout(page);

  await page.goto("/settings?section=data");
  await page.getByRole("button", { name: "Delete my data" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete my data" });
  // Signed out: the account option is not offered.
  await expect(sheet.getByRole("radio", { name: /This phone only/ })).toBeChecked();
  await expect(sheet.getByRole("radio", { name: /my account/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  // Cancel deletes nothing.
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/");
  await expect(page.getByText("Gone Day").first()).toBeVisible();

  await page.goto("/settings?section=data");
  await page.getByRole("button", { name: "Delete my data" }).click();
  await page.getByRole("dialog", { name: "Delete my data" }).getByRole("button", { name: "Delete from phone" }).click();
  // A fresh device: the intro again, and no workouts.
  await page.waitForURL("**/onboarding");
  // Only what the app writes again on start (the theme mirror) is back.
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("abot.")));
  expect(left.filter((k) => k !== "abot.theme")).toEqual([]);
  await page.evaluate(() => localStorage.setItem("abot.onboarded", "1"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
  await expect(page.getByText("Gone Day")).toHaveCount(0);
});

test("a replace import brings back the reminder week and live notification choice", async ({ page }, info) => {
  const file = info.outputPath("prefs.json");
  const off = { on: false, routineId: null };
  await writeFile(
    file,
    JSON.stringify({
      app: "ABOT",
      schemaVersion: 1,
      exportedAt: "",
      data: { sessions: [], routines: [], exercises: [], locations: [] },
      devicePrefs: {
        reminders: { enabled: true, time: "06:15", leadMinutes: 15, days: { 0: off, 1: { on: true, routineId: null }, 2: off, 3: off, 4: off, 5: off, 6: off } },
        liveStatus: false,
      },
    }),
  );
  await page.goto("/settings?section=data");
  await page.getByLabel("Import backup").setInputFiles(file);
  await page.getByRole("button", { name: "Replace all my data" }).click();
  await page.getByRole("button", { name: "Yes, replace everything" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("abot.liveStatus"))).toBe("0");
  // Saved to the device, so it survives a reload.
  await page.reload();
  const saved = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open("abot");
        open.onsuccess = () => {
          const get = open.result.transaction("kv").objectStore("kv").get("reminders");
          get.onsuccess = () => resolve(get.result?.value);
        };
      }),
  );
  expect(saved).toMatchObject({ enabled: true, time: "06:15", leadMinutes: 15 });
});
