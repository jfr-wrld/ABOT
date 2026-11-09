import { expect, test, type Page, type Request } from "@playwright/test";
import { addExercise, finishWorkout, freshStart, logSet, startEmptyWorkout } from "./helpers";

/**
 * Records every request that leaves the app's own origin, except:
 * - exercise photo thumbnails (owner decision 2026-11-08): plain image GETs from the
 *   public-domain free-exercise-db, which carry no user data;
 * - the remote config read (owner decision 2026-11-09, Priority 12): one GET of the public
 *   `app_remote_config` row from the build's Supabase, which sends nothing about the user.
 * Anything else counts, including any other Supabase call made without signing in.
 */
function watchExternal(page: Page): string[] {
  const external: string[] = [];
  page.on("request", (r: Request) => {
    const u = new URL(r.url());
    if (u.protocol === "data:" || u.protocol === "blob:") return;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return;
    const photo =
      u.hostname === "raw.githubusercontent.com" &&
      u.pathname.startsWith("/yuhonas/free-exercise-db/main/exercises/") &&
      r.method() === "GET" &&
      r.resourceType() === "image";
    const remoteConfig = u.pathname === "/rest/v1/app_remote_config" && r.method() === "GET" && u.searchParams.get("id") === "eq.global";
    if (!photo && !remoteConfig) external.push(r.url());
  });
  return external;
}

test("a full training day makes no request outside the app, apart from exercise photos", async ({ page }) => {
  const external = watchExternal(page);
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Bench Press (Barbell)");
  await logSet(page, 1, "60", "8");
  await finishWorkout(page);
  for (const path of ["/", "/profile", "/exercises", "/exercises/detail?id=bench-press-barbell", "/workout", "/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
  }
  expect(external).toEqual([]);
});

test("logging keeps working with the network cut mid-workout", async ({ page, context }) => {
  // Finishing navigates to Home. A production build has prefetched that route; the dev server
  // compiles it on request, which needs the network. Run with E2E_REUSE_SERVER=1 against `next start`.
  test.skip(process.env.E2E_REUSE_SERVER !== "1", "needs a production server (next start)");
  await freshStart(page);
  await startEmptyWorkout(page);
  await addExercise(page, "Squat (Barbell)");
  await context.setOffline(true);
  await logSet(page, 1, "100", "5");
  await logSet(page, 2, "100", "5");
  await finishWorkout(page);
  // Home lists the finished workout while still offline, and again after a reload online.
  await expect(page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first()).toContainText(/2 sets/);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("region", { name: "Recent workouts" }).getByRole("link").first()).toContainText(/2 sets/);
});
