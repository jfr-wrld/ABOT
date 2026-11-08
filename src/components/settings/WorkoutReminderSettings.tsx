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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** Monday first, as gyms plan the week. */
const WEEK: { wd: Weekday; short: string; long: string }[] = [
  { wd: 1, short: "Mon", long: "Monday" },
  { wd: 2, short: "Tue", long: "Tuesday" },
  { wd: 3, short: "Wed", long: "Wednesday" },
  { wd: 4, short: "Thu", long: "Thursday" },
  { wd: 5, short: "Fri", long: "Friday" },
  { wd: 6, short: "Sat", long: "Saturday" },
  { wd: 0, short: "Sun", long: "Sunday" },
];

/**
 * Settings > Workout schedule: which days you train, which routine on each, at what time, and
 * how early to be told. Saved in IndexedDB on this device.
 */
export function WorkoutReminderSettings() {
  const { schedule, permission, update, setDay, requestPermission } = useReminderStore();
  const routines = useRoutineStore((s) => s.routines);
  const now = useNow(60_000);
  const [tested, setTested] = useState<string | null>(null);
  const next = nextSession(schedule, now);
  const routineName = (id: string | null) => routines.find((r) => r.id === id)?.name ?? "Free session";
  const anyDay = WEEK.some((d) => schedule.days[d.wd].on);
  const [hour = "17", rawMinute = "30"] = schedule.time.split(":");
  // An older saved time off the 5-minute grid snaps to the nearest step for display.
  const minute = MINUTES.includes(rawMinute) ? rawMinute : String(Math.round(Number(rawMinute) / 5) * 5 % 60).padStart(2, "0");

  function exportCalendar() {
    const names = Object.fromEntries(routines.map((r) => [r.id, r.name]));
    const blob = new Blob([buildIcs(schedule, names, Date.now())], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "abot-workout-schedule.ics";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function sendTest() {
    const routineId = next?.routineId ?? null;
    const ok = await showReminder(
      reminderContent({ kind: "session", at: now, weekday: 1, routineId, key: `test:${now}` }, routineInfo(routineId), schedule.time),
    );
    setTested(ok ? "Test reminder sent." : "The browser did not show it. Check the notification settings for ABOT.");
  }

  return (
    <section aria-labelledby="schedule-heading" className="panel p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="schedule-heading" className="flex items-center gap-2 text-sm font-semibold">
          <BellRing aria-hidden="true" size={16} className="text-text-muted" />
          Workout schedule
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={schedule.enabled}
          aria-label="Workout reminders"
          onClick={() => update({ enabled: !schedule.enabled })}
          className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${
            schedule.enabled ? "border-accent bg-accent" : "border-line-strong bg-surface-2"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 size-6 rounded-full transition-[left] ${schedule.enabled ? "left-7 bg-black" : "left-0.5 bg-white"}`}
          />
        </button>
      </div>

      {!schedule.enabled ? (
        <p className="mt-2 text-sm text-text-muted">Pick your training days and ABOT calls you to the session.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          <div role="group" aria-label="Training days" className="grid grid-cols-7 gap-1">
            {WEEK.map((d) => {
              const on = schedule.days[d.wd].on;
              return (
                <button
                  key={d.wd}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.long}
                  onClick={() => setDay(d.wd, { on: !on })}
                  className={`num flex h-11 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    on ? "border-accent bg-accent text-on-accent" : "border-white/[0.12] text-text-muted hover:border-white/25 hover:text-text"
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>

          {anyDay && (
            <ul className="flex flex-col gap-2" aria-label="Routine for each day">
              {WEEK.filter((d) => schedule.days[d.wd].on).map((d) => (
                <li key={d.wd} className="flex items-center gap-3">
                  <label htmlFor={`day-routine-${d.wd}`} className="label-caps w-10 shrink-0">
                    {d.short}
                  </label>
                  <Select
                    id={`day-routine-${d.wd}`}
                    value={schedule.days[d.wd].routineId ?? ""}
                    onChange={(v) => setDay(d.wd, { routineId: v || null })}
                    options={[{ value: "", label: "Free session" }, ...routines.map((r) => ({ value: r.id, label: r.name }))]}
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
                Session time
              </span>
              <div className="flex items-center gap-1">
                <Select
                  aria-label="Hour"
                  value={hour}
                  onChange={(h) => update({ time: `${h}:${minute}` })}
                  options={HOURS.map((h) => ({ value: h, label: h }))}
                  className="num h-12 flex-1 justify-center !px-2 !text-xl font-bold"
                />
                <span aria-hidden="true" className="num text-xl font-bold text-text-muted">
                  :
                </span>
                <Select
                  aria-label="Minute"
                  value={minute}
                  onChange={(m) => update({ time: `${hour}:${m}` })}
                  options={MINUTES.map((m) => ({ value: m, label: m }))}
                  className="num h-12 flex-1 justify-center !px-2 !text-xl font-bold"
                />
              </div>
            </div>
            <div>
              <span id="lead-label" className="label-caps mb-1 block">
                Pack-your-bag call
              </span>
              <div role="radiogroup" aria-labelledby="lead-label" className="grid h-12 grid-cols-3 gap-1 rounded-ctl border border-white/[0.08] p-1">
                {([0, 15, 30] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={schedule.leadMinutes === m}
                    onClick={() => update({ leadMinutes: m })}
                    className={`num rounded-lg text-xs font-semibold transition-colors ${
                      schedule.leadMinutes === m ? "bg-white/[0.1] text-text" : "text-text-muted hover:text-text"
                    }`}
                  >
                    {m === 0 ? "Off" : `${m}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="num text-xs text-text-muted" role="status">
            {next
              ? `NEXT // ${new Date(next.at).toLocaleDateString(undefined, { weekday: "short" })} ${schedule.time} · ${routineName(next.routineId)}`
              : "No training day picked yet."}
          </p>

          <div className="border-t border-line pt-3">
            {permission === "granted" ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">Notifications on</p>
                <Button variant="ghost" onClick={() => void sendTest()}>
                  Send a test
                </Button>
              </div>
            ) : permission === "default" ? (
              <>
                <p className="text-sm text-text-muted">Allow notifications so ABOT can call you to the session.</p>
                <Button variant="primary" onClick={() => void requestPermission()} className="mt-2 w-full">
                  Allow notifications
                </Button>
              </>
            ) : permission === "denied" ? (
              <p className="text-sm text-text-muted">
                Notifications are blocked for ABOT. Allow them in this site&apos;s browser settings, or use the calendar below.
              </p>
            ) : (
              <p className="text-sm text-text-muted">This browser cannot show notifications. Use the calendar below.</p>
            )}
            {tested && (
              <p role="status" className="mt-1 text-xs text-text-muted">
                {tested}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-text-muted">
              Reminders appear while ABOT is open, even in a background tab. For alerts when it is closed, add the schedule to
              your phone&apos;s calendar.
            </p>
            <Button onClick={exportCalendar} disabled={!anyDay} className="mt-2 w-full">
              <CalendarPlus aria-hidden="true" size={16} /> Add to calendar (.ics)
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
