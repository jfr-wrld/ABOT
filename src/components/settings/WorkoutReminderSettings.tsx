"use client";

import { useState } from "react";
import { BellRing, CalendarPlus } from "lucide-react";
import { useReminderStore, routineInfo } from "@/store/useReminderStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useNow } from "@/lib/useNow";
import { buildIcs, nextSession, reminderContent, type Weekday } from "@/lib/notifications/schedule";
import { showReminder } from "@/lib/notifications/reminder-service";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { isNativeApp, saveFile } from "@/lib/native/files";
import { useT } from "@/i18n";
import { openNotificationSettings } from "@/lib/native/permissions";
import { Switch } from "./controls";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** Monday first, as gyms plan the week. Names come from Intl in the app's language. */
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
// 2024-01-07 was a Sunday, so day 7 + wd falls on that weekday.
const dayName = (wd: Weekday, locale: string, weekday: "short" | "long") =>
  new Date(2024, 0, 7 + wd).toLocaleDateString(locale, { weekday });
function weekNames(locale: string): { wd: Weekday; short: string; long: string }[] {
  return WEEKDAYS.map((wd) => ({ wd, short: dayName(wd, locale, "short"), long: dayName(wd, locale, "long") }));
}

/**
 * Settings > Workout schedule: which days you train, which routine on each, at what time, and
 * how early to be told. Saved in IndexedDB on this device.
 */
