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

test("the streak can be shared as a story card in twelve themes", async ({ page }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  const streak = page.getByRole("dialog", { name: "Streak started" });
  await streak.getByRole("button", { name: "Share" }).click();

  const studio = page.getByRole("dialog", { name: "Share your streak" });
  await expect(studio).toBeVisible();
  const themes = studio.getByRole("list", { name: "Themes" }).getByRole("button");
  await expect(themes).toHaveCount(12);
  await expect(studio.getByRole("img", { name: "Volt Flame streak card: 1-week streak" })).toBeVisible();
  await expect(studio.getByRole("button", { name: "Download High-Res PNG" })).toBeEnabled({ timeout: 10_000 });
  await themes.nth(1).click();
  await expect(studio.getByRole("img", { name: "Inferno streak card: 1-week streak" })).toBeVisible();
  // Every theme is free, the last one included.
  await themes.nth(11).click();
  await expect(studio.getByRole("img", { name: "Terminal streak card: 1-week streak" })).toBeVisible();
  await expect(studio.getByRole("button", { name: "Download High-Res PNG" })).toBeEnabled({ timeout: 10_000 });
  await expect(studio.getByRole("button", { name: "Share", exact: true })).toBeEnabled();

  // Closing the studio leaves the streak screen in place.
  await studio.getByRole("button", { name: "Close" }).click();
  await expect(studio).toBeHidden();
  await expect(streak).toBeVisible();
});

test("the streak plays as a free video: the flame, the count rolling over, the weeks lighting up", async ({ page }) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog", { name: "Streak started" }).getByRole("button", { name: "Share" }).click();
  const studio = page.getByRole("dialog", { name: "Share your streak" });
  await studio.getByRole("radio", { name: "Video" }).click();
  await studio.getByRole("button", { name: "Make video" }).click();
  await expect(studio.getByRole("button", { name: /^(Share|Save) video$/ })).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), studio.getByRole("button", { name: "Save video" }).first().click()]);
  expect(download.suggestedFilename()).toMatch(/^abot-streak-1wk-volt-flame\.(mp4|webm)$/);
  const bytes = await (await import("node:fs/promises")).readFile((await download.path())!);
  if (download.suggestedFilename().endsWith(".mp4")) expect(bytes.subarray(4, 8).toString("latin1")).toBe("ftyp");
});
