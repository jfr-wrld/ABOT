/**
 * The weekly workout schedule and everything computed from it, as pure functions: which
 * reminders are due, the next session, the notification text, and a calendar (.ics) export.
 * Weekdays follow Date#getDay: 0 = Sunday ... 6 = Saturday.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WorkoutSchedule {
  enabled: boolean;
  /** "HH:MM", 24-hour, local time. */
  time: string;
  /** Minutes before the session for the "pack your bag" call; 0 = none. */
  leadMinutes: 0 | 15 | 30;
  days: Record<Weekday, { on: boolean; routineId: string | null }>;
}

const OFF = { on: false, routineId: null };
export const DEFAULT_SCHEDULE: WorkoutSchedule = {
  enabled: false,
  time: "17:30",
  leadMinutes: 30,
  days: { 0: OFF, 1: OFF, 2: OFF, 3: OFF, 4: OFF, 5: OFF, 6: OFF },
};

export interface DueReminder {
  kind: "prep" | "session";
  at: number;
  weekday: Weekday;
  routineId: string | null;
  /** Stable per day and kind, so a reminder is shown once even if checked twice. */
  key: string;
}

const MIN = 60_000;
const DAY = 86_400_000;
/** A reminder found later than this (the tab was asleep) is stale and skipped. */
const STALE_MS = 10 * MIN;

function parseTime(time: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  const h = m ? Math.min(23, Number(m[1])) : 17;
  const min = m ? Math.min(59, Number(m[2])) : 30;
  return [h, min];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Session start on the calendar day of `t`. */
function sessionOn(t: number, time: string): Date {
  const [h, m] = parseTime(time);
  const d = new Date(t);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Reminders whose time falls in (from, to], skipping any older than ten minutes at `to`. */
export function dueReminders(s: WorkoutSchedule, from: number, to: number): DueReminder[] {
  if (!s.enabled || to <= from) return [];
  const out: DueReminder[] = [];
  // Every calendar day the window can touch, plus one either side for the lead time.
  for (let t = from - DAY; t <= to + DAY; t += DAY) {
    const session = sessionOn(t, s.time);
    const weekday = session.getDay() as Weekday;
    const day = s.days[weekday];
    if (!day?.on) continue;
    const events: DueReminder[] = [];
    if (s.leadMinutes > 0) {
      events.push({ kind: "prep", at: session.getTime() - s.leadMinutes * MIN, weekday, routineId: day.routineId, key: `${dayKey(session)}:prep` });
    }
    events.push({ kind: "session", at: session.getTime(), weekday, routineId: day.routineId, key: `${dayKey(session)}:session` });
    for (const e of events) if (e.at > from && e.at <= to && to - e.at <= STALE_MS) out.push(e);
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The next scheduled session strictly after `now`, within the coming week. */
export function nextSession(s: WorkoutSchedule, now: number): { at: number; weekday: Weekday; routineId: string | null } | null {
  if (!s.enabled) return null;
  for (let i = 0; i <= 7; i++) {
    const session = sessionOn(now + i * DAY, s.time);
    const weekday = session.getDay() as Weekday;
    const day = s.days[weekday];
    if (day?.on && session.getTime() > now) return { at: session.getTime(), weekday, routineId: day.routineId };
  }
  return null;
}

export interface ReminderContent {
  title: string;
  body: string;
  tag: string;
  data: { routineId: string | null; url: string };
  actions: { action: "ACTION_START" | "ACTION_SNOOZE"; title: string }[];
}

/** The notification for one reminder, worded by the owner's spec (terminal style). */
export function reminderContent(
  r: DueReminder,
  routine: { id: string; name: string; muscles: string[] } | null,
  time: string,
): ReminderContent {
  const name = routine?.name ?? "Free session";
  const url = `/workout?start=${encodeURIComponent(routine?.id ?? "empty")}`;
  const muscles = routine?.muscles.length ? routine.muscles.join(", ") : "your choice";
  return r.kind === "prep"
    ? {
        title: `ABOT // PREP_CALL [${name}]`,
        body: `Pack your gym bag. ${name} starts at ${time}.`,
        tag: r.key,
        data: { routineId: routine?.id ?? null, url },
        actions: [
          { action: "ACTION_START", title: "Start now" },
          { action: "ACTION_SNOOZE", title: "Snooze 30 min" },
        ],
      }
    : {
        title: `ABOT // SESSION_CALL [${name}]`,
        body: `Scheduled: ${name} • Primary: ${muscles}. Tap to initiate workout.`,
        tag: r.key,
        data: { routineId: routine?.id ?? null, url },
        actions: [
          { action: "ACTION_START", title: "Start workout" },
          { action: "ACTION_SNOOZE", title: "Snooze 30 min" },
        ],
      };
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const ics = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/**
 * The schedule as an iCalendar file: one weekly event per training day, in local (floating)
 * time, with an alarm at the lead time. The phone's calendar then reminds even when ABOT is
 * closed, which a website cannot do on its own.
 */
export function buildIcs(s: WorkoutSchedule, routineNames: Record<string, string>, now: number): string {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ABOT//Workout schedule//EN", "CALSCALE:GREGORIAN"];
  for (const wd of [1, 2, 3, 4, 5, 6, 0] as Weekday[]) {
    const day = s.days[wd];
    if (!day.on) continue;
    let start = sessionOn(now, s.time);
    while (start.getDay() !== wd) start = sessionOn(start.getTime() + DAY, s.time);
    const end = new Date(start.getTime() + 60 * MIN);
    const local = (d: Date) =>
      `${dayKey(d).replace(/-/g, "")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
    const name = (day.routineId && routineNames[day.routineId]) || "Free session";
    lines.push(
      "BEGIN:VEVENT",
      `UID:abot-schedule-${BYDAY[wd]}@abot.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${local(start)}`,
      `DTEND:${local(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[wd]}`,
      `SUMMARY:${ics(`ABOT: ${name}`)}`,
      `DESCRIPTION:${ics("Open ABOT and start the workout.")}`,
    );
    if (s.leadMinutes > 0) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${ics(`Pack your gym bag. ${name} soon.`)}`, `TRIGGER:-PT${s.leadMinutes}M`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
