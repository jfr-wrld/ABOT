import { expect, test, type Page } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout, waitForSavedSetting, reachSummary } from "./helpers";

/** Records every oscillator frequency the page schedules. */
async function recordTones(page: Page) {
  await page.addInitScript(() => {
    const tones: number[] = [];
    (window as unknown as { __tones: number[] }).__tones = tones;
    const proto = AudioContext.prototype;
    const create = proto.createOscillator;
    proto.createOscillator = function (this: AudioContext) {
      const osc = create.call(this);
      const set = osc.frequency.setValueAtTime.bind(osc.frequency);
      osc.frequency.setValueAtTime = (v: number, t: number) => {
        tones.push(Math.round(v));
        return set(v, t);
      };
      return osc;
    };
  });
}
const tones = (page: Page) => page.evaluate(() => [...(window as unknown as { __tones: number[] }).__tones]);

test.beforeEach(async ({ page }) => {
  await recordTones(page);
  await freshStart(page);
});

test("ticking a set plays the latch; Sounds & vibration off silences it", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await expect.poll(() => tones(page)).toEqual(expect.arrayContaining([600, 900]));

  // The rest timer's -15s / +15s steppers tick.
  const before = (await tones(page)).length;
  await page.getByRole("button", { name: "Extend rest by 15 seconds" }).click();
  await expect.poll(async () => (await tones(page)).slice(before)).toEqual([1400]);

  await page.goto("/settings?section=workout");
  const toggle = page.getByRole("switch", { name: "Sounds & vibration" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await waitForSavedSetting(page, "tapFeedback", false);

  await page.goto("/workout");
  const quiet = (await tones(page)).length;
  await logSet(page, 2, "60", "8");
  await page.waitForTimeout(300);
  expect((await tones(page)).length).toBe(quiet);
});

test("a heavier repeat of a lift plays the record chord; a first-ever lift does not", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.waitForTimeout(400);
  expect(await tones(page)).not.toContain(440);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);

  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  const before = (await tones(page)).length;
  await logSet(page, 1, "70", "8");
  await expect.poll(async () => (await tones(page)).slice(before)).toEqual(expect.arrayContaining([440, 554, 659, 880]));
});

test("starting plays the power-on glide and finishing plays the closing chord", async ({ page }) => {
  await startEmptyWorkout(page);
  await expect.poll(() => tones(page)).toEqual(expect.arrayContaining([220, 880]));
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  const before = (await tones(page)).length;
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);
  await expect.poll(async () => (await tones(page)).slice(before)).toEqual(expect.arrayContaining([523, 659, 784, 1047]));
});

test("the end of a rest pips at 3, 2, 1 and then rings", async ({ page }) => {
  await page.clock.install();
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await expect(page.getByRole("timer")).toBeVisible();
  const before = (await tones(page)).length;
  for (let i = 0; i < 6 * 60; i++) {
    await page.clock.runFor(500);
    if ((await tones(page)).slice(before).filter((f) => f === 1000).length >= 3) break;
  }
  const rest = (await tones(page)).slice(before);
  expect(rest.filter((f) => f === 800)).toHaveLength(3);
  expect(rest.filter((f) => f === 1000)).toHaveLength(3);
  expect(rest.indexOf(800)).toBeLessThan(rest.indexOf(1000));
});
