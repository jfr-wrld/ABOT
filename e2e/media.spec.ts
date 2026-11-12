import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { addExercise, freshStart, startEmptyWorkout } from "./helpers";

// The photos alternate start and end: motion stays on here (the suite default is reduced).
test.use({ reducedMotion: "no-preference" });

const FRAMES = "**/yuhonas/free-exercise-db/main/exercises/**";

/** The video lives on the How to tab of the exercise detail page. */
async function openHowTo(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole("tab", { name: "How to" }).click();
}

/** Motion, video and anatomy together: the how-to sheet opened from a workout. */
async function openSheet(page: Page) {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await page.getByRole("heading", { name: "Bench Press (Barbell)", exact: true }).getByRole("button").click();
  return page.getByRole("dialog", { name: "Bench Press (Barbell)" }).getByRole("region", { name: "Exercise media" });
}

async function serveFrames(page: Page) {
  const f0 = await readFile(path.join(__dirname, "fixtures/frame0.jpg"));
  const f1 = await readFile(path.join(__dirname, "fixtures/frame1.jpg"));
  await page.route(FRAMES, (route) =>
    route.fulfill({ status: 200, contentType: "image/jpeg", body: route.request().url().endsWith("/1.jpg") ? f1 : f0 }),
  );
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>player</p>" }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("the motion tab plays the exercise's own photos, with no animated figure", async ({ page }) => {
  await serveFrames(page);
  const media = await openSheet(page);
  await expect(media.getByRole("tab", { name: "Motion" })).toHaveAttribute("aria-selected", "true");
  await expect(media.getByRole("button", { name: "Animation" })).toHaveCount(0);
  const phase = media.getByTestId("motion-phase");
  await expect(phase).toHaveText("Start position");
  await expect(phase).toHaveText("End position", { timeout: 3000 });
});

test("without a connection the motion shows the photo that ships with the app", async ({ page }) => {
  await page.route(FRAMES, (route) => route.abort("internetdisconnected"));
  const media = await openSheet(page);
  await expect(media.getByRole("img", { name: "Bench Press (Barbell), start position" })).toBeVisible();
  await expect(media.getByText("Images need a connection.")).toHaveCount(0);
});

test("the exercise page shows only the video: the motion plays in its hero, the muscles in Summary", async ({ page }) => {
  await openHowTo(page, "/exercises/detail?id=bench-press-barbell");
  const media = page.getByRole("region", { name: "Exercise media" });
  await expect(media.getByRole("tab")).toHaveCount(0);
  await expect(media.getByText("No tutorial video set for this exercise.")).toBeVisible();
});

test("video tab: search links, custom video validation, saved link, removal", async ({ page }) => {
  await serveFrames(page);
  await openHowTo(page, "/exercises/detail?id=bench-press-barbell");
  const media = page.getByRole("region", { name: "Exercise media" });
  await expect(media.getByText("No tutorial video set for this exercise.")).toBeVisible();
  await expect(media.getByRole("link", { name: "Search YouTube" })).toHaveAttribute(
    "href",
    "https://www.youtube.com/results?search_query=Bench%20Press%20(Barbell)%20proper%20form%20shorts",
  );
  await expect(media.getByRole("link", { name: "Search TikTok" })).toHaveAttribute("target", "_blank");

  await media.getByRole("button", { name: "Set custom video" }).click();
  await media.getByLabel("Video link").fill("https://example.com/not-a-video");
  await media.getByRole("button", { name: "Save video" }).click();
  await expect(media.getByRole("alert")).toContainText("Paste a YouTube, YouTube Shorts or TikTok video link");
  await media.getByLabel("Video link").fill("https://www.youtube.com/shorts/abcDEF12345");
  await media.getByRole("button", { name: "Save video" }).click();
  const frame = media.locator("iframe");
  await expect(frame).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/abcDEF12345\?.*mute=1/);
  await expect(frame).toHaveAttribute("title", "Video tutorial: Bench Press (Barbell)");

  await page.reload();
  await page.getByRole("tab", { name: "How to" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /abcDEF12345/);
  await page.getByRole("button", { name: "Remove custom video" }).click();
  await expect(page.getByText("No tutorial video set for this exercise.")).toBeVisible();
});

test("a TikTok share link is opened once and saved as the full video link", async ({ page }) => {
  await serveFrames(page);
  let answer: { status: number; body: unknown } = { status: 200, body: { embed_product_id: "7301234567890123456", author_unique_id: "coach.ari" } };
  await page.route(/www\.tiktok\.com\/oembed/, (route) => route.fulfill({ status: answer.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(answer.body) }));
  await page.route("https://www.tiktok.com/player/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>player</p>" }));
  await openHowTo(page, "/exercises/detail?id=bench-press-barbell");
  const media = page.getByRole("region", { name: "Exercise media" });
  await media.getByRole("button", { name: "Set custom video" }).click();

  // TikTok cannot say where the link goes: an error, and nothing saved.
  answer = { status: 404, body: {} };
  await media.getByLabel("Video link").fill("https://vt.tiktok.com/ZSpaKUad5/");
  await media.getByRole("button", { name: "Save video" }).click();
  await expect(media.getByRole("alert")).toContainText("Could not open this TikTok link");
  await expect(media.locator("iframe")).toHaveCount(0);

  answer = { status: 200, body: { embed_product_id: "7301234567890123456", author_unique_id: "coach.ari" } };
  await media.getByRole("button", { name: "Save video" }).click();
  await expect(media.locator("iframe")).toHaveAttribute("src", /tiktok\.com\/player\/v1\/7301234567890123456/);
  await page.reload();
  await page.getByRole("tab", { name: "How to" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /7301234567890123456/);
});

test("video tab offline says so instead of loading a player", async ({ page, context }) => {
  await openHowTo(page, "/exercises/detail?id=bench-press-barbell");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Set custom video" }).click();
  await page.getByLabel("Video link").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Save video" }).click();
  await expect(page.getByText("Video needs a connection.")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await context.setOffline(false);
});

test("anatomy tab highlights primary and secondary muscles; tabs work with arrow keys", async ({ page }) => {
  const media = await openSheet(page);
  await media.getByRole("tab", { name: "Motion" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(media.getByRole("tab", { name: "Anatomy" })).toHaveAttribute("aria-selected", "true");
  await expect(media.getByRole("img", { name: "Primary: Chest. Secondary: Triceps, Shoulders." })).toBeVisible();
  await expect(media.locator('[data-region="chest"]').first()).toHaveAttribute("data-level", "primary");
  await expect(media.locator('[data-region="triceps"]').first()).toHaveAttribute("data-level", "secondary");
  await expect(media.locator('[data-region="quadriceps"]').first()).toHaveAttribute("data-level", "none");
});

test("the exercise demo keeps looping with Lite effects, as it teaches the movement", async ({ page }) => {
  await serveFrames(page);
  await page.goto("/settings?section=general");
  await page.getByRole("radiogroup", { name: "Visual effects" }).getByText("Lite", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-effects", "lite");
  const phase = (await openSheet(page)).getByTestId("motion-phase");
  await expect(phase).toHaveText("Start position");
  await expect(phase).toHaveText("End position", { timeout: 3000 });
});
