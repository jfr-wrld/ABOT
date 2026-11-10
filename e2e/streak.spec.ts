import { expect, test } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout } from "./helpers";

test("the first workout lights the streak once, with its sound, then the summary", async ({ page }) => {
  await page.addInitScript(() => {
    const tones: number[] = [];
    (window as unknown as { __tones: number[] }).__tones = tones;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      const osc = create.call(this);
      const set = osc.frequency.setValueAtTime.bind(osc.frequency);
      osc.frequency.setValueAtTime = (v: number, t: number) => {
        tones.push(Math.round(v));
        return set(v, t);
      };
      return osc;
    };
  });
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();

  const streak = page.getByRole("dialog", { name: "Streak started" });
  await expect(streak).toBeVisible();
  await expect(streak.getByText("1-week streak")).toBeAttached();
  await expect(streak.getByRole("list", { name: "Recent weeks" }).getByRole("listitem")).toHaveCount(5);
  // The ember, the ignition thump and the roar.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __tones: number[] }).__tones))
    .toEqual(expect.arrayContaining([300, 140, 90]));
  await expect(streak.getByRole("button", { name: "Continue" })).toBeFocused();

  await streak.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Workout saved" })).toBeVisible();

  // A reload of the same summary does not light it again.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Workout saved" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /^Streak/ })).toHaveCount(0);
});

test("a second workout in the same week goes straight to the summary", async ({ page }) => {
  await freshStart(page);
  for (const round of [1, 2]) {
    await startEmptyWorkout(page);
    await addExercise(page, "Bench Press (Barbell)");
    await logSet(page, 1, "60", "8");
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();
    if (round === 1) await page.getByRole("dialog", { name: "Streak started" }).getByRole("button", { name: "Continue" }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name: "Workout saved" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /^Streak/ })).toHaveCount(0);
});

test("tapping the streak on Home plays the flame again", async ({ page }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog", { name: "Streak started" }).getByRole("button", { name: "Continue" }).click();

  await page.goto("/");
  await page.getByRole("button", { name: "1-week streak" }).click();
  const replay = page.getByRole("dialog", { name: "Your week streak" });
  await expect(replay).toBeVisible();
  await expect(replay.getByText("1-week streak")).toBeAttached();
  await replay.getByRole("button", { name: "Continue" }).click();
  await expect(replay).toHaveCount(0);
  await expect(page.getByRole("button", { name: "1-week streak" })).toBeVisible();
});
