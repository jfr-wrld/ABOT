import { expect, test } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await freshStart(page);
});

async function benchSession(page: import("@playwright/test").Page, kg: string, reps: string, sets = 2) {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  for (let i = 1; i <= sets; i++) {
    await logSet(page, i, kg, reps);
    await page.getByRole("button", { name: "Skip rest" }).click();
  }
  await finishWorkout(page);
}

test("the Coach Pill suggests one more rep after a clean session, and APPLY fills the sets left", async ({ page }) => {
  await benchSession(page, "80", "8");

  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  const pill = page.getByRole("group", { name: "Coach: Volume target" });
  await expect(pill).toContainText("80 kg × 9");
  await expect(pill).toContainText("(+1 rep)");
  await expectNoHorizontalOverflow(page);
  await pill.getByRole("button", { name: "Apply 80 kg × 9 to the sets left" }).click();
  for (const n of [1, 2, 3]) {
    await expect(page.getByLabel(new RegExp(`^Set ${n} weight in `))).toHaveValue("80");
    await expect(page.getByLabel(`Set ${n} reps`)).toHaveValue("9");
  }
  // The sets now hold the target, so the pill steps aside.
  await expect(pill).toHaveCount(0);
});

test("Swap: the dumbbell profile offers the dumbbell press at about 41% per hand and keeps the sets", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByLabel(/^Set 1 weight in /).fill("80");
  await page.getByRole("button", { name: "Swap Bench Press (Barbell) for another exercise" }).click();
  const sheet = page.getByRole("dialog", { name: "Swap Bench Press (Barbell)" });
  await sheet.getByRole("button", { name: "Dumbbell / Home" }).click();
  const row = sheet.getByRole("button", { name: /^Bench Press \(Dumbbell\)/ });
  await expect(row).toContainText(/\d+% match/i);
  await expect(row).toContainText("32.5 kg");
  await row.click();
  await expect(page.getByRole("heading", { name: "Bench Press (Dumbbell)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bench Press (Barbell)" })).toHaveCount(0);
  for (const n of [1, 2, 3]) await expect(page.getByLabel(new RegExp(`^Set ${n} weight in `))).toHaveValue("32.5");
});

test("the balance radar reads push-heavy training and says what to add", async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByRole("button", { name: "Add set" }).click();
  await page.getByRole("button", { name: "Add set" }).click();
  await page.getByRole("button", { name: "Add set" }).click();
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await logSet(page, n, "60", "8");
    await page.getByRole("button", { name: "Skip rest" }).click();
  }
  await finishWorkout(page);

  await page.goto("/profile");
  const card = page.getByRole("region", { name: "Muscle balance" });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole("status")).toContainText(/SYMMETRY SCORE: \d+\/100 \[(OPTIMAL|BALANCED|IMBALANCED|CRITICAL)\]/);
  await expect(card.getByRole("status")).toContainText("Skip-leg-day pattern");
  await expect(card.getByRole("img", { name: /^Balance radar\. Push 6/ })).toBeVisible();
  await card.getByRole("button", { name: "90 days" }).click();
  await expect(card.getByRole("status")).toContainText("SYMMETRY SCORE");
  await expectNoHorizontalOverflow(page);
});
