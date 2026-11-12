import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
  await page.goto("/routines");
});

test("the vault lists templates and filters them by split", async ({ page }) => {
  const list = page.getByRole("list", { name: "Templates" });
  await expect(list.getByRole("article")).toHaveCount(17);
  await page.getByRole("button", { name: "Calisthenics" }).click();
  await expect(list.getByRole("article")).toHaveCount(2);
  const card = list.getByRole("article", { name: "CALISTHENICS // UPPER [FLOW]" });
  await expect(card).toContainText("6 exercises");
  await expect(card).toContainText("Pike Push Up");
  await expect(card).toContainText("+1 more exercise");
  await page.getByRole("button", { name: "Full Body" }).click();
  await expect(list.getByRole("article", { name: "FULL BODY // DAY 01 [FOUNDATION]" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Start Workout loads the template with its target reps", async ({ page }) => {
  await page.getByRole("button", { name: "Start workout: Full Body Day 1" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByRole("heading", { name: "Squat (Barbell)", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hanging Leg Raise", exact: true })).toBeVisible();
  await expect(page.getByLabel("Set 1 reps").first()).toHaveValue("6");
});

test("a template's superset carries into the workout", async ({ page }) => {
  await page.getByRole("button", { name: "Specialized" }).click();
  await page.getByRole("button", { name: "Start workout: Shoulders and arms" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByText(/^Superset \/\/ A[12]$/)).toHaveCount(2);
});

test("Save to My Routines makes an editable copy", async ({ page }) => {
  await page.getByRole("button", { name: "Save to My Routines: Push A: Strength" }).click();
  await expect(page.getByRole("link", { name: "Saved, edit" })).toBeVisible();
  await page.getByRole("tab", { name: "My Routines" }).click();
  await expect(page.getByRole("heading", { name: "Push / Pull / Legs" })).toBeVisible();
  // The routine card itself; the same name also heads the "today" card above the tabs.
  const mine = page.getByRole("tabpanel", { name: "My Routines" });
  await expect(mine.getByRole("heading", { name: "Push A: Strength" })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "My Routines" }).click();
  await expect(mine.getByRole("heading", { name: "Push A: Strength" })).toBeVisible();
});
