import { registerPlugin } from "@capacitor/core";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import type { NativeLive } from "@/lib/notifications/live-workout";
import { DEFAULT_SCHEDULE, reminderContent, type ReminderContent, type Weekday, type WorkoutSchedule } from "@/lib/notifications/schedule";

/**
 * Notifications in the Android app, through @capacitor/local-notifications. The WebView has no
 * Notification API, and its JavaScript is frozen in the background, so anything timed (rest over,
 * the weekly session call) is handed to Android's alarm scheduler up front.
 */

/**
 * The plugin, wrapped in an object. Never let a Promise resolve to a Capacitor plugin itself:
 * its Proxy answers every property, `then` included, so `await` treats it as a thenable, calls
 * a native "then" that does not exist, and hangs for ever. That silently stopped every
 * notification call (no permission dialog, no live status) until it was caught on an emulator.
 */
const plugin = () => import("@capacitor/local-notifications").then((m) => ({ ln: m.LocalNotifications }));

export type NativePermission = "granted" | "denied" | "default";

/** Fixed ids: one snooze, two per weekday (prep, session). The live notification and the rest
 * alarm belong to LiveWorkout. */
const ID = { snooze: 3 } as const;
const sessionId = (wd: Weekday) => 100 + wd;
const prepId = (wd: Weekday) => 110 + wd;
const REMINDER_IDS = [0, 1, 2, 3, 4, 5, 6].flatMap((wd) => [sessionId(wd as Weekday), prepId(wd as Weekday)]);

/** A reminder only ever opens a workout: /workout?start=<routine id or "empty">. */
const REMINDER_URL = /^\/workout\?start=([A-Za-z0-9_.~-]{1,80})$/;

export type ReminderAction = { kind: "ignore" } | { kind: "open"; url: string } | { kind: "snooze"; routineId: string | null };

/**
 * What a reminder tap may do. Android hands ABOT any intent another app sends to its launcher
 * with the plugin's extras as if it were a tap (security audit 2026-11-13), so nothing in the
 * payload is trusted: only ABOT's own reminder ids count, the url must be a workout start link,
 * and a snooze carries just the routine id, the text being rebuilt from this phone's data.
 */
export function reminderAction(notificationId: unknown, actionId: unknown, extra: unknown): ReminderAction {
  if (typeof notificationId !== "number" || !(REMINDER_IDS.includes(notificationId) || notificationId === ID.snooze)) return { kind: "ignore" };
  const url = typeof extra === "object" && extra !== null ? (extra as { url?: unknown }).url : undefined;
  const m = typeof url === "string" ? REMINDER_URL.exec(url) : null;
  if (actionId === "snooze") {
    const id = m ? decodeURIComponent(m[1]!) : "empty";
    return { kind: "snooze", routineId: id === "empty" ? null : id };
  }
  return { kind: "open", url: m ? url as string : "/workout" };
}

const CHANNEL = { live: "workout-live", rest: "rest-over", reminders: "reminders" } as const;
const REMINDER_ACTIONS = "abot-reminder";
const SNOOZE_MS = 30 * 60_000;
const ICON = "ic_stat_abot";

