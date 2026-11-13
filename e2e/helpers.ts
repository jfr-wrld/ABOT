import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Every test starts on a clean device: no saved workouts, routines, or settings. The intro is
 * marked as seen (e2e/onboarding.spec.ts covers it) so tests land on Home.
 */
export async function freshStart(page: Page, opts: { intro?: boolean } = {}): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (intro) => {
    localStorage.clear();
    if (!intro) localStorage.setItem("abot.onboarded", "1");
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("abot");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }, opts.intro ?? false);
  await page.reload();
  if (opts.intro) return;
  await expect(page.getByRole("heading", { level: 1, name: "ABOT" })).toBeVisible();
  await expect(page).toHaveTitle("ABOT");
  await expect(page.getByRole("button", { name: "Start an empty workout" })).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, "page scrolls sideways").toBeLessThanOrEqual(cw);
}

/** Starts an empty workout from Home; the picker it opens on is closed, ready for the test's steps. */
export async function startEmptyWorkout(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Start an empty workout" }).click();
  await page.waitForURL("**/workout");
  const picker = page.getByRole("dialog", { name: "Add exercise" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Close", exact: true }).click();
  await expect(picker).toBeHidden();
}

export async function addExercise(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByLabel("Search exercises").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${escape(name)}`) }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

/**
 * Fills weight and reps for working set `n` and ticks it. Pass kg = null for bodyweight.
 * With `exercise`, the lookup is scoped to that exercise's card.
 */
export async function logSet(page: Page, n: number, kg: string | null, reps: string, exercise?: string): Promise<void> {
  const scope = exercise
    ? page.locator("section").filter({ has: page.getByRole("heading", { name: exercise, exact: true }) })
    : page;
  if (kg !== null) await scope.getByLabel(new RegExp(`^Set ${n} weight in `)).first().fill(kg);
  await scope.getByLabel(`Set ${n} reps`).first().fill(reps);
  await scope.getByRole("button", { name: `Mark Set ${n} done` }).first().click();
}

export async function finishWorkout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await reachSummary(page);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

/**
 * After Finish: waits for the summary, passing the streak screen first when the workout grew
 * the week streak (a first workout always does).
 */
export async function reachSummary(page: Page): Promise<void> {
  await page.waitForURL(/\/workout\/summary\?id=/);
  const streak = page.getByRole("dialog", { name: /^Streak (started|extended)$/ });
  const saved = page.getByRole("heading", { level: 1, name: "Workout saved" });
  await expect(streak.or(saved)).toBeVisible();
  if (await streak.isVisible()) {
    await streak.getByRole("button", { name: "Continue" }).click();
    await expect(saved).toBeVisible();
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Waits until a settings change has reached IndexedDB, before a test reloads the page.
 * `field` may be a path into the settings ("entitlement.devOverrideMode").
 */
export async function waitForSavedSetting(page: Page, field: string, value: unknown): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (f) =>
          new Promise<unknown>((resolve) => {
            const open = indexedDB.open("abot");
            open.onsuccess = () => {
              const req = open.result.transaction("kv").objectStore("kv").get("settings");
              req.onsuccess = () => {
                resolve(f.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], req.result?.value));
                open.result.close();
              };
            };
          }),
        field,
      ),
    )
    .toEqual(value);
}

/** Opens one of ABOT's dropdowns and picks an option by its visible text. */
export async function choose(page: Page, dropdown: Locator, option: string): Promise<void> {
  await dropdown.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

/** Logs today's weigh-in on Profile > Body, the one place body weight is entered. */
export async function setBodyWeight(page: Page, kg: string): Promise<void> {
  await page.goto("/profile/body");
  await page.getByLabel(/^Weight to log in /).fill(kg);
  await page.getByRole("button", { name: /^(Log weight|Update)$/ }).click();
  await waitForSavedSetting(page, "bodyweightKg", Number(kg));
}

/** The Exercises library: a pill in the Show row (All, My favorites, a muscle). */
export async function showPill(page: Page, name: string): Promise<void> {
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name, exact: true }).click();
}

/** The Exercises library: opens Sort & filter, picks each option by its label, and shows the results. */
export async function sortAndFilter(page: Page, ...options: string[]): Promise<void> {
  // The button steps aside while the list scrolls down; a scroll up brings it back, as for a lifter.
  await page.mouse.wheel(0, -400);
  await page.getByRole("button", { name: /^Sort and filter/ }).click();
  const sheet = page.getByRole("dialog", { name: "Sort & filter" });
  for (const o of options) await sheet.getByRole("radio", { name: o, exact: true }).click();
  await sheet.getByRole("button", { name: /^Show \d+ exercises?$/ }).click();
  await expect(sheet).toHaveCount(0);
}
