import { registerPlugin } from "@capacitor/core";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import type { NativeLive } from "@/lib/notifications/live-workout";
import { DEFAULT_SCHEDULE, reminderContent, type ReminderContent, type Weekday, type WorkoutSchedule } from "@/lib/notifications/schedule";

/**
 * Notifications in the Android app, through @capacitor/local-notifications. The WebView has no
 * Notification API, and its JavaScript is frozen in the background, so anything timed (rest over,
 * the weekly session call) is handed to Android's alarm scheduler up front.
 */

const plugin = () => import("@capacitor/local-notifications").then((m) => m.LocalNotifications);

export type NativePermission = "granted" | "denied" | "default";

/** Fixed ids: one snooze, two per weekday (prep, session). The live notification and the rest
 * alarm belong to LiveWorkout. */
const ID = { snooze: 3 } as const;
const sessionId = (wd: Weekday) => 100 + wd;
const prepId = (wd: Weekday) => 110 + wd;
const REMINDER_IDS = [0, 1, 2, 3, 4, 5, 6].flatMap((wd) => [sessionId(wd as Weekday), prepId(wd as Weekday)]);

const CHANNEL = { live: "workout-live", rest: "rest-over", reminders: "reminders" } as const;
const REMINDER_ACTIONS = "abot-reminder";
const SNOOZE_MS = 30 * 60_000;
const ICON = "ic_stat_abot";

export async function nativePermission(): Promise<NativePermission> {
  const { display } = await (await plugin()).checkPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

export async function askNativePermission(): Promise<NativePermission> {
  const { display } = await (await plugin()).requestPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

/** Android 12+ may run alarms late unless the lifter allows exact alarms for ABOT. */
export async function exactAlarmsAllowed(): Promise<boolean> {
  try {
    return (await (await plugin()).checkExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return true;
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  await (await plugin()).changeExactNotificationSetting();
}

/**
 * Channels, the Start / Snooze buttons, and what a tap does. `open` navigates inside the app.
 * Returns a cleanup for the listener.
 */
export async function setupNativeNotifications(open: (url: string) => void): Promise<() => void> {
  const ln = await plugin();
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
    const extra = (notification.extra ?? {}) as { url?: string; reminder?: ReminderContent };
    if (actionId === "snooze" && extra.reminder) {
      void ln.schedule({ notifications: [reminderNotification(ID.snooze, extra.reminder, { at: new Date(Date.now() + SNOOZE_MS), allowWhileIdle: true })] });
      return;
    }
    open(extra.url ?? "/workout");
  });
  return () => void handle.remove();
}

/* ------------------------------------------------------------------ */
/* Live workout                                                        */
/* ------------------------------------------------------------------ */

export type LiveAction = "pause" | "resume" | "skip";

interface LiveWorkoutPlugin {
  show(opts: NativeLive): Promise<void>;
  clear(): Promise<void>;
  testAlert(): Promise<{ shown: boolean }>;
  takePendingAction(): Promise<{ id?: LiveAction }>;
  addListener(event: "action", fn: (e: { id: LiveAction }) => void): Promise<{ remove: () => Promise<void> }>;
}

/**
 * App-local plugin (android/app/src/main/java/app/abot/gym/LiveWorkoutPlugin.java): the ongoing
 * workout notification with a clock Android ticks itself, its Pause / Resume / Skip rest buttons,
 * and the ringing "rest over" alarm, all of which work while the app is frozen.
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
  const { id } = await LiveWorkout.takePendingAction();
  if (id) handle(id);
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
  await (await plugin()).schedule({ notifications: [reminderNotification(ID.snooze, c, undefined)] });
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
  const ln = await plugin();
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
