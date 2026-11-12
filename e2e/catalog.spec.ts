import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { addExercise, expectNoHorizontalOverflow, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

const CATALOG_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/*/dist/exercises.json";

async function serveCatalog(page: Page) {
  const body = await readFile(path.join(__dirname, "fixtures/catalog-sample.json"), "utf8");
  await page.route(CATALOG_URL, (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("loads the catalog on demand, logs a catalog exercise, keeps it after removing the catalog", async ({ page }) => {
  await serveCatalog(page);
  await page.goto("/exercises");
  await expect(page.getByText("540 exercises")).toBeVisible();
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await page.getByRole("button", { name: "Load full exercise catalog" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added 4 exercises from the catalog" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  // One of the four is already in the extended library, so it is not listed twice.
  await expect(page.getByText("540 exercises, 3 downloaded")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("Search exercises").fill("medicine ball chest");
  await expect(page.getByRole("link", { name: /^Medicine Ball Chest Pass/ })).toContainText("Downloaded");

  // Catalog survives a reload (stored in IndexedDB).
  await page.reload();
  await expect(page.getByText("540 exercises, 3 downloaded")).toBeVisible();

  await startEmptyWorkout(page);
  await addExercise(page, "Medicine Ball Chest Pass");
  await logSet(page, 1, "60", "5");
  await finishWorkout(page);

  await page.goto("/exercises");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await page.getByRole("button", { name: "Remove catalog" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("540 exercises, 1 downloaded")).toBeVisible();
  // The exercise that was logged is kept, so history still has its name.
  await page.getByLabel("Search exercises").fill("medicine ball chest");
  await expect(page.getByRole("link", { name: /^Medicine Ball Chest Pass/ })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: /300 kg/ }).click();
  await expect(page.getByRole("link", { name: "Medicine Ball Chest Pass" })).toBeVisible();
});

test("a failed download explains what to do and changes nothing", async ({ page }) => {
  await page.route(CATALOG_URL, (route) => route.abort("internetdisconnected"));
  await page.goto("/exercises");
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await page.getByRole("button", { name: "Load full exercise catalog" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not download the catalog. Check your connection and try again." }),
  ).toBeVisible();
  await expect(page.getByText("540 exercises", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load full exercise catalog" })).toBeEnabled();
});
