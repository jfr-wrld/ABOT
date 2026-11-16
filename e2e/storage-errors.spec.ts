import { expect, test } from "@playwright/test";

// Storage trouble is shown in plain words on every page, and a workout started while saved data
// cannot be read asks first instead of logging into memory without a word.

test("a browser without storage says so on every page, in plain words", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("abot.onboarded", "1");
    Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
  });
  await page.goto("/");
  const alert = page.getByRole("alert").filter({ hasText: "This browser does not let ABOT save data" });
  await expect(alert).toBeVisible();
  // The browser's own wording is folded away under Details.
  await expect(alert.getByText("IndexedDB is not available in this browser.")).toBeHidden();
  await alert.getByText("Details").click();
  await expect(alert.getByText("IndexedDB is not available in this browser.")).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("alert").filter({ hasText: "This browser does not let ABOT save data" })).toBeVisible();
});

test("when saved data cannot be read, starting a workout asks first", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("abot.onboarded", "1");
    // Every read from the database fails, as with a corrupted store.
    const fail = () => {
      throw new DOMException("read failed in test", "UnknownError");
    };
    IDBObjectStore.prototype.getAll = fail;
    IDBObjectStore.prototype.openCursor = fail;
    IDBObjectStore.prototype.get = fail;
    IDBIndex.prototype.getAll = fail;
    IDBIndex.prototype.openCursor = fail;
  });
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "could not be read" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload ABOT" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Start an empty workout" }).click();
  const ask = page.getByRole("dialog", { name: "This workout will not be saved" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Log anyway" }).click();
  await expect(ask).toBeHidden();
  await page.waitForURL("**/workout**");
});
