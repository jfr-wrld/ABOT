import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addExercise, expectNoHorizontalOverflow, freshStart, logSet, startEmptyWorkout } from "./helpers";

const LAYOUTS = [
  "Obsidian Raw",
  "Thermal Matrix",
  "Brutalist Receipt",
  "Cyber-Volt HUD",
  "Monochrome Steel",
  "PR Trophy Vault",
  "Photo Backdrop",
  "Split Spec Sheet",
  "Loaded Bar",
  "Plate Grid",
  "Volt Poster",
];

/** Logs one bench set and finishes; the app lands on the new summary page. */
async function finishOneSet(page: Page) {
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.waitForURL(/\/workout\/summary\//);
}

async function openStudio(page: Page) {
  await page.getByRole("button", { name: "Share to IG Story" }).click();
  const dialog = page.getByRole("dialog", { name: "Share to Instagram Story" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: /story card/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Download High-Res PNG" })).toBeEnabled();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("finishing shows the summary with a way to share and a way home", async ({ page }) => {
  await finishOneSet(page);
  await expect(page.getByRole("heading", { level: 1, name: "Workout saved" })).toBeVisible();
  await expect(page.getByText("480 kg").first()).toBeAttached();
  // A first-ever bench is a baseline, not a record: there was nothing to beat.
  await expect(page.getByRole("heading", { name: "1 new lift" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /personal record/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share to IG Story" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "See every set" }).click();
  await page.waitForURL(/\/history\//);
  await expect(page.getByRole("button", { name: "Share story" })).toBeVisible();
});

test("the studio switches between every layout and downloads a 1080 x 1920 PNG", async ({ page }) => {
  await finishOneSet(page);
  const dialog = await openStudio(page);
  await expectNoHorizontalOverflow(page);

  for (const name of LAYOUTS) {
    const button = dialog.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("img", { name: new RegExp(`^${name} story card`) })).toBeVisible();
  }
  await expect(dialog.getByRole("button", { pressed: true })).toHaveCount(1);

  const size = await dialog.getByRole("img", { name: /story card/ }).evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  expect(size).toEqual([1080, 1920]);

  await expect(dialog.getByRole("button", { name: "Download High-Res PNG" })).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download High-Res PNG" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^abot-story-\d{4}-\d{2}-\d{2}-volt-poster\.png$/);
  const file = await download.path();
  const { readFileSync } = await import("node:fs");
  const head = readFileSync(file).subarray(16, 24);
  expect([head.readUInt32BE(0), head.readUInt32BE(4)]).toEqual([1080, 1920]);
  await expect(dialog.getByText(/Saved abot-story-/)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a background photo brings the overlay and grayscale controls", async ({ page }) => {
  await finishOneSet(page);
  const dialog = await openStudio(page);
  await expect(dialog.getByLabel("Overlay opacity")).toHaveCount(0);
  await dialog.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "frame0.jpg"));

  const slider = dialog.getByLabel("Overlay opacity");
  await expect(slider).toHaveAttribute("min", "0.2");
  await expect(slider).toHaveAttribute("max", "0.85");
  await slider.fill("0.8");
  await expect(dialog.getByText("80%")).toBeVisible();

  const gray = dialog.getByRole("switch", { name: /Grayscale photo/ });
  await expect(gray).toHaveAttribute("aria-checked", "false");
  await gray.click();
  await expect(gray).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Monochrome Steel", exact: true }).click();
  await expect(gray).toBeDisabled();

  await dialog.getByRole("button", { name: "Remove background photo" }).click();
  await expect(slider).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Upload Background Photo" })).toBeVisible();
});

test("a file that is not an image is refused with a message", async ({ page }) => {
  await finishOneSet(page);
  const dialog = await openStudio(page);
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo") });
  await expect(dialog.getByRole("alert")).toHaveText("Pick a photo (JPEG, PNG or WebP).");
});

test("share hands a PNG to the system share sheet", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: { name: string; type: string; title?: string; text?: string }[] = [];
    (window as unknown as { __shares: typeof calls }).__shares = calls;
    Object.defineProperty(navigator, "canShare", { value: (d: ShareData) => Boolean(d.files?.length), configurable: true });
    Object.defineProperty(navigator, "share", {
      value: async (d: ShareData) => {
        const f = d.files?.[0];
        calls.push({ name: f?.name ?? "", type: f?.type ?? "", title: d.title, text: d.text });
      },
      configurable: true,
    });
  });
  await finishOneSet(page);
  const dialog = await openStudio(page);
  await dialog.getByRole("button", { name: "Thermal Matrix", exact: true }).click();
  const share = dialog.getByRole("button", { name: "Share to Instagram / System Share" });
  await expect(share).toBeEnabled();
  await share.click();
  await expect(dialog.getByText("Sent to the share sheet.")).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { __shares: unknown[] }).__shares);
  expect(calls).toEqual([
    {
      name: expect.stringMatching(/-thermal-matrix\.png$/),
      type: "image/png",
      title: "ABOT Workout Story",
      text: "Crushed today's workout with ABOT ⚡",
    },
  ]);
});

test("browsers without file sharing get a disabled share button and the reason", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  await finishOneSet(page);
  const dialog = await openStudio(page);
  await expect(dialog.getByRole("button", { name: "Share to Instagram / System Share" })).toBeDisabled();
  await expect(dialog.getByText(/cannot hand images to other apps/)).toBeVisible();
});

test("the studio opens and exports with the network cut", async ({ page, context }) => {
  await finishOneSet(page);
  await context.setOffline(true);
  const dialog = await openStudio(page);
  await dialog.getByRole("button", { name: "Brutalist Receipt", exact: true }).click();
  // A new layout remakes the PNG; the button is disabled until it is ready.
  await expect(dialog.getByRole("button", { name: "Download High-Res PNG" })).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download High-Res PNG" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-brutalist-receipt\.png$/);
  await context.setOffline(false);
});

test("an unknown summary id says the workout is not here", async ({ page }) => {
  await page.goto("/workout/summary/does-not-exist");
  await expect(page.getByRole("heading", { name: "Workout not found" })).toBeVisible();
});

test("a heavier repeat celebrates the record and compares with last time", async ({ page }) => {
  await finishOneSet(page);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "70", "8");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.waitForURL(/\/workout\/summary\//);
  await expect(page.getByRole("heading", { name: "1 personal record" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /new lift/ })).toHaveCount(0);
  const compare = page.getByRole("region", { name: /Volume vs last/ });
  await expect(compare).toContainText("+17%");
  await expectNoHorizontalOverflow(page);
});

test("the username typed in the studio is kept on the profile", async ({ page }) => {
  await finishOneSet(page);
  const dialog = await openStudio(page);
  const handle = dialog.getByRole("textbox", { name: "Username on the story" });
  await handle.fill("@Jafar Lifts!");
  await expect(handle).toHaveValue("JafarLifts");
  await page.keyboard.press("Escape");
  await page.goto("/profile");
  await expect(page.getByText("@JafarLifts").first()).toBeVisible();
});
