import { expect, test } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("a superset is labelled, coloured, and rests only after its last exercise", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await addExercise(page, "Bent Over Row (Barbell)");
  await page.getByRole("button", { name: "Options for Bench Press (Barbell)" }).click();
  await page.getByRole("button", { name: "Add to superset" }).click();
  await page.getByRole("dialog", { name: "Superset Bench Press (Barbell) with" }).getByRole("button", { name: /Bent Over Row/ }).click();
  await expect(page.getByText("Superset A")).toHaveCount(2);

  await logSet(page, 1, "60", "8", "Bench Press (Barbell)");
  await expect(page.getByRole("timer")).toHaveCount(0);
  await logSet(page, 1, "50", "10", "Bent Over Row (Barbell)");
  await expect(page.getByRole("timer")).toBeVisible();

  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByRole("button", { name: "Options for Bent Over Row (Barbell)" }).click();
  await page.getByRole("button", { name: "Remove from superset" }).click();
  await expect(page.getByText("Superset A")).toHaveCount(0);
});

test("exercise detail is split into Summary, History and How to", async ({ page }) => {
  await page.goto("/exercises/squat-barbell");
  const tabs = page.getByRole("tablist", { name: "Exercise details" });
  await expect(tabs.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
  const muscles = page.getByRole("region", { name: "Muscles worked" });
  await expect(muscles).toBeVisible();
  await expect(muscles).toContainText("Primary Quads");
  await expect(page.getByRole("heading", { name: "Personal records" })).toBeVisible();

  await tabs.getByRole("tab", { name: "Summary" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Not logged yet.")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("region", { name: "Exercise media" })).toBeVisible();
});

test("a photo thumbnail falls back to the movement figure when the photo cannot load", async ({ page }) => {
  // Both the photo bundled with the app and the online one fail, so the figure must take over.
  await page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await page.route("**/thumbs/**", (route) => route.abort());
  await page.goto("/exercises");
  const squat = page.getByRole("link", { name: /^Squat \(Barbell\)/ });
  // Lazy photos load only on screen; bring the row into view so its photo is requested and fails.
  await squat.scrollIntoViewIfNeeded();
  await expect(squat.locator('[data-thumb="figure"]')).toBeVisible();
  await expect(squat.getByText("Quads")).toBeVisible();
});

test("the workout card shows the movement next to its name", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await expect(page.locator("main section").first().locator("[data-thumb]")).toBeVisible();
});

test("exercise detail: no dock, quick stats, and a workout started from it", async ({ page }) => {
  await page.goto("/exercises/squat-barbell");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByText("Last done")).toBeVisible();
  await expect(page.getByText("Never", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start a workout with this" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByRole("heading", { name: "Squat (Barbell)", exact: true })).toBeVisible();

  // With a workout running, the same page adds to it instead.
  await page.goto("/exercises/bench-press-barbell");
  await page.getByRole("button", { name: "Add to workout" }).click();
  await expect(page.getByRole("button", { name: "In your workout" })).toBeDisabled();
  await page.getByRole("link", { name: "Open the workout in progress" }).last().click();
  await page.waitForURL("**/workout");
  await expect(page.getByRole("heading", { name: "Bench Press (Barbell)", exact: true })).toBeVisible();
});

test("the workout capsule sits above a detail page's action bar, not over it", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.goto("/exercises/bench-press-barbell");
  const capsule = page.getByRole("link", { name: "Open the workout in progress" }).first();
  const bar = page.getByRole("button", { name: "Add to workout" });
  const c = (await capsule.boundingBox())!;
  const b = (await bar.boundingBox())!;
  expect(c.y + c.height).toBeLessThanOrEqual(b.y);
});
