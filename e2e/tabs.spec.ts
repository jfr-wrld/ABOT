import { expect, test } from "@playwright/test";
import { addExercise, freshStart, logSet, startEmptyWorkout } from "./helpers";

test("a second tab waits, takes over cleanly, and keeps what the first tab logged", async ({ page, context }) => {
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "100", "5");

  const second = await context.newPage();
  await second.goto("/");
  const notice = second.getByRole("dialog", { name: "ABOT is open in another tab" });
  await expect(notice).toBeVisible();
  await expect(second.getByRole("button", { name: "Start an empty workout" })).toHaveCount(0);

  await notice.getByRole("button", { name: "Use ABOT here" }).click();
  await expect(notice).toHaveCount(0);
  // The set logged in the first tab made it to storage before the handover.
  await second.goto("/workout");
  await expect(second.getByLabel("Set 1 reps")).toHaveValue("5");

  // The first tab now steps aside instead of writing over the second.
  await expect(page.getByRole("dialog", { name: "ABOT is open in another tab" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Use ABOT here" }).click();
  await expect(page.getByRole("dialog", { name: "ABOT is open in another tab" })).toHaveCount(0);
  await expect(second.getByRole("dialog", { name: "ABOT is open in another tab" })).toBeVisible();
});
