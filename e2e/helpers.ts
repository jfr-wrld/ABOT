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

export async function startEmptyWorkout(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Start an empty workout" }).click();
  await page.waitForURL("**/workout");
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
  await page.waitForURL(/\/workout\/summary\//);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Waits until a settings change has reached IndexedDB, before a test reloads the page. */
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
                resolve((req.result?.value as Record<string, unknown> | undefined)?.[f]);
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
