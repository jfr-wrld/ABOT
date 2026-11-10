import { expect, test, type Page } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout } from "./helpers";

/**
 * Battery: once a moment has played out, nothing on screen should keep animating. An endless
 * animation keeps the phone redrawing (and the screen at full refresh rate) for a whole workout.
 */
async function endlessAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations === Infinity)
      .map((a) => {
        const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
        return `${(a as CSSAnimation).animationName ?? "animation"} on ${el?.className ?? el?.tagName ?? "?"}`;
      }),
  );
}

test.describe("battery", () => {
  test("the workout screen comes to rest between sets", async ({ page }) => {
    await freshStart(page);
    await startEmptyWorkout(page);
    await addExercise(page, "Bench Press (Barbell)");
    await logSet(page, 1, "60", "8");
    // The rest bar runs as one timed animation, not an endless one.
    await expect(page.getByRole("timer")).toBeVisible();
    await page.waitForTimeout(5000);
    expect(await endlessAnimations(page)).toEqual([]);
    await page.getByRole("button", { name: "Skip rest" }).click();
    await page.waitForTimeout(5000);
    expect(await endlessAnimations(page)).toEqual([]);
  });

  test("Home comes to rest during a workout", async ({ page }) => {
    await freshStart(page);
    await startEmptyWorkout(page);
    await addExercise(page, "Bench Press (Barbell)");
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Workout in progress/ })).toBeVisible();
    await page.waitForTimeout(8000);
    expect(await endlessAnimations(page)).toEqual([]);
  });
});
