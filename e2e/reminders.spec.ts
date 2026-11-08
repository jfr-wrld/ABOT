import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { choose, freshStart } from "./helpers";

// The default headless shell denies notifications whatever the test grants; full Chromium in
// its new headless mode behaves like the real browser.
test.use({ channel: "chromium" });

async function shownNotifications(page: Page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const list = await reg.getNotifications();
    return list.map((n) => ({ title: n.title, body: n.body, actions: ((n as unknown as { actions?: { action: string }[] }).actions ?? []).map((a) => a.action) }));
  });
}

async function turnOn(page: Page) {
  await page.goto("/settings");
  const panel = page.getByRole("region", { name: "Workout schedule" });
  await panel.getByRole("switch", { name: "Workout reminders" }).click();
  return panel;
}

test("the weekly schedule is saved on the device", async ({ page }) => {
  await freshStart(page);
  const panel = await turnOn(page);
  await panel.getByRole("button", { name: "Monday" }).click();
  await panel.getByRole("button", { name: "Wednesday" }).click();
  await expect(panel.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
  await choose(page, panel.getByRole("combobox", { name: "Hour" }), "18");
  await choose(page, panel.getByRole("combobox", { name: "Minute" }), "00");
  await panel.getByRole("radio", { name: "15m" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "NEXT //" })).toContainText("18:00 · Free session");

  await page.reload();
  const again = page.getByRole("region", { name: "Workout schedule" });
  await expect(again.getByRole("button", { name: "Wednesday" })).toHaveAttribute("aria-pressed", "true");
  await expect(again.getByRole("combobox", { name: "Hour" })).toHaveText("18");
  await expect(again.getByRole("combobox", { name: "Minute" })).toHaveText("00");
  await expect(again.getByRole("radio", { name: "15m" })).toHaveAttribute("aria-checked", "true");
});

test("with permission, a test reminder shows the session call with Start and Snooze", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await freshStart(page);
  const panel = await turnOn(page);
  await panel.getByRole("button", { name: "Friday" }).click();
  await expect(panel.getByText("Notifications on")).toBeVisible();
  await panel.getByRole("button", { name: "Send a test" }).click();
  await expect(panel.getByText("Test reminder sent.")).toBeVisible();
  const shown = await shownNotifications(page);
  expect(shown[0]).toEqual({
    title: "ABOT // SESSION_CALL [Free session]",
    body: "Scheduled: Free session • Primary: your choice. Tap to initiate workout.",
    actions: ["ACTION_START", "ACTION_SNOOZE"],
  });
});

test("without permission the panel asks with one clear button", async ({ page }) => {
  await freshStart(page);
  const panel = await turnOn(page);
  await expect(panel.getByRole("button", { name: "Allow notifications" })).toBeVisible();
});

test("the reminder fires at the scheduled minute", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  // Monday 9 Nov 2026, 17:29:00 local.
  await page.clock.install({ time: new Date(2026, 10, 9, 17, 29, 0) });
  await freshStart(page);
  const panel = await turnOn(page);
  await panel.getByRole("button", { name: "Monday" }).click();
  await choose(page, panel.getByRole("combobox", { name: "Hour" }), "17");
  await choose(page, panel.getByRole("combobox", { name: "Minute" }), "30");
  await panel.getByRole("radio", { name: "Off" }).click();
  await page.waitForTimeout(500); // let the schedule reach IndexedDB
  await page.clock.fastForward("01:30");
  await expect.poll(async () => (await shownNotifications(page)).map((n) => n.title)).toContain("ABOT // SESSION_CALL [Free session]");
});

test("the schedule exports as a weekly calendar with the pack-your-bag alarm", async ({ page }) => {
  await freshStart(page);
  const panel = await turnOn(page);
  await panel.getByRole("button", { name: "Tuesday" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Add to calendar (.ics)" }).click()]);
  expect(download.suggestedFilename()).toBe("abot-workout-schedule.ics");
  const text = fs.readFileSync((await download.path())!, "utf8");
  expect(text).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU");
  expect(text).toContain("TRIGGER:-PT30M");
});

test("the Start link from a reminder starts the workout", async ({ page }) => {
  await freshStart(page);
  await page.goto("/workout?start=empty");
  await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === "/workout" && !u.search);
});

test("a snooze stored by the notification's Snooze button fires when its time comes", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await freshStart(page);
  await turnOn(page);
  // Exactly what public/sw.js writes on ACTION_SNOOZE, already due.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("abot");
        open.onsuccess = () => {
          const tx = open.result.transaction("kv", "readwrite");
          tx.objectStore("kv").put({ key: "reminderSnooze", value: { until: Date.now() - 1000, routineId: null } });
          tx.oncomplete = () => resolve();
        };
      }),
  );
  await page.reload();
  await expect.poll(async () => (await shownNotifications(page)).map((n) => n.title)).toContain("ABOT // SESSION_CALL [Free session]");
});
