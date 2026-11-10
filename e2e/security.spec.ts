import { expect, test } from "@playwright/test";
import { freshStart } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page);
});

test("the main pages load under the Content-Security-Policy without violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content.Security.Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  for (const path of ["/", "/workout", "/exercises", "/progress", "/profile", "/settings"]) {
    const res = await page.goto(path);
    expect(res?.headers()["content-security-policy"]).toContain("object-src 'none'");
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

test("a sign-in link cannot send the lifter to another site", async ({ page }) => {
  await page.goto("/login?from=" + encodeURIComponent("/\\evil.example"));
  await expect(page.locator("main")).toBeVisible();
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.some((h) => h.includes("evil.example"))).toBe(false);
});
