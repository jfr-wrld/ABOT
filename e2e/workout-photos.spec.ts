import path from "node:path";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, freshStart, logSet, startEmptyWorkout } from "./helpers";

const PHOTO = path.join(__dirname, "fixtures", "frame0.jpg");
const PHOTO_2 = path.join(__dirname, "fixtures", "frame1.jpg");

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
  await expect(photos).toContainText("Photos stay on this phone and go into backup files. They are not synced.");
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

test("photos go into the backup file and come back with an import", async ({ page }, info) => {
  await finishToSummary(page);
  const detailUrl = page.url().replace(/\/workout\/summary\?/, "/history?");
  await page.getByRole("region", { name: "Photos" }).getByLabel("Workout photo file").setInputFiles(PHOTO);
  await expect(page.getByRole("button", { name: "Open photo 1 of 1" })).toBeVisible();

  await page.goto("/settings?section=data");
  const include = page.getByRole("checkbox", { name: /Include 1 workout photo/ });
  await expect(include).toBeChecked();
  await expectNoHorizontalOverflow(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export backup" }).click()]);
  const file = info.outputPath("backup.json");
  await download.saveAs(file);
  const json = JSON.parse(await readFile(file, "utf8"));
  expect(json.photos).toHaveLength(1);
  expect(json.photos[0].data).toMatch(/^data:image\/jpeg;base64,/);

  await freshStart(page);
  await page.goto("/settings?section=data");
  await page.getByLabel("Import backup").setInputFiles(file);
  await expect(page.getByText(/1 workout, .*1 photo/)).toBeVisible();
  await page.getByRole("button", { name: "Replace all my data" }).click();
  await page.getByRole("button", { name: "Yes, replace everything" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported 1 workout" })).toBeVisible();

  await page.goto(detailUrl);
  await expect(page.getByRole("region", { name: "Photos" }).getByRole("button", { name: "Open photo 1 of 1" })).toBeVisible();
});

test("Story Studio offers every photo of the workout as a background", async ({ page }) => {
  await finishToSummary(page);
  const photos = page.getByRole("region", { name: "Photos" });
  await photos.getByLabel("Workout photo file").setInputFiles(PHOTO);
  await expect(photos.getByRole("button", { name: "Open photo 1 of 1" })).toBeVisible();
  await photos.getByLabel("Workout photo file").setInputFiles(PHOTO_2);
  await expect(photos.getByRole("button", { name: "Open photo 2 of 2" })).toBeVisible();

  await page.getByRole("button", { name: "Share to IG Story" }).click();
  const studio = page.getByRole("dialog", { name: "Share to Instagram Story" });
  await studio.getByRole("tab", { name: "Photo" }).click();
  const choices = studio.getByRole("radiogroup", { name: "Photos from this workout" });
  // The first photo is used on opening; the second can be picked instead.
  await expect(choices.getByRole("radio", { name: "Workout photo 1" })).toHaveAttribute("aria-checked", "true");
  await choices.getByRole("radio", { name: "Workout photo 2" }).click();
  await expect(choices.getByRole("radio", { name: "Workout photo 2" })).toHaveAttribute("aria-checked", "true");
  await expect(choices.getByRole("radio", { name: "Workout photo 1" })).toHaveAttribute("aria-checked", "false");
  await studio.getByRole("button", { name: "Remove background photo" }).click();
  await expect(choices.getByRole("radio", { name: "Workout photo 2" })).toHaveAttribute("aria-checked", "false");

  // Back on Layout (after the Photo and PRO tabs) every thumbnail is drawn, not left blank.
  await studio.getByRole("tab", { name: "Pro" }).click();
  await studio.getByRole("tab", { name: "Layout" }).click();
  const layouts = studio.getByRole("list", { name: "Layouts" });
  await expect
    .poll(() =>
      layouts.locator("canvas").evaluateAll((cs) =>
        (cs as HTMLCanvasElement[]).every((c) => {
          const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4 * 97) if (d[i] !== 0) return true;
          return false;
        }),
      ),
    )
    .toBe(true);
});
