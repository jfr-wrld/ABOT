import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

test("the privacy policy and terms are readable, in both languages, and link to each other", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "aljasidik@gmail.com" }).first()).toHaveAttribute("href", "mailto:aljasidik@gmail.com");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Indonesia" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kebijakan Privasi" })).toBeVisible();
  await page.getByRole("link", { name: "Ketentuan Penggunaan" }).click();
  await page.waitForURL("**/terms");
  await expect(page.getByRole("heading", { level: 1, name: /Terms of Use|Ketentuan Penggunaan/ })).toBeVisible();
});

test("Settings and the sign-in page link to both documents", async ({ page }) => {
  await freshStart(page);
  await page.goto("/settings?section=about");
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await page.waitForURL("**/privacy");
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
});
