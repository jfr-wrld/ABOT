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
  // A device with no routines opens on the templates; the empty state is one tab away.
  await expect(page.getByRole("tab", { name: "Template Vault" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "My Routines" }).click();
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
  await expect(page.getByRole("heading", { name: "Push / Pull / Legs" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Legs", exact: true })).toBeVisible();
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