export function WorkoutReminderSettings() {
  const { schedule, permission, update, setDay, requestPermission } = useReminderStore();
  const t = useT();
  const week = weekNames(t.locale);
  const routines = useRoutineStore((s) => s.routines);
  const now = useNow(60_000);
  const [tested, setTested] = useState<string | null>(null);
  const [calendarNote, setCalendarNote] = useState<string | null>(null);
  const next = nextSession(schedule, now);
  const routineName = (id: string | null) => routines.find((r) => r.id === id)?.name ?? t("Free session");
  const anyDay = week.some((d) => schedule.days[d.wd].on);
  const [hour = "17", rawMinute = "30"] = schedule.time.split(":");
  // An older saved time off the 5-minute grid snaps to the nearest step for display.
  const minute = MINUTES.includes(rawMinute) ? rawMinute : String(Math.round(Number(rawMinute) / 5) * 5 % 60).padStart(2, "0");

  function exportCalendar() {
    const names = Object.fromEntries(routines.map((r) => [r.id, r.name]));
    const blob = new Blob([buildIcs(schedule, names, Date.now())], { type: "text/calendar" });
    saveFile(blob, "abot-workout-schedule.ics").then(
      (saved) => setCalendarNote(saved.kind === "saved" ? t("Saved to {folder}. Open it with your calendar app.", { folder: saved.folder }) : null),
      () => setCalendarNote(t("The calendar file could not be saved. Try again.")),
    );
  }

  async function sendTest() {
    const routineId = next?.routineId ?? null;
    const ok = await showReminder(
      reminderContent({ kind: "session", at: now, weekday: 1, routineId, key: `test:${now}` }, routineInfo(routineId), schedule.time),
    );
    setTested(
      ok
        ? t("Test reminder sent.")
        : isNativeApp()
          ? t("Android did not show it. Check the notification settings for ABOT.")
          : t("The browser did not show it. Check the notification settings for ABOT."),
    );
  }

  return (
    <section aria-labelledby="schedule-heading" className="panel p-3">
      <div className="flex items-center justify-between gap-3">
        <InfoTip
          title={
            <h2 id="schedule-heading" className="flex items-center gap-2 text-sm font-semibold">
              <BellRing aria-hidden="true" size={16} className="text-text-muted" />
              {t("Workout schedule")}
            </h2>
          }
          name={t("workout schedule")}
        >
          {t("Pick your training days and ABOT calls you to the session.")}
        </InfoTip>
        <Switch checked={schedule.enabled} onChange={(enabled) => update({ enabled })} aria-label={t("Workout reminders")} />
      </div>

      {!schedule.enabled ? null : (
        <div className="mt-3 flex flex-col gap-4">
          <div role="group" aria-label={t("Training days")} className="grid grid-cols-7 gap-1">
            {week.map((d) => {
              const on = schedule.days[d.wd].on;
              return (
                <button
                  key={d.wd}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.long}
                  onClick={() => setDay(d.wd, { on: !on })}
                  className={`num flex h-11 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    on ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>

          {anyDay && (
            <ul className="flex flex-col gap-2" aria-label={t("Routine for each day")}>
              {week.filter((d) => schedule.days[d.wd].on).map((d) => (
                <li key={d.wd} className="flex items-center gap-3">
                  <label htmlFor={`day-routine-${d.wd}`} className="label-caps w-10 shrink-0">
                    {d.short}
                  </label>
                  <Select
                    id={`day-routine-${d.wd}`}
                    value={schedule.days[d.wd].routineId ?? ""}
                    onChange={(v) => setDay(d.wd, { routineId: v || null })}
                    options={[{ value: "", label: t("Free session") }, ...routines.map((r) => ({ value: r.id, label: r.name }))]}
                    className="flex-1"
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-4">
            {/* Two 24-hour dropdowns, not <input type="time">: the native field follows the
                browser's locale (05:30 PM) and its own picker, off the mono 17:30 look. */}
            <div role="group" aria-labelledby="time-label">
              <span id="time-label" className="label-caps mb-1 block">
                {t("Session time")}
              </span>
              <div className="flex items-center gap-1">
                <Select
                  aria-label={t("Hour")}
                  value={hour}
                  onChange={(h) => update({ time: `${h}:${minute}` })}
                  options={HOURS.map((h) => ({ value: h, label: h }))}
                  className="num h-12 flex-1 justify-center !px-2 !text-xl font-bold"
                />
                <span aria-hidden="true" className="num text-xl font-bold text-text-muted">
                  :
                </span>
                <Select
                  aria-label={t("Minute")}
                  value={minute}
                  onChange={(m) => update({ time: `${hour}:${m}` })}
                  options={MINUTES.map((m) => ({ value: m, label: m }))}
                  className="num h-12 flex-1 justify-center !px-2 !text-xl font-bold"
                />
              </div>
            </div>
            <div>
              <span id="lead-label" className="label-caps mb-1 block">
                {t("Pack-your-bag call")}
              </span>
              <div role="radiogroup" aria-labelledby="lead-label" className="grid min-h-[3.25rem] grid-cols-3 gap-1 rounded-ctl border border-ink/[0.08] p-1">
                {([0, 15, 30] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={schedule.leadMinutes === m}
                    onClick={() => update({ leadMinutes: m })}
                    className={`num min-h-11 rounded-lg text-xs font-semibold transition-colors ${
                      schedule.leadMinutes === m ? "bg-ink/[0.1] text-text" : "text-text-muted hover:text-text"
                    }`}
                  >
                    {m === 0 ? t("Off") : t("{m}m", { m })}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="num text-xs text-text-muted" role="status">
            {next
              ? t("Next: {day} {time} · {routine}", {
                  day: new Date(next.at).toLocaleDateString(t.locale, { weekday: "short" }),
                  time: schedule.time,
                  routine: routineName(next.routineId),
                })
              : t("No training day picked yet.")}
          </p>

          <div className="border-t border-line pt-3">
            {permission === "granted" ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">{t("Notifications on")}</p>
                <Button variant="ghost" onClick={() => void sendTest()}>
                  {t("Send a test")}
                </Button>
              </div>
            ) : permission === "default" ? (
              <>
                <p className="text-sm text-text-muted">{t("Allow notifications so ABOT can call you to the session.")}</p>
                <Button variant="primary" onClick={() => void requestPermission()} className="mt-2 w-full">
                  {t("Allow notifications")}
                </Button>
              </>
            ) : permission === "denied" ? (
              <>
                <p className="text-sm text-text-muted">
                  {isNativeApp()
                    ? t("Notifications are off for ABOT. Turn them on in Android settings, under Apps, ABOT, Notifications.")
                    : t("Notifications are blocked for ABOT. Allow them in this site's browser settings, or use the calendar below.")}
                </p>
                {isNativeApp() && (
                  <Button onClick={() => void openNotificationSettings().catch((e: unknown) => setTested(e instanceof Error ? e.message : String(e)))} className="mt-2 w-full">
                    {t("Turn on in Android settings")}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-text-muted">{t("This browser cannot show notifications. Use the calendar below.")}</p>
            )}
            {tested && (
              <p role="status" className="mt-1 text-xs text-text-muted">
                {tested}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-text-muted">
              {isNativeApp()
                ? t("Reminders arrive even when ABOT is closed. You can also add the schedule to your calendar.")
                : t("Reminders appear while ABOT is open, even in a background tab. For alerts when it is closed, add the schedule to your phone's calendar.")}
            </p>
            <Button onClick={exportCalendar} disabled={!anyDay} className="mt-2 w-full">
              <CalendarPlus aria-hidden="true" size={16} /> {t("Add to calendar (.ics)")}
            </Button>
            {calendarNote && (
              <p role="status" className="mt-1 text-xs text-text-muted">
                {calendarNote}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
