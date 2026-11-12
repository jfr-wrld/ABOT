import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await freshStart(page);
});

test("foods have photos, portions and a calculator, and log to today without a phase", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.hostname !== "localhost" && !u.hostname.endsWith(".local")) outside.push(u.hostname);
  });
  await page.goto("/phase/fuel");
  await expect(page.getByText("Nothing logged today. Add a food, use a day plan, or copy yesterday.")).toBeVisible();
  await page.getByRole("button", { name: "Food", exact: true }).click();

  // Search finds an Indonesian staple; the tile shows the bundled photo.
  await page.getByLabel("Search foods").fill("rice");
  const rice = page.getByRole("button", { name: /^White rice/ });
  await expect(rice.locator("img")).toHaveAttribute("src", "/food/white-rice.webp");
  await rice.click();
  const sheet = page.getByRole("dialog", { name: "White rice" });
  // 1 rice scoop (100 g) of TKPI nasi: 180 kcal; the plate (200 g) doubles it.
  await expect(sheet.getByText(/^180\s*kcal$/)).toBeVisible();
  await sheet.getByRole("button", { name: /1 plate · 200 g/ }).click();
  await expect(sheet.getByText(/^360\s*kcal$/)).toBeVisible();

  // How much rice for 40 g carbs: 100 g, one scoop.
  await sheet.getByLabel(/^Amount of .+ wanted$/).fill("40");
  await expect(sheet.getByRole("status")).toContainText("100 g");
  await sheet.getByRole("button", { name: "Use this amount" }).click();
  await expectNoHorizontalOverflow(page);
  await sheet.getByRole("button", { name: "Add to today" }).click();

  // Today: logged; a quick add on top; the entry can be edited.
  await page.getByRole("tab", { name: "Today" }).click();
  await expect(page.getByRole("button", { name: /White rice\s+100 g/ })).toBeVisible();
  await page.getByRole("button", { name: "Quick add" }).click();
  const quick = page.getByRole("dialog", { name: "Quick add" });
  await quick.getByLabel("Name (optional)").fill("Nasi padang");
  await quick.getByLabel("Protein g").fill("30");
  await quick.getByLabel("Carbs g").fill("80");
  await quick.getByLabel("Fat g").fill("25");
  await quick.getByRole("button", { name: "Add 665 kcal" }).click();
  await expect(page.getByRole("button", { name: /Nasi padang/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Calories: 845 kcal" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Everything above ran on the phone: no request left the app (photos included).
  expect(outside).toEqual([]);
});

test("Indonesian plates come with what they are made of; a quick add can be saved and picked again", async ({ page }) => {
  await page.goto("/phase/fuel");
  await page.getByRole("tab", { name: "Foods" }).click();
  await page.getByLabel("Search foods").fill("geprek");
  await page.getByRole("button", { name: /Smashed fried chicken with rice/ }).click();
  const sheet = page.getByRole("dialog", { name: /ayam geprek/ });
  await expect(sheet.getByText("Worked out from one 1 plate of:")).toBeVisible();
  await expect(sheet.getByText(/Wheat flour, 20 g/)).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Today" }).click();
  await page.getByRole("button", { name: "Quick add" }).click();
  const quick = page.getByRole("dialog", { name: "Quick add" });
  await expect(quick.getByText("Give it a name to save it to my foods")).toBeVisible();
  await quick.getByLabel("Name (optional)").fill("Nasi padang dekat kantor");
  await quick.getByLabel("kcal").fill("750");
  await quick.getByLabel("kcal").blur();
  await quick.getByLabel(/Save to my foods/).check();
  await quick.getByRole("button", { name: "Add 750 kcal" }).click();

  await page.getByRole("tab", { name: "Foods" }).click();
  await page.getByRole("tab", { name: "My foods" }).click();
  await page.getByRole("button", { name: /Nasi padang dekat kantor/ }).click();
  const mine = page.getByRole("dialog", { name: "Nasi padang dekat kantor" });
  await expect(mine).toContainText("750");
  await mine.getByRole("button", { name: "Remove from my foods" }).click();
  await expect(page.getByRole("tab", { name: "My foods" })).toHaveCount(0);
});