export async function nativePermission(): Promise<NativePermission> {
  const { display } = await (await plugin()).ln.checkPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

export async function askNativePermission(): Promise<NativePermission> {
  const { display } = await (await plugin()).ln.requestPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

/** Android 12+ may run alarms late unless the lifter allows exact alarms for ABOT. */
export async function exactAlarmsAllowed(): Promise<boolean> {
  try {
    return (await (await plugin()).ln.checkExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return true;
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  await (await plugin()).ln.changeExactNotificationSetting();
}

/**
 * Channels, the Start / Snooze buttons, and what a tap does. `open` navigates inside the app;
 * `routine` and `time` rebuild a snoozed reminder from the saved routines and schedule.
 * Returns a cleanup for the listener.
 */
export async function setupNativeNotifications(
  open: (url: string) => void,
  routine: (id: string | null) => { id: string; name: string; muscles: string[] } | null,
  time: () => string,
): Promise<() => void> {
  const { ln } = await plugin();
  await Promise.all([
    ln.createChannel({ id: CHANNEL.live, name: "Workout in progress", description: "The workout and your next set while ABOT is in the background.", importance: 2, vibration: false }),
    ln.createChannel({ id: CHANNEL.rest, name: "Rest over", description: "Rings when a rest timer ends.", importance: 5, vibration: true }),
    ln.createChannel({ id: CHANNEL.reminders, name: "Workout reminders", description: "Your scheduled session and the pack-your-bag call.", importance: 4, vibration: true }),
  ]);
  await ln.registerActionTypes({
    types: [
      {
        id: REMINDER_ACTIONS,
        actions: [
          { id: "start", title: "Start workout" },
          { id: "snooze", title: "Snooze 30 min" },
        ],
      },
    ],
  });
  const handle = await ln.addListener("localNotificationActionPerformed", ({ actionId, notification }) => {
    const act = reminderAction(notification.id, actionId, notification.extra);
    if (act.kind === "ignore") return;
    if (act.kind === "snooze") {
      const now = new Date();
      const content = reminderContent(
        { kind: "session", at: now.getTime(), weekday: now.getDay() as Weekday, routineId: act.routineId, key: "snooze" },
        routine(act.routineId),
        time(),
      );
      void ln.schedule({ notifications: [reminderNotification(ID.snooze, content, { at: new Date(now.getTime() + SNOOZE_MS), allowWhileIdle: true })] });
      return;
    }
    open(act.url);
  });
  return () => void handle.remove();
}

/* ------------------------------------------------------------------ */
/* Live workout                                                        */
/* ------------------------------------------------------------------ */

export type LiveAction = "pause" | "resume" | "skip" | "add30" | "log" | "open";

interface LiveWorkoutPlugin {
  show(opts: NativeLive): Promise<void>;
  clear(): Promise<void>;
  testAlert(): Promise<{ shown: boolean }>;
  takePendingActions(): Promise<{ ids?: LiveAction[] }>;
  addListener(event: "action", fn: (e: { id: LiveAction }) => void): Promise<{ remove: () => Promise<void> }>;
}

/**
 * App-local plugin (android/app/src/main/java/app/abot/gym/LiveWorkoutPlugin.java): the ongoing
 * workout notification with a clock Android ticks itself, its buttons (+30s, Skip rest, Log set,
 * Pause, Resume), and the ringing "rest over" alarm, all of which work while the app is frozen.
 * WorkoutLiveService holds the notification as a foreground service.
 */
const LiveWorkout = registerPlugin<LiveWorkoutPlugin>("LiveWorkout");

export function showNativeLive(live: NativeLive): Promise<void> {
  return LiveWorkout.show(live);
}

export function clearNativeLive(): Promise<void> {
  return LiveWorkout.clear();
}

/** Rings the rest-over alert now; false when notifications are not allowed. */
export async function testRestAlert(): Promise<boolean> {
  return (await LiveWorkout.testAlert()).shown;
}

/**
 * Notification buttons reach `handle`, including one tapped while ABOT was not running.
 * Returns a cleanup.
 */
export async function onLiveAction(handle: (id: LiveAction) => void): Promise<() => void> {
  const h = await LiveWorkout.addListener("action", ({ id }) => handle(id));
  const { ids = [] } = await LiveWorkout.takePendingActions();
  for (const id of ids) handle(id);
  return () => void h.remove();
}

/* ------------------------------------------------------------------ */
/* Weekly reminders                                                    */
/* ------------------------------------------------------------------ */

function reminderNotification(id: number, c: ReminderContent, schedule: LocalNotificationSchema["schedule"]): LocalNotificationSchema {
  return {
    id,
    title: c.title,
    body: c.body,
    channelId: CHANNEL.reminders,
    smallIcon: ICON,
    actionTypeId: REMINDER_ACTIONS,
    schedule,
    extra: { url: c.data.url, reminder: c },
  };
}

export async function showNativeReminderNow(c: ReminderContent): Promise<boolean> {
  if ((await nativePermission()) !== "granted") return false;
  await (await plugin()).ln.schedule({ notifications: [reminderNotification(ID.snooze, c, undefined)] });
  return true;
}

const WEEK_MIN = 7 * 24 * 60;

/** Weekday and clock time `minutes` before a session, wrapping into the previous day or week. */
export function shiftWeekly(wd: Weekday, hour: number, minute: number, minutes: number) {
  const t = (((wd * 24 * 60 + hour * 60 + minute - minutes) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
  return { weekday: Math.floor(t / (24 * 60)) as Weekday, hour: Math.floor((t % (24 * 60)) / 60), minute: t % 60 };
}

/**
 * Replaces the scheduled reminders with the saved schedule: one weekly notification per training
 * day, plus the pack-your-bag call when a lead time is set. Android repeats them by itself.
 */
export async function syncNativeReminders(
  schedule: WorkoutSchedule = DEFAULT_SCHEDULE,
  routine: (id: string | null) => { id: string; name: string; muscles: string[] } | null,
): Promise<void> {
  const { ln } = await plugin();
  await ln.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) });
  if (!schedule.enabled || (await nativePermission()) !== "granted") return;
  const [h, m] = schedule.time.split(":").map(Number);
  const notifications: LocalNotificationSchema[] = [];
  for (const wd of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    const day = schedule.days[wd];
    if (!day.on) continue;
    const info = routine(day.routineId);
    const base = { at: 0, weekday: wd, routineId: day.routineId };
    // The plugin counts weekdays from 1 = Sunday; Date#getDay from 0.
    notifications.push(
      reminderNotification(sessionId(wd), reminderContent({ ...base, kind: "session", key: `session:${wd}` }, info, schedule.time), {
        on: { weekday: wd + 1, hour: h, minute: m },
        allowWhileIdle: true,
      }),
    );
    if (schedule.leadMinutes > 0) {
      const p = shiftWeekly(wd, h, m, schedule.leadMinutes);
      notifications.push(
        reminderNotification(prepId(wd), reminderContent({ ...base, kind: "prep", key: `prep:${wd}` }, info, schedule.time), {
          on: { weekday: p.weekday + 1, hour: p.hour, minute: p.minute },
          allowWhileIdle: true,
        }),
      );
    }
  }
  if (notifications.length) await ln.schedule({ notifications });
}
