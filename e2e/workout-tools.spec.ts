import { expect, test } from "@playwright/test";
import { addExercise, choose, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("pause stops the workout clock and resume carries on", async ({ page }) => {
  await startEmptyWorkout(page);
  const duration = page.getByRole("button", { name: /^Duration/ });
  await duration.click();
  await page.getByRole("dialog").getByRole("button", { name: "Pause workout timer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
  const frozen = await duration.textContent();
  await page.waitForTimeout(2200);
  await expect(duration).toHaveText(frozen!);

  await duration.click();
  await page.getByRole("dialog").getByRole("button", { name: "Resume workout timer" }).click();
  await expect(page.getByText("Paused", { exact: true })).toHaveCount(0);
  await expect(duration).not.toHaveText(frozen!, { timeout: 4000 });
});

test("exercises can be reordered from the exercise menu", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await addExercise(page, "Squat (Barbell)");
  await page.getByRole("button", { name: "Options for Squat (Barbell)" }).click();
  await page.getByRole("button", { name: "Reorder exercises" }).click();
  const sheet = page.getByRole("dialog", { name: "Reorder exercises" });
  await sheet.getByRole("button", { name: "Move Squat (Barbell) up" }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  const headings = page.locator("main section h2");
  await expect(headings.first()).toHaveText("Squat (Barbell)");
});

test("replace swaps the movement and keeps what was typed", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByLabel(/^Set 1 weight in /).fill("60");
  await page.getByLabel("Set 1 reps").fill("8");
  await page.getByRole("button", { name: "Options for Bench Press (Barbell)" }).click();
  await page.getByRole("button", { name: "Replace exercise" }).click();
  const picker = page.getByRole("dialog", { name: "Replace Bench Press (Barbell)" });
  await picker.getByLabel("Search exercises").fill("Bench Press (Dumbbell)");
  await picker.getByRole("button", { name: /^Bench Press \(Dumbbell\)/ }).click();
  await expect(page.getByRole("heading", { name: "Bench Press (Dumbbell)", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bench Press (Barbell)", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Set 1 reps")).toHaveValue("8");
  await logSet(page, 1, "60", "8");
});

test("the library is grouped by muscle, each exercise with a bundled photo", async ({ page }) => {
  await page.goto("/exercises");
  await expect(page.getByRole("button", { name: "Body map" })).toHaveCount(0);
  const chest = page.getByRole("region", { name: /^Chest/ });
  const legs = page.getByRole("region", { name: /^Quads/ });
  await expect(chest.getByRole("link", { name: /^Bench Press \(Barbell\)/ })).toBeVisible();
  await expect(legs.getByRole("link", { name: /^Squat \(Barbell\)/ })).toBeVisible();
  await expect(chest.getByRole("link", { name: /^Squat/ })).toHaveCount(0);

  // The photo ships with the app: same origin, and it really decodes.
  const img = chest.getByRole("link", { name: /^Bench Press \(Barbell\)/ }).locator("[data-thumb] img");
  await expect(img).toHaveAttribute("src", "/thumbs/bench-press-barbell.webp");
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(128);
  // The corner badge names the equipment with the same icon as the equipment filter.
  await expect(chest.getByRole("link", { name: /^Bench Press \(Barbell\)/ }).locator("[data-equipment]")).toHaveAttribute(
    "data-equipment",
    "barbell",
  );

  await page.goto("/workout");
  await page.getByRole("button", { name: "Start an empty workout" }).click();
  await page.getByRole("button", { name: "Add exercise" }).click();
  await expect(page.getByRole("dialog").locator("[data-thumb] img").first()).toBeVisible();
});

test("the muscle filter counts groups drawn as one shape together", async ({ page }) => {
  await page.goto("/exercises");
  await choose(page, page.getByLabel("Muscle group"), "Quads");
  // Each option carries a picture: the muscle lit on the figure, the equipment drawn.
  await expect(page.getByLabel("Muscle group").locator("svg g[fill='#ccff00']").first()).toBeVisible();
  await page.getByLabel("Equipment").click();
  await expect(page.getByRole("option", { name: "Barbell", exact: true }).locator("svg")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: /^Squat \(Barbell\)/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Bench Press \(Barbell\)/ })).toHaveCount(0);
});
