import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { addExercise, freshStart, logSet, startEmptyWorkout } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page);
});

test("Settings, Health apps: browser status, the guide, and the body weight the estimate uses", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /Health apps/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Android app only" })).toBeVisible();
  // No Health Connect in a browser: no connect button, the .tcx route is explained instead.
  await expect(page.getByRole("button", { name: "Connect Google / Huawei / Samsung Health" })).toHaveCount(0);
  await expect(page.getByText(/share any workout as a \.tcx file/)).toBeVisible();

  await page.getByRole("button", { name: "How to link Huawei or Samsung Health" }).click();
  const guide = page.getByRole("dialog", { name: "Link other health apps" });
  await expect(guide).toContainText("Me > Privacy management > Health Connect");
  await guide.getByRole("button", { name: "Close" }).click();

  const auto = page.getByRole("switch", { name: "Auto-sync completed workouts" });
  await expect(auto).toHaveAttribute("aria-checked", "false");
  await auto.click();
  await expect(auto).toHaveAttribute("aria-checked", "true");

  const weight = page.getByLabel("Body weight (kg)");
  await weight.fill("82.5");
  await weight.press("Enter");
  await expect(weight).toHaveValue("82.5");
  await page.reload();
  await expect(page.getByLabel("Body weight (kg)")).toHaveValue("82.5");
});

test("a finished workout shows its calories, on the summary and on Home, and exports a .tcx", async ({ page }, info) => {
  await page.goto("/settings?section=health");
  await page.getByLabel("Body weight (kg)").fill("80");
  await page.getByLabel("Body weight (kg)").press("Enter");
  await expect(page.getByLabel("Body weight (kg)")).toHaveValue("80");

  await startEmptyWorkout(page);
  const start = new Date(Date.now() - 40 * 60_000);
  test.skip(start.getDate() !== new Date().getDate(), "40 minutes ago is yesterday");
  await page.getByRole("button", { name: /^Duration/ }).click();
  await page.getByLabel("Started at").fill(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
  await page.getByRole("button", { name: "Save start time" }).click();
  await page.getByLabel("Workout name").fill("Push Day");
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "80", "8");
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.waitForURL(/\/workout\/summary\?id=/);

  const kcal = page.getByRole("region", { name: "Calories (estimate)" });
  // About 40 minutes at 80 kg with a light session (MET 3.5): 3.5 x 3.5 x 0.4 x 40, about 196.
  await expect(kcal).toContainText(/(19\d|20\d) kcal/);
  await expect(kcal).toContainText("MET 3.5 for 80 kg body weight");

  const [download] = await Promise.all([page.waitForEvent("download"), kcal.getByRole("button", { name: /Share as \.tcx/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^abot-\d{4}-\d{2}-\d{2}-push-day\.tcx$/);
  const file = info.outputPath("w.tcx");
  await download.saveAs(file);
  const xml = await readFile(file, "utf8");
  expect(xml).toContain("<TrainingCenterDatabase");
  expect(xml).toContain("Bench Press (Barbell): 80 kg x 8");
  // The browser can parse it: well-formed XML.
  const ok = await page.evaluate((x) => new DOMParser().parseFromString(x, "application/xml").getElementsByTagName("parsererror").length === 0, xml);
  expect(ok).toBe(true);
  await expect(kcal.getByRole("status")).toContainText("Saved the .tcx file");

  await page.getByRole("link", { name: "Back to Home" }).click();
  const card = page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first();
  await expect(card).toContainText(/(19\d|20\d) kcal/);
});
