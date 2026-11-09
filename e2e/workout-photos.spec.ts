import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, freshStart, logSet, startEmptyWorkout } from "./helpers";

const PHOTO = path.join(__dirname, "fixtures", "frame0.jpg");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

async function finishToSummary(page: Page) {
  await startEmptyWorkout(page);
  // No gym yet: the logger offers to add one instead of an empty dropdown.
  await expect(page.getByRole("link", { name: "Add your gym to tag workouts" })).toBeVisible();
  await addExercise(page, "Squat (Barbell)");
  await logSet(page, 1, "100", "5");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.waitForURL(/\/workout\/summary\?id=/);
}

test("a photo added on the summary stays with the workout on this phone, and can be deleted", async ({ page }) => {
  await finishToSummary(page);
  const photos = page.getByRole("region", { name: "Photos" });
  await expect(photos).toContainText("Photos stay on this phone. They are not in backups or sync.");
  await photos.getByLabel("Workout photo file").setInputFiles(PHOTO);
  await expect(photos.getByRole("button", { name: "Open photo 1 of 1" })).toBeVisible();
  await expect(photos).toContainText("1/6");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "See every set" }).click();
  await page.waitForURL(/\/history\?id=/);
  const detail = page.getByRole("region", { name: "Photos" });
  await expect(detail.getByRole("button", { name: "Open photo 1 of 1" })).toBeVisible();
  await page.reload();
  await expect(detail.getByRole("button", { name: "Open photo 1 of 1" })).toBeVisible();

  // The viewer opens over the page and Escape closes it.
  await detail.getByRole("button", { name: "Open photo 1 of 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Workout photo" });
  await expect(viewer.getByRole("img", { name: "Workout photo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);

  await detail.getByRole("button", { name: "Open photo 1 of 1" }).click();
  await viewer.getByRole("button", { name: "Delete" }).click();
  await expect(viewer).toContainText("Delete this photo? It cannot be undone.");
  await viewer.getByRole("button", { name: "Delete" }).click();
  await expect(viewer).toHaveCount(0);
  await expect(detail.getByRole("button", { name: /Open photo/ })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Add photo" })).toBeVisible();
});

test("a finished workout can be tagged with a gym, and the gym shows on Home", async ({ page }) => {
  await finishToSummary(page);
  const detailUrl = page.url().replace(/\/workout\/summary\?/, "/history?");

  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Tag a gym" }).click();
  const sheet = page.getByRole("dialog", { name: "Where did you train?" });
  await expect(sheet).toContainText("No gyms yet.");
  await sheet.getByRole("link", { name: "Add a gym in Settings" }).click();
  await page.getByLabel("New gym name").fill("Iron Temple");
  await page.getByRole("button", { name: "Add gym" }).click();
  await expect(page.getByRole("heading", { name: "Iron Temple", exact: true })).toBeVisible();

  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Tag a gym" }).click();
  await sheet.getByRole("radio", { name: "Iron Temple" }).click();
  await expect(page.getByRole("button", { name: "Gym: Iron Temple. Change" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Squat|Workout/ }).first()).toContainText("Iron Temple");

  // And back to no gym.
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Gym: Iron Temple. Change" }).click();
  await sheet.getByRole("radio", { name: "No gym" }).click();
  await expect(page.getByRole("button", { name: "Tag a gym" })).toBeVisible();
});
