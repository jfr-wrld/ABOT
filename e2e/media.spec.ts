import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { freshStart } from "./helpers";

const FRAMES = "**/yuhonas/free-exercise-db/main/exercises/**";

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

test("motion tab crossfades start and end frames and can be paused", async ({ page }) => {
  await serveFrames(page);
  await page.goto("/exercises/bench-press-barbell");
  const media = page.getByRole("region", { name: "Exercise media" });
  await expect(media.getByRole("tab", { name: "Motion" })).toHaveAttribute("aria-selected", "true");
  const phase = media.getByTestId("motion-phase");
  await expect(phase).toHaveText("Start position");
  await expect(phase).toHaveText("End position", { timeout: 3000 });
  await media.getByRole("button", { name: "Pause motion" }).click();
  const frozen = await phase.textContent();
  await page.waitForTimeout(1500);
  await expect(phase).toHaveText(frozen ?? "");
  await expect(media.getByRole("button", { name: "Play motion" })).toBeVisible();
});

test("missing images show a text fallback instead of a broken box", async ({ page }) => {
  await page.route(FRAMES, (route) => route.abort("internetdisconnected"));
  await page.goto("/exercises/bench-press-barbell");
  await expect(page.getByText("Images need a connection.")).toBeVisible();
});

test("video tab: search links, custom video validation, saved link, removal", async ({ page }) => {
  await serveFrames(page);
  await page.goto("/exercises/bench-press-barbell");
  const media = page.getByRole("region", { name: "Exercise media" });
  await media.getByRole("tab", { name: "Video" }).click();
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
  await page.getByRole("region", { name: "Exercise media" }).getByRole("tab", { name: "Video" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /abcDEF12345/);
  await page.getByRole("button", { name: "Remove custom video" }).click();
  await expect(page.getByText("No tutorial video set for this exercise.")).toBeVisible();
});

test("video tab offline says so instead of loading a player", async ({ page, context }) => {
  await page.goto("/exercises/bench-press-barbell");
  await context.setOffline(true);
  await page.getByRole("region", { name: "Exercise media" }).getByRole("tab", { name: "Video" }).click();
  await page.getByRole("button", { name: "Set custom video" }).click();
  await page.getByLabel("Video link").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Save video" }).click();
  await expect(page.getByText("Video needs a connection.")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await context.setOffline(false);
});

test("anatomy tab highlights primary and secondary muscles; tabs work with arrow keys", async ({ page }) => {
  await page.goto("/exercises/bench-press-barbell");
  const media = page.getByRole("region", { name: "Exercise media" });
  await media.getByRole("tab", { name: "Motion" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(media.getByRole("tab", { name: "Anatomy" })).toHaveAttribute("aria-selected", "true");
  await expect(media.getByRole("img", { name: "Primary: Chest. Secondary: Triceps, Shoulders." })).toBeVisible();
  await expect(media.locator('[data-region="chest"]').first()).toHaveAttribute("data-level", "primary");
  await expect(media.locator('[data-region="triceps"]').first()).toHaveAttribute("data-level", "secondary");
  await expect(media.locator('[data-region="quadriceps"]').first()).toHaveAttribute("data-level", "none");
});
