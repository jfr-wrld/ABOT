/**
 * Real ABOT screens for the intro video, on the sample data, at 3x (1080 px wide). Also the
 * logger at 0 to 3 sets ticked with where each tick button sits, and, at full size from the
 * studios' preview canvases, the eleven Story Studio layouts and the twelve streak theme cards.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { loadSampleData, pretendPhoneShare } from "../sample-data.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SCALE = 3;

export async function capture(base, dir) {
  mkdirSync(join(dir, "themes"), { recursive: true });
  mkdirSync(join(dir, "layouts"), { recursive: true });
  const meta = { scale: SCALE, width: 360 * SCALE, height: 760 * SCALE, boxes: {} };
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: SCALE, colorScheme: "dark" });
  await pretendPhoneShare(ctx);
  const page = await ctx.newPage();
  const settle = (ms = 1800) => page.waitForTimeout(ms);
  const shot = async (name) => {
    await page.screenshot({ path: join(dir, `${name}.png`) });
    console.log(`  screen ${name}`);
  };
  const box = async (name, locator) => {
    const b = await locator.boundingBox();
    if (b) meta.boxes[name] = { x: b.x * SCALE, y: b.y * SCALE, w: b.width * SCALE, h: b.height * SCALE };
  };

  await loadSampleData(page, base, join(dir, "sample-backup.json"));

  await page.goto(base + "/");
  await settle(3500);
  await shot("home");

  await page.goto(base + "/profile");
  await settle();
  await shot("progress");

  await page.goto(base + "/phase");
  await settle();
  await shot("phase");

  await page.goto(base + "/routines");
  await settle();
  await shot("routines");
  await page.getByRole("tab", { name: "Template Vault" }).click();
  await settle();
  await shot("vault");

  await page.goto(base + "/exercises");
  await settle(2500);
  await shot("exercises");
  await page.goto(base + "/exercises/detail?id=bench-press-barbell");
  await settle(2500);
  await shot("exercise");

  await page.goto(base + "/settings?section=general");
  await settle();
  await shot("settings");

  await page.goto(base + "/");
  await settle(2000);
  await page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first().click();
  await page.waitForURL(/\/history/);
  await settle();
  await shot("history");
  await page.getByText("Muscles worked").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 200);
  await settle(800);
  await shot("history-map");
  await page.mouse.wheel(0, -4000);
  await settle(600);
  await page.getByRole("button", { name: "Share story" }).click();
  await settle(2500);
  await shot("story");
  // The eleven workout story layouts, full size, from Story Studio's preview canvas.
  const story = page.getByRole("dialog", { name: "Share to Instagram Story" });
  const layouts = story.getByRole("list", { name: "Layouts" }).getByRole("button");
  const nLayouts = await layouts.count();
  for (let i = 0; i < nLayouts; i++) {
    await layouts.nth(i).click();
    await settle(500);
    const data = await story.locator("canvas[role=img]").evaluate((c) => c.toDataURL("image/png"));
    writeFileSync(join(dir, "layouts", `${String(i).padStart(2, "0")}.png`), Buffer.from(data.split(",")[1], "base64"));
  }
  console.log(`  ${nLayouts} story layouts`);
  await page.keyboard.press("Escape");

  // The twelve streak cards, full size, from the studio's preview canvas.
  await page.goto(base + "/");
  await settle(2000);
  await page.getByRole("button", { name: /-week streak$/ }).click();
  await settle(2600);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await settle(2000);
  const studio = page.getByRole("dialog", { name: "Share your streak" });
  const themes = studio.getByRole("list", { name: "Themes" }).getByRole("button");
  const count = await themes.count();
  for (let i = 0; i < count; i++) {
    await themes.nth(i).click();
    await settle(500);
    const data = await studio.locator("canvas[role=img]").evaluate((c) => c.toDataURL("image/png"));
    writeFileSync(join(dir, "themes", `${String(i).padStart(2, "0")}.png`), Buffer.from(data.split(",")[1], "base64"));
  }
  console.log(`  ${count} streak themes`);

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(base + "/");
  await settle(2500);
  await shot("home-light");
  await page.emulateMedia({ colorScheme: "dark" });

  // The logger from the Push routine: before any set, then one, two, three sets ticked.
  await page.goto(base + "/routines");
  await settle();
  await page.getByRole("button", { name: "Start Push Day" }).click();
  await page.waitForURL(/\/workout/);
  await settle(2500);
  for (const n of [1, 2, 3]) await box(`tick${n}`, page.getByRole("button", { name: `Mark Set ${n} done` }).first());
  await box("volume", page.locator("dt", { hasText: "Volume" }).first().locator(".."));
  await shot("logger-0");
  for (const n of [1, 2, 3]) {
    await page.getByRole("button", { name: `Mark Set ${n} done` }).first().click();
    await settle(900);
    if (n === 3) {
      await settle(600);
      await shot("logger-rest");
      await box("bar", page.getByRole("timer"));
    }
    await page.getByRole("button", { name: "Skip rest" }).click();
    await settle(700);
    await shot(`logger-${n}`);
  }
  await page.getByRole("button", { name: /^Workout running/ }).click();
  await settle(1500);
  await shot("logger-bar");
  await box("barOpen", page.getByRole("group", { name: "Workout shortcuts" }).locator(".."));

  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  await browser.close();
  return meta;
}
