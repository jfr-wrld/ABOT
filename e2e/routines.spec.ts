import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

async function createRoutine(page: import("@playwright/test").Page, name: string, folder = "") {
  await page.goto("/routines");
  await page.getByRole("button", { name: "New routine" }).click();
  await page.getByLabel("Name").fill(name);
  if (folder) await page.getByLabel(/^Folder/).fill(folder);
  await page.getByRole("button", { name: "Create and add exercises" }).click();
  await page.waitForURL(/\/routines\/.+\/edit/);
}

test("empty name shows an inline error", async ({ page }) => {
  await page.goto("/routines");
  await expect(page.getByText("No routines saved.")).toBeVisible();
  await page.getByRole("button", { name: "New routine" }).click();
  await page.getByRole("button", { name: "Create and add exercises" }).click();
  await expect(page.getByText("Give the routine a name")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("creates a routine with targets and starts it", async ({ page }) => {
  await createRoutine(page, "Push A", "Push / Pull / Legs");
  await expect(page.getByText("No exercises in this routine yet.")).toBeVisible();
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill("Bench Press (Barbell)");
  await page.getByRole("dialog").getByRole("button", { name: /^Bench Press \(Barbell\)/ }).click();
  await page.getByLabel("Set 1 target weight in kg").fill("60");
  await page.getByLabel("Set 1 target reps").fill("8");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Routines", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 2, name: "Push / Pull / Legs" })).toBeVisible();
  await expect(page.getByText("1 exercise · 3 sets")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Start Push A" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByLabel("Workout name")).toHaveValue("Push A");
  await expect(page.getByLabel("Set 1 weight in kg")).toHaveValue("60");
  await expect(page.getByLabel("Set 1 reps")).toHaveValue("8");
  await expect(page.getByRole("button", { name: /^Mark Set \d done$/ })).toHaveCount(3);
});

test("duplicates and deletes a routine", async ({ page }) => {
  await createRoutine(page, "Legs");
  await page.goto("/routines");
  await page.getByRole("button", { name: "Duplicate Legs" }).click();
  await expect(page.getByRole("heading", { name: "Legs (copy)" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Legs (copy)" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Legs (copy)" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 3, name: "Legs", exact: true })).toBeVisible();
});

test("a routine without exercises cannot be started", async ({ page }) => {
  await createRoutine(page, "Empty");
  await page.goto("/routines");
  await expect(page.getByRole("button", { name: "Start Empty" })).toBeDisabled();
});

test("blocks starting a routine while a workout is active", async ({ page }) => {
  await createRoutine(page, "Pull");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill("Pull Up");
  await page.getByRole("dialog").getByRole("button", { name: /^Pull Up/ }).click();
  await startEmptyWorkout(page);
  await page.goto("/routines");
  await page.getByRole("button", { name: "Start Pull" }).click();
  await expect(page.getByRole("heading", { name: "A workout is already in progress" })).toBeVisible();
  await page.getByRole("button", { name: "Go to current workout" }).click();
  await page.waitForURL("**/workout");
});

test("a template is added to the routines and can be started from its preview", async ({ page }) => {
  await page.goto("/routines");
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
  await page.getByRole("button", { name: "Add to routines: Push" }).click();
  await expect(page.getByRole("status")).toHaveText("Push added to your routines, in Push / Pull / Legs.");
  await expect(page.getByRole("button", { name: "Start Push" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Add again: Push" })).toBeVisible();
  // The saved routine lists the gear it needs, with icons.
  const saved = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Start Push" }) });
  const gear = saved.getByRole("list", { name: "Equipment" });
  await expect(gear.getByText("Barbell")).toBeVisible();
  await expect(gear.getByText("×2").first()).toBeVisible();
  await expect(gear.locator("svg")).toHaveCount(3);

  await page.getByRole("button", { name: "See exercises: Legs" }).click();
  const sheet = page.getByRole("dialog", { name: "Push / Pull / Legs: Legs" });
  await expect(sheet.getByText("Squat (Barbell)")).toBeVisible();
  await expect(sheet.getByText("4 × 6")).toBeVisible();
  await sheet.getByRole("button", { name: "Add and start" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByRole("heading", { name: "Squat (Barbell)", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Standing Calf Raise (Machine)", exact: true })).toBeVisible();
});
