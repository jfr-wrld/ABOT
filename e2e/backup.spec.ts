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
  expect(download.suggestedFilename()).toMatch(/^abot-backup-\d{4}-\d{2}-\d{2}\.json$/);
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
  await expect(page.getByText("Backup Day")).toBeVisible();
});

test("an invalid file shows why it was refused", async ({ page }, info) => {
  const file = info.outputPath("bad.json");
  await writeFile(file, "{ not json");
  await page.goto("/settings?section=data");
  await page.getByLabel("Import backup").setInputFiles(file);
  await expect(page.getByRole("alert").filter({ hasText: "This file is not valid JSON" })).toBeVisible();
});
