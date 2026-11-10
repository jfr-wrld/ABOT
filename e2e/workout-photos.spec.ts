import path from "node:path";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, freshStart, logSet, startEmptyWorkout, reachSummary } from "./helpers";

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
  await reachSummary(page);
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
  await expect(sheet.getByRole("button", { name: "Find gyms near me" })).toBeVisible();
  await sheet.getByRole("link", { name: "Manage gyms in Settings" }).click();
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

test.describe("gyms from the map", () => {
  // Kemang, Jakarta; the map service is answered by the test, so nothing leaves the machine.
  test.use({ geolocation: { latitude: -6.2607, longitude: 106.8137 }, permissions: ["geolocation"] });

  async function answerMap(page: Page) {
    const queries: string[] = [];
    await page.route("https://overpass-api.de/api/interpreter?**", async (route) => {
      queries.push(decodeURIComponent(new URL(route.request().url()).searchParams.get("data") ?? ""));
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          elements: [
            { type: "node", id: 2, lat: -6.2700, lon: 106.8137, tags: { name: "Gold's Corner" } },
            { type: "way", id: 1, center: { lat: -6.2609, lon: 106.8139 }, tags: { name: "Iron Temple Kemang", "addr:street": "Jl. Kemang Raya", "addr:housenumber": "12" } },
          ],
        }),
      });
    });
    return queries;
  }

  test("Settings lists the gyms around you, nearest first, and adds one already pinned", async ({ page }) => {
    const queries = await answerMap(page);
    await page.goto("/settings?section=workout");
    await page.getByRole("button", { name: "Find gyms near me" }).click();
    const list = page.getByRole("list", { name: "Gyms near you" });
    await expect(list.getByRole("button")).toHaveCount(2);
    await expect(list.getByRole("button").first()).toContainText("Iron Temple Kemang");
    await expect(list.getByRole("button").first()).toContainText("Jl. Kemang Raya 12");
    await expect(page.getByText("Map data © OpenStreetMap contributors")).toBeVisible();
    expect(queries[0]).toContain("around:3000,-6.260700,106.813700");
    await expectNoHorizontalOverflow(page);

    await list.getByRole("button", { name: "Add Iron Temple Kemang" }).click();
    await expect(page.getByRole("heading", { name: "Iron Temple Kemang", exact: true })).toBeVisible();
    await expect(page.getByText("Picked by itself when a workout starts here.")).toBeVisible();
    await expect(list.getByRole("button", { name: "Iron Temple Kemang, added" })).toBeDisabled();
  });

  test("a finished workout is tagged straight from the map", async ({ page }) => {
    await answerMap(page);
    await finishToSummary(page);
    await page.goto(page.url().replace(/\/workout\/summary\?/, "/history?"));
    await page.getByRole("button", { name: "Tag a gym" }).click();
    const sheet = page.getByRole("dialog", { name: "Where did you train?" });
    await sheet.getByRole("button", { name: "Find gyms near me" }).click();
    await sheet.getByRole("button", { name: "Add Iron Temple Kemang" }).click();
    await expect(page.getByRole("button", { name: "Gym: Iron Temple Kemang. Change" })).toBeVisible();
  });

  test("when Overpass does not answer, OSM's search fills the list", async ({ page }) => {
    await page.route("https://overpass-api.de/api/interpreter?**", (route) => route.abort());
    const searches: string[] = [];
    await page.route("https://nominatim.openstreetmap.org/search?**", async (route) => {
      const q = new URL(route.request().url()).searchParams.get("q") ?? "";
      searches.push(q);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          q === "gym"
            ? [{ osm_type: "node", osm_id: 1, name: "Precision Gym", type: "fitness_centre", lat: "-6.2364", lon: "106.7981", address: { road: "Jalan Hang Tuah VII" } }]
            : [{ osm_type: "node", osm_id: 2, name: "Celebrity Fitness", type: "fitness_centre", lat: "-6.2654", lon: "106.7829", address: {} }],
        ),
      });
    });
    await page.goto("/settings?section=workout");
    await page.getByRole("button", { name: "Find gyms near me" }).click();
    const list = page.getByRole("list", { name: "Gyms near you" });
    await expect(list.getByRole("button")).toHaveCount(2);
    await expect(list.getByRole("button").first()).toContainText("Precision Gym");
    await expect(list.getByRole("button").first()).toContainText("Jalan Hang Tuah VII");
    expect(searches).toEqual(["gym", "fitness"]);
  });

  test("an unreachable map service says so", async ({ page }) => {
    await page.route("https://overpass-api.de/api/interpreter?**", (route) => route.abort());
    await page.route("https://nominatim.openstreetmap.org/search?**", (route) => route.abort());
    await page.goto("/settings?section=workout");
    await page.getByRole("button", { name: "Find gyms near me" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Could not reach the map service." })).toBeVisible();
  });
});

test.describe("a gym that is not on the map", () => {
  // A street in Yogyakarta where the map has no gym: the test answers the map with nothing.
  test.use({ geolocation: { latitude: -7.7956, longitude: 110.3695 }, permissions: ["geolocation"] });

  async function emptyMap(page: Page) {
    await page.route("https://overpass-api.de/api/interpreter?**", (route) => route.fulfill({ contentType: "application/json", body: '{"elements":[]}' }));
    await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  }

  test("is marked where you stand from Settings, and becomes the default", async ({ page }) => {
    await emptyMap(page);
    await page.goto("/settings?section=workout");
    await page.getByRole("button", { name: "Find gyms near me" }).click();
    await expect(page.getByText(/Many local gyms are not mapped yet/)).toBeVisible();
    await page.getByRole("button", { name: "At the gym? Mark it here" }).click();
    const sheet = page.getByRole("dialog", { name: "Mark your gym here" });
    await sheet.getByRole("button", { name: "Save gym at my position" }).click();
    await expect(sheet.getByRole("alert")).toHaveText("Enter a gym name");
    await sheet.getByLabel("Gym name").fill("Garasi Iron Jogja");
    await sheet.getByRole("button", { name: "Save gym at my position" }).click();
    await expect(page.getByText(/Garasi Iron Jogja marked here/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Garasi Iron Jogja", exact: true })).toBeVisible();
    await expect(page.getByText("Picked by itself when a workout starts here.")).toBeVisible();
  });

  test("is marked from a finished workout and tags it", async ({ page }) => {
    await emptyMap(page);
    await finishToSummary(page);
    await page.goto(page.url().replace(/\/workout\/summary\?/, "/history?"));
    await page.getByRole("button", { name: "Tag a gym" }).click();
    const tag = page.getByRole("dialog", { name: "Where did you train?" });
    await tag.getByRole("button", { name: "At the gym? Mark it here" }).click();
    const sheet = page.getByRole("dialog", { name: "Mark your gym here" });
    await sheet.getByLabel("Gym name").fill("Garasi Iron Jogja");
    await sheet.getByRole("button", { name: "Save gym at my position" }).click();
    await expect(page.getByRole("button", { name: "Gym: Garasi Iron Jogja. Change" })).toBeVisible();
  });
});
