import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("a superset is labelled A1/A2, hands off with no rest, and rests after its last exercise", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await addExercise(page, "Bent Over Row (Barbell)");
  await page.getByRole("button", { name: "Options for Bench Press (Barbell)" }).click();
  await page.getByRole("button", { name: "Add to superset" }).click();
  await page.getByRole("dialog", { name: "Superset Bench Press (Barbell) with" }).getByRole("button", { name: /Bent Over Row/ }).click();
  await expect(page.getByText("Superset // A1")).toBeVisible();
  await expect(page.getByText("Superset // A2")).toBeVisible();

  await logSet(page, 1, "60", "8", "Bench Press (Barbell)");
  await expect(page.getByRole("timer")).toHaveCount(0);
  // The island names the next exercise instead of starting rest.
  await expect(page.getByRole("status").filter({ hasText: "Next: Bent Over Row (Barbell), Set 1, no rest" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next: Bent Over Row (Barbell), Set 1, no rest" })).toBeVisible();
  await logSet(page, 1, "50", "10", "Bent Over Row (Barbell)");
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Next: / })).toHaveCount(0);

  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByRole("button", { name: "Options for Bent Over Row (Barbell)" }).click();
  await page.getByRole("button", { name: "Remove from superset" }).click();
  await expect(page.getByText(/Superset \/\//)).toHaveCount(0);
});

test("a giant set scrolls to each next exercise and labels A1 to A3", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await startEmptyWorkout(page);
  for (const name of ["Bench Press (Barbell)", "Bent Over Row (Barbell)", "Squat (Barbell)"]) await addExercise(page, name);
  const link = async (from: string, to: RegExp) => {
    await page.getByRole("button", { name: `Options for ${from}` }).click();
    await page.getByRole("button", { name: "Add to superset" }).click();
    await page.getByRole("dialog", { name: `Superset ${from} with` }).getByRole("button", { name: to }).click();
  };
  await link("Bench Press (Barbell)", /Bent Over Row/);
  await link("Squat (Barbell)", /Bent Over Row/);
  for (const n of [1, 2, 3]) await expect(page.getByText(`Giant set // A${n}`)).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await logSet(page, 1, "60", "8", "Bench Press (Barbell)");
  await logSet(page, 1, "50", "10", "Bent Over Row (Barbell)");
  await expect(page.getByRole("button", { name: "Next: Squat (Barbell), Set 1, no rest" })).toBeVisible();
  // The third card was below the fold; the hand-off brings its top near the top of the screen.
  const squat = page.locator("section").filter({ has: page.getByRole("heading", { name: "Squat (Barbell)", exact: true }) });
  await expect.poll(async () => (await squat.boundingBox())!.y).toBeLessThan(80);
  await expect(page.getByRole("timer")).toHaveCount(0);
  await logSet(page, 1, "100", "5", "Squat (Barbell)");
  await expect(page.getByRole("timer")).toBeVisible();
});

test("exercise detail is split into Summary, History and How to", async ({ page }) => {
  await page.goto("/exercises/detail?id=squat-barbell");
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
  await page.goto("/exercises/detail?id=squat-barbell");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByText("Last done")).toBeVisible();
  await expect(page.getByText("Never", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start a workout with this" }).click();
  await page.waitForURL("**/workout");
  await expect(page.getByRole("heading", { name: "Squat (Barbell)", exact: true })).toBeVisible();

  // With a workout running, the same page adds to it instead.
  await page.goto("/exercises/detail?id=bench-press-barbell");
  await page.getByRole("button", { name: "Add to workout" }).click();
  await expect(page.getByRole("button", { name: "In your workout" })).toBeDisabled();
  await page.getByRole("link", { name: "Open the workout in progress" }).last().click();
  await page.waitForURL("**/workout");
  await expect(page.getByRole("heading", { name: "Bench Press (Barbell)", exact: true })).toBeVisible();
});

test("the workout capsule sits above a detail page's action bar, not over it", async ({ page }) => {
  await startEmptyWorkout(page);
  await page.goto("/exercises/detail?id=bench-press-barbell");
  const capsule = page.getByRole("button", { name: /^Workout running/ });
  const bar = page.getByRole("button", { name: "Add to workout" });
  const c = (await capsule.boundingBox())!;
  const b = (await bar.boundingBox())!;
  expect(c.y + c.height).toBeLessThanOrEqual(b.y);
});

test("the exercise page shows its real start and end photos alternating", async ({ page }) => {
  // Answer the dataset's photo URLs with a local frame so the test runs offline.
  const frame = await readFile(path.join(__dirname, "fixtures", "frame0.jpg"));
  await page.route("https://raw.githubusercontent.com/**", (r) => r.fulfill({ body: frame, contentType: "image/jpeg" }));
  await page.goto("/exercises/detail?id=bench-press-barbell");
  await expect(page.getByRole("img", { name: "Bench Press (Barbell), start position" })).toBeAttached();
  await expect(page.getByRole("img", { name: "Bench Press (Barbell), end position" })).toBeAttached();
  const phase = page.getByTestId("hero-phase");
  await expect(phase).toHaveText("Start");
  await expect(phase).toHaveText("End", { timeout: 3000 });
  await page.getByRole("button", { name: "Pause photos" }).click();
  const held = await phase.textContent();
  await page.waitForTimeout(1500);
  await expect(phase).toHaveText(held ?? "");
});
