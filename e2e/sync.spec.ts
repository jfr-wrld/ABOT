import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

/** The build under test has Supabase settings when .env carries them (the audit moves it aside). */
function supabaseUrl(): string | null {
  try {
    const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
    return /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}
const SUPABASE = supabaseUrl();
const configured = SUPABASE !== null && process.env.E2E_REUSE_SERVER !== "1";

test("Settings explains Backup & Sync and keeps Export available", async ({ page }) => {
  await freshStart(page);
  await page.goto("/settings");
  const section = page.getByRole("region", { name: "Backup & Sync" });
  await expect(section).toBeVisible();
  if (configured) {
    await expect(section.getByRole("button", { name: "Sign in with Google to Backup & Sync" })).toBeVisible();
  } else {
    await expect(section.getByText("Cloud sync is not set up for this build.")).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Export backup/ })).toBeVisible();
});

test.describe("signed in (Supabase answered by the test)", () => {
  test.skip(!configured, "needs a build with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");

  async function signInAs(page: Page) {
    const ref = new URL(SUPABASE!).hostname.split(".")[0];
    await page.evaluate((key) => {
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "test-access-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: "test-refresh-token",
          user: {
            id: "00000000-0000-0000-0000-0000000000aa",
            aud: "authenticated",
            role: "authenticated",
            email: "lifter@example.com",
            app_metadata: { provider: "google" },
            user_metadata: { full_name: "Test Lifter" },
            created_at: new Date().toISOString(),
          },
        }),
      );
    }, `sb-${ref}-auth-token`);
  }

  test("a signed-in device uploads guest data, pulls the cloud's, and keeps both after signing out", async ({ page }) => {
    const pushed: { kind: string; id: string }[] = [];
    const remoteRoutine = {
      kind: "routine",
      id: "cloud-routine",
      payload: { id: "cloud-routine", name: "Cloud Pull Day", exercises: [], createdAt: 1, updatedAt: 1 },
      updated_at: 1,
      deleted: false,
      server_updated_at: "2026-11-08T10:00:00.000001+00:00",
    };
    let pulls = 0;
    await page.route("**/rest/v1/abot_records**", async (route: Route) => {
      pulls++;
      // First pull returns the cloud's routine; later pulls (after the cursor) are empty.
      const hasCursor = route.request().url().includes("server_updated_at=gt.");
      await route.fulfill({ json: hasCursor ? [] : [remoteRoutine] });
    });
    await page.route("**/rest/v1/rpc/upsert_if_newer", async (route: Route) => {
      const rows = (route.request().postDataJSON() as { rows: { kind: string; id: string }[] }).rows;
      pushed.push(...rows.map(({ kind, id }) => ({ kind, id })));
      await route.fulfill({ json: [{ accepted: rows.map((r) => `${r.kind}:${r.id}`), rejected: [] }] });
    });
    await page.route("**/auth/v1/**", (route) => route.fulfill({ status: 204, body: "" }));

    await freshStart(page);
    await startEmptyWorkout(page);
    await addExercise(page, "Bench Press (Barbell)");
    await logSet(page, 1, "80", "5");
    await page.getByRole("button", { name: "Skip rest" }).click();
    await finishWorkout(page);

    await signInAs(page);
    await page.goto("/settings");
    const section = page.getByRole("region", { name: "Backup & Sync" });
    await expect(section.getByText("Signed in as lifter@example.com")).toBeVisible();
    await expect(section.getByRole("status")).toHaveText(/Backed up just now/);
    expect(pulls).toBeGreaterThan(0);
    expect(pushed.map((r) => r.kind)).toContain("session");

    // The cloud's routine is now on this device, and the Google name filled the empty profile.
    await page.goto("/routines");
    await expect(page.getByRole("heading", { name: "Cloud Pull Day" })).toBeVisible();
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 2, name: "Test Lifter" })).toBeVisible();
    await expect(page.getByText("lifter@example.com")).toBeVisible();

    // Sync now with nothing new pushes nothing more.
    const before = pushed.length;
    await page.goto("/settings");
    await section.getByRole("button", { name: "Sync now" }).click();
    await expect(section.getByRole("status")).toHaveText(/Backed up just now/);
    expect(pushed.length).toBe(before);

    await section.getByRole("button", { name: "Sign out" }).click();
    await expect(section.getByRole("button", { name: "Sign in with Google to Backup & Sync" })).toBeVisible();
    await page.goto("/routines");
    await expect(page.getByRole("heading", { name: "Cloud Pull Day" })).toBeVisible();
  });
  async function mockSupabase(page: Page, opts: { failSync?: boolean } = {}) {
    await page.route("**/rest/v1/**", (route: Route) =>
      opts.failSync
        ? route.fulfill({ status: 404, json: { code: "42P01", message: 'relation "public.abot_records" does not exist' } })
        : route.request().url().includes("upsert_if_newer")
          ? route.fulfill({
              json: [
                {
                  accepted: (route.request().postDataJSON() as { rows: { kind: string; id: string }[] }).rows.map(
                    (r) => `${r.kind}:${r.id}`,
                  ),
                  rejected: [],
                },
              ],
            })
          : route.fulfill({ json: [] }),
    );
    await page.route("**/auth/v1/**", (route) => route.fulfill({ status: 204, body: "" }));
  }

  test("Profile says the backup failed instead of claiming it is safe", async ({ page }) => {
    await mockSupabase(page, { failSync: true });
    await freshStart(page);
    await signInAs(page);
    await page.goto("/profile");
    const account = page.getByRole("region", { name: "Account" });
    await expect(account.getByRole("status")).toHaveText("Last backup failed");
    await expect(account.getByText("Your backup space isn't set up yet")).toBeVisible();
    await expect(account.getByText(/Backed up/)).toHaveCount(0);
    await account.getByText("Details").click();
    await expect(account.getByText(/abot_records/)).toBeVisible();

    // Once the backup works again, the same button clears it.
    await page.unrouteAll();
    await mockSupabase(page);
    await account.getByRole("button", { name: "Try again" }).click();
    await expect(account.getByRole("status")).toHaveText("Backed up just now");
  });

  test("login from Profile puts sign-in first and leads back to Profile", async ({ page }) => {
    await freshStart(page);
    await page.goto("/profile");
    await page.getByRole("link", { name: "Back up with an account" }).click();
    await page.waitForURL("**/login?from=/profile");
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toHaveClass(/bg-accent/);
    await page.getByRole("link", { name: "Profile" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  });

  test("a cancelled Google sign-in returns to where it started and says so", async ({ page }) => {
    await mockSupabase(page);
    await freshStart(page);
    await page.evaluate(() => sessionStorage.setItem("abot.signInReturn", "/profile"));
    await page.goto("/settings?error=access_denied&error_description=The+user+denied+access");
    await page.waitForURL("**/profile");
    await expect(page.getByRole("alert").filter({ hasText: "Google sign-in was cancelled" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
  });

  test("a finished Google sign-in returns to where it started and confirms it", async ({ page }) => {
    await mockSupabase(page);
    const ref = new URL(SUPABASE!).hostname.split(".")[0];
    await page.route("**/auth/v1/token**", (route) => {
      const now = Math.floor(Date.now() / 1000);
      return route.fulfill({
        json: {
          access_token: "test-access-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: "test-refresh-token",
          user: {
            id: "00000000-0000-0000-0000-0000000000aa",
            aud: "authenticated",
            role: "authenticated",
            email: "lifter@example.com",
            app_metadata: { provider: "google" },
            user_metadata: { full_name: "Test Lifter" },
            created_at: new Date().toISOString(),
          },
        },
      });
    });
    await freshStart(page);
    await page.evaluate((key) => {
      sessionStorage.setItem("abot.signInReturn", "/profile");
      localStorage.setItem(key, JSON.stringify("test-verifier"));
    }, `sb-${ref}-auth-token-code-verifier`);
    await page.goto("/settings?code=test-code");
    await page.waitForURL("**/profile");
    await expect(page.getByRole("status").filter({ hasText: "Signed in as lifter@example.com" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Account" }).getByText("lifter@example.com")).toBeVisible();
  });
});
