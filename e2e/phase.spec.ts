import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart, waitForSavedSetting } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test("the setup wizard starts a cut, and the phase page logs weight, protein and water", async ({ page }) => {
  await page.getByRole("link", { name: "Choose a body phase" }).click();
  await page.waitForURL("**/phase/setup");
  // The first question is the goal in plain words; nothing is picked for the lifter.
  await expect(page.getByRole("heading", { level: 1, name: "What is your goal?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick a goal" })).toBeDisabled();
  await page.getByRole("radio", { name: /^Lose fat\s*Cut/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  // The weight can be typed: no ten taps from the 70 kg default.
  const weight = page.getByRole("group", { name: "Weight" }).getByRole("textbox");
  await weight.fill("75");
  await weight.press("Enter");
  await expect(weight).toHaveValue("75.0");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "How long, and where to" })).toBeVisible();
  await page.getByRole("radio", { name: /^12/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeVisible();
  await expect(page.getByText("Coach holds the weight when sets get hard")).toBeVisible();
  // Where the number comes from, one tap away.
  await expect(page.getByText(/average of your workouts over the last 4 weeks/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Start phase" }).click();
  await page.waitForURL((u) => u.pathname === "/phase");

  await expect(page.getByRole("heading", { level: 1, name: "Cut" })).toBeVisible();
  await expect(page.locator("#hero-week")).toHaveText("1/12");
  // The answers became the profile's: the weigh-in, age and sex are not asked again.
  await waitForSavedSetting(page, "bodyweightKg", 75);
  await waitForSavedSetting(page, "biologicalSex", "male");
  await page.getByText("How the target is worked out").first().click();
  await expect(page.getByText("Target today").first()).toBeVisible();
  await page.getByRole("button", { name: "Add 25 g protein" }).click();
  await page.getByRole("button", { name: "Add 500 ml water" }).click();
  await expect(page.getByRole("img", { name: "Protein: 25 / 165" })).toBeVisible();

  await page.getByRole("button", { name: "Weight: −0.1" }).click();
  await page.getByRole("button", { name: "Add body fat and waist" }).click();
  // The setup logged today's weigh-in, so this one updates it.
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Meals and foods" }).click();
  await page.waitForURL("**/phase/fuel");
  // Plan: one day sized to the cut's target, its training meals timed in place, logged whole.
  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.getByText("within 2 hours after").first()).toBeVisible();
  await page.getByRole("button", { name: "Log the whole day" }).click();
  await expect(page.getByRole("button", { name: "Day logged" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Shopping list" })).toBeVisible();
  await expect(page.getByText(/^Uncooked (white|brown) rice$/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  // Today: the log fills the rings.
  await page.getByRole("tab", { name: "Today" }).click();
  await expect(page.getByText(/kcal left today|kcal over today's target/)).toBeVisible();
  // The protein tap is a log entry; the water tap is not listed as food.
  await expect(page.getByText("Protein", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Water", { exact: true })).toHaveCount(0);
  // Foods: a drink's detail with its portion.
  await page.getByRole("tab", { name: "Foods" }).click();
  await page.getByRole("tab", { name: "Drinks" }).click();
  await page.getByRole("button", { name: /Coconut water/ }).click();
  const sheet = page.getByRole("dialog", { name: "Coconut water" });
  await expect(sheet.getByRole("button", { name: /1 glass · 250 ml/ })).toHaveAttribute("aria-pressed", "true");
  await expectNoHorizontalOverflow(page);
  await sheet.getByRole("button", { name: "Close" }).click();

  await waitForSavedSetting(page, "bodyPhase", expect.objectContaining({ phaseType: "CUTTING", durationWeeks: 12 }));
  await page.goto("/");
  const card = page.getByRole("region", { name: "Cut" });
  await expect(card).toContainText("W1/12");
  // The tap plus the logged day's protein.
  await expect(card.getByRole("img", { name: /^Protein: \d+ \/ 165$/ })).toBeVisible();

  // The setup added the full-body routines that fit three days a week.
  await page.goto("/routines");
  await expect(page.getByText("Full Body Day 1").first()).toBeVisible();
});

test("without a phase, the phase and fuel pages offer the setup", async ({ page }) => {
  await page.goto("/phase");
  await expect(page.getByText("No phase running.")).toBeVisible();
  await page.goto("/phase/fuel");
  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.getByRole("link", { name: "Choose a body phase" })).toBeVisible();
});

/** A cut that began `daysAgo`, with a weigh-in every other day changing `perWeek` kg a week. */
async function seedCut(page: import("@playwright/test").Page, daysAgo: number, perWeek: number, weeks = 8) {
  await page.evaluate(
    async ({ daysAgo, perWeek, weeks }) => {
      const DAY = 86_400_000;
      const key = (t: number) => {
        const d = new Date(t);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const start = Date.now() - daysAgo * DAY;
      const log: { id: string; date: number; weightKg: number }[] = [];
      for (let i = 0; i <= daysAgo; i += 2) log.push({ id: key(start + i * DAY), date: start + i * DAY, weightKg: 80 + (perWeek * i) / 7 });
      const bodyPhase = {
        id: "p1", phaseType: "CUTTING", title: "CUT", startDate: key(start), durationWeeks: weeks, startWeightKg: 80, targetWeightKg: 76,
        heightCm: 180, age: 30, biologicalSex: "male", activityMultiplier: 1.375, weeklyRatePercent: -0.5, isActive: true, sessionsPerWeek: 3,
      };
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("abot");
        open.onsuccess = () => {
          const tx = open.result.transaction("kv", "readwrite");
          const kv = tx.objectStore("kv");
          const get = kv.get("settings");
          get.onsuccess = () => {
            kv.put({ key: "settings", value: { ...(get.result?.value ?? {}), bodyPhase, bodyweightKg: log.at(-1)!.weightKg } });
            kv.put({ key: "bodyweightLog", value: log });
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { daysAgo, perWeek, weeks },
  );
  await page.goto("/phase");
}

test("the weekly check-in catches a stalled cut and moves the target with one tap", async ({ page }) => {
  await seedCut(page, 21, 0);
  const card = page.getByRole("region", { name: "Weekly check-in" });
  await expect(card).toContainText("Slower than planned");
  await expect(page.getByRole("link", { name: /Training this week/ })).toContainText("of 3 workouts");
  await card.getByRole("button", { name: "Eat 150 kcal less" }).click();
  await expect(card).toHaveCount(0);
  await page.getByText("How the target is worked out").first().click();
  await expect(page.getByText("Weekly check-ins").first()).toBeVisible();
  await expect(page.getByText("−150").first()).toBeVisible();
  // Answered: nothing more until next week, after a reload too.
  await page.reload();
  await expect(page.getByRole("region", { name: "Weekly check-in" })).toHaveCount(0);
});

test("a finished block sums up, suggests what's next, and can be closed", async ({ page }) => {
  await seedCut(page, 57, -0.4);
  const summary = page.getByRole("region", { name: "8 weeks done" });
  await expect(summary).toBeVisible();
  await expect(summary.getByRole("link", { name: /Lose fat and build muscle, slowly/ })).toHaveAttribute("href", "/phase/setup?next=RECOMP");
  await expectNoHorizontalOverflow(page);
  await summary.getByRole("button", { name: "End this phase" }).click();
  await expect(page.getByText("No phase running.")).toBeVisible();
});

test("setup offers routines for the chosen training days and saves them", async ({ page }) => {
  await page.goto("/phase/setup");
  await page.getByRole("radio", { name: /^Lose fat\s*Cut/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: "4 days a week" }).click();
  await expect(page.getByText("Upper", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Start phase" }).click();
  await page.waitForURL((u) => u.pathname === "/phase");
  await expect(page.getByRole("link", { name: /Training this week/ })).toContainText("of 4 workouts");
  await page.goto("/routines");
  await expect(page.getByText(/^Upper/).first()).toBeVisible();
  await expect(page.getByText(/^Lower/).first()).toBeVisible();
});
