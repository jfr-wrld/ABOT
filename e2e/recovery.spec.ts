import { expect, test } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";
import { finishedSession, seedDb } from "./seed-db";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page);
});

test("the recovery map colours trained muscles and explains each one on tap", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByRole("button", { name: /^Muscle recovery:/ });
  await expect(tile).toHaveAccessibleName("Muscle recovery: 17 of 17 muscles ready. Open the map.");

  // Five sets of bench press: 75% on the chest (high load), 37.5% on triceps and shoulders.
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByRole("button", { name: "Add set" }).click();
  await page.getByRole("button", { name: "Add set" }).click();
  for (const n of [1, 2, 3, 4, 5]) await logSet(page, n, "60", "8");
  await finishWorkout(page);

  await expect(tile).toHaveAccessibleName("Muscle recovery: 14 of 17 muscles ready. Open the map.");
  await tile.click();
  const dialog = page.getByRole("dialog", { name: "Muscle recovery" });
  const chest = dialog.getByRole("button", { name: /^Pectoralis major, 25% recovered$/ });
  await expect(chest).toHaveAttribute("data-stage", "high");
  await expect(dialog.getByRole("button", { name: /^Triceps brachii/ })).toHaveAttribute("data-stage", "recovering");
  await expect(dialog.getByRole("button", { name: /^Quadriceps/ })).toHaveAttribute("data-stage", "fresh");

  await chest.locator("path").first().click();
  await expect(chest).toHaveAttribute("aria-pressed", "true");
  const status = dialog.getByRole("status");
  await expect(status).toContainText("Pectoralis major // Recovery 25%", { ignoreCase: true });
  await expect(status).toContainText("Last trained just now (5 sets)");
  await expect(status).toContainText(/Ready in (39|40)h/);

  // The back shows the posterior muscles; the chest is not drawn there, so the pick clears.
  await dialog.getByRole("button", { name: "Posterior / Back" }).click();
  await expect(dialog.getByRole("button", { name: /^Pectoralis major/ })).toHaveCount(0);
  await expect(status).toContainText("Tap a muscle to see its recovery.");
  const hamstrings = dialog.getByRole("button", { name: /^Hamstrings/ });
  await hamstrings.focus();
  await page.keyboard.press("Enter");
  await expect(status).toContainText("Not trained in the last 6 days");
  await expect(status).toContainText("Ready now");
});

test("forty hours after a chest day the map shows the chest ready again", async ({ page }) => {
  await page.clock.install();
  await seedDb(page, { sessions: [finishedSession({ "bench-press-barbell": [[60, 8], [60, 8], [60, 8], [60, 8], [60, 8]] }, { daysAgo: 0.04 })] });
  const tile = page.getByRole("button", { name: /^Muscle recovery:/ });
  await expect(tile).toHaveAccessibleName("Muscle recovery: 14 of 17 muscles ready. Open the map.");
  // No waiting: the test clock jumps forty hours and the tile's own timer catches up.
  await page.clock.fastForward("40:00:00");
  await expect(tile).toHaveAccessibleName("Muscle recovery: 17 of 17 muscles ready. Open the map.");
});
