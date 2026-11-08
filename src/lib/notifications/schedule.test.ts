import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE, buildIcs, dueReminders, nextSession, reminderContent, type WorkoutSchedule } from "./schedule";

// Monday 2026-11-09, local time.
const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).getTime();
const schedule: WorkoutSchedule = {
  ...DEFAULT_SCHEDULE,
  enabled: true,
  time: "17:30",
  leadMinutes: 30,
  days: { ...DEFAULT_SCHEDULE.days, 1: { on: true, routineId: "push" }, 3: { on: true, routineId: "pull" }, 5: { on: true, routineId: null } },
};

describe("dueReminders", () => {
  it("fires the prep call at time minus lead, then the session call", () => {
    const prep = dueReminders(schedule, at(9, 16, 59), at(9, 17, 1));
    expect(prep).toEqual([{ kind: "prep", at: at(9, 17, 0), weekday: 1, routineId: "push", key: "2026-11-09:prep" }]);
    const call = dueReminders(schedule, at(9, 17, 29), at(9, 17, 31));
    expect(call.map((r) => r.kind)).toEqual(["session"]);
  });

  it("ignores days that are off, and everything when the schedule is off", () => {
    expect(dueReminders(schedule, at(10, 16, 0), at(10, 18, 0))).toEqual([]);
    expect(dueReminders({ ...schedule, enabled: false }, at(9, 16, 0), at(9, 18, 0))).toEqual([]);
  });

  it("does not replay reminders older than ten minutes (the app was asleep)", () => {
    expect(dueReminders(schedule, at(9, 9, 0), at(9, 18, 0)).map((r) => r.kind)).toEqual([]);
    expect(dueReminders(schedule, at(9, 9, 0), at(9, 17, 35)).map((r) => r.kind)).toEqual(["session"]);
  });

  it("no lead time means only the session call", () => {
    expect(dueReminders({ ...schedule, leadMinutes: 0 }, at(9, 16, 0), at(9, 17, 31)).map((r) => r.kind)).toEqual(["session"]);
  });
});

describe("nextSession", () => {
  it("finds the next scheduled day and time", () => {
    expect(nextSession(schedule, at(9, 18, 0))).toEqual({ at: at(11, 17, 30), weekday: 3, routineId: "pull" });
    expect(nextSession(schedule, at(9, 12, 0))?.at).toBe(at(9, 17, 30));
    expect(nextSession({ ...schedule, enabled: false }, at(9, 12, 0))).toBeNull();
  });
});

describe("reminderContent", () => {
  const routine = { id: "push", name: "Push Day", muscles: ["Chest", "Shoulders", "Triceps"] };
  it("session call: terminal title, routine and primary muscles, Start and Snooze", () => {
    const c = reminderContent({ kind: "session", at: 0, weekday: 1, routineId: "push", key: "k" }, routine, "17:30");
    expect(c.title).toBe("ABOT // SESSION_CALL [Push Day]");
    expect(c.body).toBe("Scheduled: Push Day • Primary: Chest, Shoulders, Triceps. Tap to initiate workout.");
    expect(c.actions.map((a) => a.action)).toEqual(["ACTION_START", "ACTION_SNOOZE"]);
    expect(c.data).toEqual({ routineId: "push", url: "/workout?start=push" });
  });
  it("prep call names the time; a day without a routine is a free session", () => {
    const c = reminderContent({ kind: "prep", at: 0, weekday: 5, routineId: null, key: "k" }, null, "17:30");
    expect(c.title).toBe("ABOT // PREP_CALL [Free session]");
    expect(c.body).toBe("Pack your gym bag. Free session starts at 17:30.");
    expect(c.data.url).toBe("/workout?start=empty");
  });
});

describe("buildIcs", () => {
  it("writes one weekly event per training day with the lead-time alarm", () => {
    const ics = buildIcs(schedule, { push: "Push Day", pull: "Pull Day" }, at(9, 8, 0));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(ics).toContain("SUMMARY:ABOT: Push Day");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("SUMMARY:ABOT: Free session");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
