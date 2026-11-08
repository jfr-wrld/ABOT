import type { Repository } from "@/data/repo/types";
import { DEFAULT_SCHEDULE, dueReminders, reminderContent, type DueReminder, type ReminderContent, type WorkoutSchedule } from "./schedule";

/**
 * Shows workout reminders through the service worker (so they carry Start and Snooze buttons)
 * while ABOT is open, even in a background tab. A website cannot wake itself at a set time once
 * it is closed; the calendar export (buildIcs) covers that case.
 */

export type PermissionState = NotificationPermission | "unsupported";

export function notificationPermission(): PermissionState {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export async function askPermission(): Promise<PermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Registers /sw.js once; it only handles notification taps (see public/sw.js). */
export async function registerReminderWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Shows one notification; without a service worker it falls back to a plain one (no buttons). */
export async function showReminder(c: ReminderContent): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const reg = await registerReminderWorker();
  const options = { body: c.body, tag: c.tag, data: c.data, icon: "/icon.svg", badge: "/icon.svg", requireInteraction: false };
  if (reg) {
    // `actions` is supported by service-worker notifications; older type libs omit it.
    await reg.showNotification(c.title, { ...options, actions: c.actions } as NotificationOptions);
    return true;
  }
  try {
    const n = new Notification(c.title, options);
    n.onclick = () => window.location.assign(c.data.url);
    return true;
  } catch {
    return false;
  }
}

export interface RoutineInfo {
  id: string;
  name: string;
  muscles: string[];
}

const CHECK_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Every 30 seconds: show reminders that came due since the last check (never older than ten
 * minutes), and a snoozed reminder whose 30 minutes are up. Runs only in the writing tab, so two
 * open tabs never show the same reminder twice.
 */
export function startReminderLoop(repo: Repository, routine: (id: string | null) => RoutineInfo | null): () => void {
  stopReminderLoop();
  const tick = async () => {
    const now = Date.now();
    const schedule = (await repo.kv.get("reminders")) ?? DEFAULT_SCHEDULE;
    const state = (await repo.kv.get("reminderState")) ?? { lastCheck: now - CHECK_MS, fired: [] };
    const fired = new Set(state.fired);
    const due: DueReminder[] = dueReminders(schedule, state.lastCheck, now).filter((r) => !fired.has(r.key));

    const snooze = await repo.kv.get("reminderSnooze");
    if (snooze && snooze.until <= now) {
      await repo.kv.set("reminderSnooze", null);
      if (now - snooze.until < 10 * 60_000) {
        due.push({ kind: "session", at: snooze.until, weekday: new Date(now).getDay() as DueReminder["weekday"], routineId: snooze.routineId, key: `snooze:${snooze.until}` });
      }
    }

    for (const r of due) {
      if (await showReminder(reminderContent(r, routine(r.routineId), schedule.time))) fired.add(r.key);
    }
    await repo.kv.set("reminderState", { lastCheck: now, fired: [...fired].slice(-50) });
  };
  void tick();
  timer = setInterval(() => void tick(), CHECK_MS);
  return stopReminderLoop;
}

export function stopReminderLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function saveSchedule(repo: Repository, s: WorkoutSchedule): Promise<void> {
  await repo.kv.set("reminders", s);
  if (s.enabled) await registerReminderWorker();
}
