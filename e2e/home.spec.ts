import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test("an empty device gets a working dashboard, not a blank page", async ({ page }) => {
  await freshStart(page);
  await expect(page.getByRole("list", { name: "This week" }).getByRole("listitem")).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "Free session" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a routine" })).toHaveAttribute("href", "/workout");
  const week = page.getByRole("region", { name: "This week" });
  await expect(week.getByText("Volume")).toBeVisible();
  await expect(week.getByText("0 of 7 days this week")).toBeAttached();
  await expect(week.getByRole("button", { name: "Muscle recovery: 17 of 17 muscles ready. Open the map." })).toBeVisible();
  await expect(page.getByText("No workouts yet.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("a finished workout lights today, fills the week and lists the session", async ({ page }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "80", "5");
  await page.getByRole("button", { name: "Skip rest" }).click();
  await finishWorkout(page);

  await page.goto("/");
  await expect(page.getByRole("list", { name: "This week" }).getByText(/, trained$/)).toHaveCount(1);
  const week = page.getByRole("region", { name: "This week" });
  // The figure counts up, so wait for its final value (the screen-reader copy is final at once).
  await expect(week.getByText("400", { exact: true }).first()).toBeAttached();
  await expect(week.getByText("1 of 7 days this week")).toBeAttached();
  // One set adds 15% to the chest: still fresh (20% or less), so every muscle reads ready.
  await expect(week.getByRole("button", { name: "Muscle recovery: 17 of 17 muscles ready. Open the map." })).toBeVisible();

  const card = page.getByRole("region", { name: "Recent workouts" }).getByRole("list").getByRole("link").first();
  await expect(card).toContainText("400 kg");
  await expect(card).toContainText("Today");
  await expect(card.locator("[data-thumb]")).toHaveCount(1);
  // A first attempt beats nothing, so it earns no record badge.
  await expect(card.getByText(/PR$/)).toHaveCount(0);
  await card.click();
  await page.waitForURL(/\/history\?id=/);
});

test("the hero offers the saved routine first, with an empty start beside it", async ({ page }) => {
  await freshStart(page);
  await page.goto("/routines");
  await page.getByRole("button", { name: "New routine" }).click();
  await page.getByLabel("Name").fill("Push A");
  await page.getByRole("button", { name: "Create and add exercises" }).click();
  await page.waitForURL(/\/routines\/edit\?id=/);
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill("Bench Press (Barbell)");
  await page.getByRole("button", { name: /^Bench Press \(Barbell\)/ }).first().click();
  await page.getByRole("button", { name: /^(Add|Done)/ }).first().click().catch(() => {});

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Push A" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
  await page.getByRole("button", { name: "Start Push A" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByText("Bench Press (Barbell)").first()).toBeVisible();
});
