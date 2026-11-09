#!/usr/bin/env node
// On an Android emulator with ABOT's debug APK: drives the app's WebView with Playwright and
// Android's own permission dialogs with uiautomator, then asks Android (dumpsys) what really
// happened. Run by the "android-smoke" job in .github/workflows/android.yml:
//
//   node scripts/android-smoke.mjs <path to app-debug.apk> <output folder>
//
// Prints PASS / FAIL per check, saves a screenshot per step, exits 1 if any check failed.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { _android as android } from "playwright-core";

const [apk, out = "smoke-out"] = process.argv.slice(2);
const PKG = "app.abot.gym";
mkdirSync(out, { recursive: true });

// Every adb call has a time limit: a wedged emulator must fail the run, not hang it until the job
// times out with nothing in the log.
const ADB_TIMEOUT_MS = 90_000;
const adb = (...args) => execFileSync("adb", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: ADB_TIMEOUT_MS });
const shell = (cmd) => adb("shell", cmd);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
let step = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

function screenshot(name) {
  step++;
  console.log(`STEP ${step} ${name}`);
  const png = execFileSync("adb", ["exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024, timeout: ADB_TIMEOUT_MS });
  writeFileSync(join(out, `${String(step).padStart(2, "0")}-${name}.png`), png);
}

const granted = (perm) => new RegExp(`${perm.replace(/\./g, "\\.")}: granted=true`).test(shell(`dumpsys package ${PKG}`));
const resumedActivity = () => (shell("dumpsys activity activities").match(/(topResumedActivity|mResumedActivity)[^\n]*/) ?? [""])[0];

/** Taps the first on-screen node whose text or resource id matches, via uiautomator. */
async function tapSystem(matchers, timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    shell("uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true");
    const xml = shell("cat /sdcard/ui.xml");
    for (const m of matchers) {
      const node = [...xml.matchAll(/<node [^>]*>/g)].map((x) => x[0]).find((n) => m.test(n));
      const b = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (b) {
        const [x1, y1, x2, y2] = b.slice(1).map(Number);
        shell(`input tap ${Math.round((x1 + x2) / 2)} ${Math.round((y1 + y2) / 2)}`);
        return true;
      }
    }
    await sleep(700);
  }
  return false;
}

const ALLOW = [/resource-id="com\.android\.permissioncontroller:id\/permission_allow_button"/, /text="Allow"/];
const WHILE_USING = [
  /resource-id="com\.android\.permissioncontroller:id\/permission_allow_foreground_only_button"/,
  /text="While using the app"/,
  ...ALLOW,
];

async function openApp() {
  shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`);
  await sleep(2500);
}

async function main() {
  adb("install", "-r", apk);
  for (const p of ["POST_NOTIFICATIONS", "CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]) {
    try {
      shell(`pm revoke ${PKG} android.permission.${p}`);
      shell(`pm clear-permission-flags ${PKG} android.permission.${p} user-set user-fixed`);
    } catch {
      // Not every permission exists on every API level.
    }
  }
  shell(`pm clear ${PKG}`);
  await openApp();

  const [device] = await android.devices({ omitDriverInstall: true });
  // Revoking a permission makes Android kill the app, so every relaunch attaches to a new WebView.
  // On a cold emulator the first attach sometimes never sees the WebView: relaunch once and try
  // again. A crash cannot hide behind this, as any FATAL EXCEPTION in ABOT fails the run below.
  const attach = async () => {
    for (let tries = 1; ; tries++) {
      console.log(`ATTACH WebView, try ${tries} (after step ${step})`);
      try {
        return (await device.webView({ pkg: PKG }, { timeout: 60000 })).page();
      } catch (e) {
        if (tries >= 2) throw e;
        console.log(`RETRY WebView not attached (${String(e?.message ?? e).split("\n")[0]}); relaunching ABOT once`);
        shell(`am force-stop ${PKG}`);
        await openApp();
      }
    }
  };
  let page = await attach();
  const fits = () => page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1);

  // 1. Intro: one screen, no scrolling.
  await page.getByRole("heading", { name: "Log a set in one tap" }).waitFor({ timeout: 30000 });
  screenshot("intro");
  check("intro fits the screen without scrolling", await fits());

  // 2. Permissions step: reached from the intro, fits the screen.
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.getByRole("heading", { name: "Allow access" }).waitFor({ timeout: 15000 });
  screenshot("permissions");
  check("permissions step fits the screen without scrolling", await fits());

  // Diagnostics: what the notification plugin answers when called straight from the page.
  const diag = await page.evaluate(async () => {
    const P = window.Capacitor?.Plugins ?? {};
    const out = { plugins: Object.keys(P), native: window.Capacitor?.isNativePlatform?.() };
    try {
      out.check = await P.LocalNotifications.checkPermissions();
    } catch (e) {
      out.checkError = String(e?.message ?? e);
    }
    return out;
  });
  console.log(`DIAG plugin answer: ${JSON.stringify(diag)}`);

  // 3. Notifications: Android's dialog appears, Allow grants it, the row says On.
  await page.getByRole("button", { name: "Allow notifications" }).click();
  check("notification dialog shown and allowed", await tapSystem(ALLOW));
  await sleep(1500);
  check("POST_NOTIFICATIONS granted", granted("android.permission.POST_NOTIFICATIONS"));
  screenshot("notifications-allowed");

  // 4. Camera and location, the same way.
  await page.getByRole("button", { name: "Allow camera" }).click();
  check("camera dialog shown and allowed", await tapSystem(WHILE_USING));
  await sleep(1500);
  check("CAMERA granted", granted("android.permission.CAMERA"));
  await page.getByRole("button", { name: "Allow location" }).click();
  check("location dialog shown and allowed", await tapSystem(WHILE_USING));
  await sleep(1500);
  check("location granted", granted("android.permission.ACCESS_COARSE_LOCATION") || granted("android.permission.ACCESS_FINE_LOCATION"));
  screenshot("all-allowed");
  const onCount = await page.getByText("On", { exact: true }).count();
  check("all three rows read On", onCount === 3, `${onCount} rows`);

  // 5. Turned down for good in Android: back in ABOT the row offers Settings, which opens
  //    ABOT's notification page.
  shell(`pm revoke ${PKG} android.permission.POST_NOTIFICATIONS`);
  shell(`pm set-permission-flags ${PKG} android.permission.POST_NOTIFICATIONS user-set user-fixed`);
  shell("input keyevent KEYCODE_HOME");
  await sleep(1200);
  await openApp();
  page = await attach();
  // The row offers Allow or Settings; either way the tap must land in Android's settings, since
  // Android will not show its dialog again.
  const row = page.getByRole("button", { name: /^(Allow notifications|Notifications is off\. Open Android settings)$/ });
  const shown = await row.waitFor({ timeout: 20000 }).then(() => true, () => false);
  check("the notifications row offers a way back after coming back", shown, page.url());
  screenshot("notifications-denied");
  await row.click().catch(() => {});
  await sleep(2500);
  const top = resumedActivity();
  check("Settings opens Android's settings app", /com\.android\.settings/.test(top), top.trim());
  screenshot("android-settings");

  // 6. Live workout notification while a workout runs.
  shell(`pm clear-permission-flags ${PKG} android.permission.POST_NOTIFICATIONS user-set user-fixed`);
  shell(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
  shell(`am force-stop ${PKG}`);
  await openApp();
  page = await attach();
  await page.getByRole("button", { name: "Not now" }).click().catch(() => {});
  await page.getByRole("button", { name: "Start an empty workout" }).first().click({ timeout: 15000 });
  await sleep(2500);
  shell("input keyevent KEYCODE_HOME");
  await sleep(2000);
  const notes = shell("dumpsys notification --noredact");
  check("ongoing workout notification posted", new RegExp(`pkg=${PKG}[^\\n]*\\n(?:[^\\n]*\\n){0,40}?[^\\n]*id=4242|id=4242[^\\n]*${PKG}`).test(notes) || /NotificationRecord\([^)]*pkg=app\.abot\.gym[^)]*id=4242/.test(notes));
  shell("cmd statusbar expand-notifications");
  await sleep(1500);
  screenshot("notification-shade");

  // 7. Health Connect, built into Android 14: availability, its permission screen, a workout
  //    written twice (the second time must update, not fail), weight and sleep reads.
  shell("cmd statusbar collapse");
  await openApp();
  page = await attach();
  const hc = (method, args) =>
    page.evaluate(
      async ([m, a]) => {
        try {
          return { ok: true, v: await window.Capacitor.Plugins.HealthConnect[m](a) };
        } catch (e) {
          return { ok: false, e: String(e?.message ?? e) };
        }
      },
      [method, args],
    );
  const avail = await hc("availability");
  check("Health Connect is available", avail.ok && avail.v.status === "available", JSON.stringify(avail));
  const asked = hc("requestHealthPermissions");
  await sleep(3000);
  screenshot("health-connect-permissions");
  await tapSystem([/text="Get started"/], 3000);
  const allowAll = await tapSystem([/text="Allow all"/]);
  await sleep(800);
  const allowed = await tapSystem([/text="Allow"/]);
  const answer = await asked;
  check("Health Connect permission screen shown and allowed", allowAll && allowed && answer.ok && answer.v.all === true, JSON.stringify(answer));
  check("health WRITE_EXERCISE granted", granted("android.permission.health.WRITE_EXERCISE"));
  check("health READ_SLEEP granted", granted("android.permission.health.READ_SLEEP"));
  const now = Date.now();
  const workout = { id: "smoke", startMs: now - 3_600_000, endMs: now - 60_000, title: "Smoke test", kcal: 321, version: 1 };
  const first = await hc("writeWorkout", workout);
  check("workout and calories written to Health Connect", first.ok && first.v.written === 2, JSON.stringify(first));
  const second = await hc("writeWorkout", { ...workout, kcal: 330, version: 2 });
  check("writing the same workout again updates it", second.ok, JSON.stringify(second));
  const weight = await hc("readLatestWeight");
  check("weight read answers", weight.ok, JSON.stringify(weight));
  const night = await hc("readLastSleep");
  check("sleep read answers", night.ok, JSON.stringify(night));

  await device.close();
}

// A run that has not finished in 20 minutes is stuck: say where, show ABOT's log, and stop.
const watchdog = setTimeout(() => {
  console.log(`FAIL  smoke run stuck after step ${step}; stopping`);
  try {
    const log = execFileSync("adb", ["logcat", "-d", "-v", "brief"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
    console.log(log.split("\n").filter((l) => /AndroidRuntime|FATAL|ANR|abot/i.test(l)).slice(-80).join("\n"));
  } catch (e) {
    console.log(`logcat unavailable: ${e}`);
  }
  process.exit(1);
}, 20 * 60_000);
watchdog.unref();

main()
  .catch((err) => {
    console.log(`FAIL  smoke script crashed: ${err?.stack ?? err}`);
    failures++;
  })
  .finally(() => {
    try {
      const log = execFileSync("adb", ["logcat", "-d", "-v", "brief"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: ADB_TIMEOUT_MS });
      writeFileSync(join(out, "logcat.txt"), log);
      // An ABOT crash anywhere in the run fails it, with its stack, even if every check passed.
      const all = log.split("\n");
      const crash = all.findIndex((l, i) => /FATAL EXCEPTION/.test(l) && all.slice(i, i + 3).some((x) => /app\.abot\.gym/.test(x)));
      if (crash >= 0) {
        failures++;
        console.log("FAIL  ABOT crashed:");
        console.log(all.slice(crash, crash + 40).join("\n"));
      }
      const lines = log.split("\n").filter((l) => /Capacitor|LocalNotification|AndroidRuntime|FATAL|Exception|abot/i.test(l));
      console.log("LOGCAT (filtered, last 80):");
      console.log(lines.slice(-80).join("\n"));
    } catch (e) {
      console.log(`logcat unavailable: ${e}`);
    }
    console.log(failures ? `${failures} check(s) failed` : "All checks passed");
    process.exit(failures ? 1 : 0);
  });
