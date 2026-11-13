import { describe, expect, it } from "vitest";
import { reminderAction, shiftWeekly } from "./notify";

describe("shiftWeekly", () => {
  it("moves the prep call back within the same day", () => {
    expect(shiftWeekly(1, 17, 30, 30)).toEqual({ weekday: 1, hour: 17, minute: 0 });
  });

  it("wraps into the previous day, and from Sunday into Saturday", () => {
    expect(shiftWeekly(3, 0, 10, 30)).toEqual({ weekday: 2, hour: 23, minute: 40 });
    expect(shiftWeekly(0, 0, 0, 15)).toEqual({ weekday: 6, hour: 23, minute: 45 });
  });
});

describe("reminderAction", () => {
  // Any app can hand ABOT's launcher a fake "notification tap" (security audit 2026-11-13).
  it("ignores ids that are not ABOT reminders", () => {
    expect(reminderAction(999, "tap", { url: "/workout?start=empty" })).toEqual({ kind: "ignore" });
    expect(reminderAction("100", "tap", {})).toEqual({ kind: "ignore" });
  });

  it("opens only a workout start link, nothing else", () => {
    expect(reminderAction(101, "tap", { url: "/workout?start=r-1" })).toEqual({ kind: "open", url: "/workout?start=r-1" });
    expect(reminderAction(101, "start", { url: "https://evil.example/login" })).toEqual({ kind: "open", url: "/workout" });
    expect(reminderAction(101, "tap", { url: "/settings?section=data" })).toEqual({ kind: "open", url: "/workout" });
    expect(reminderAction(3, "tap", { url: "data:text/html,<p>x</p>" })).toEqual({ kind: "open", url: "/workout" });
  });

  it("snoozes with only the routine id; the text is rebuilt on the phone", () => {
    expect(reminderAction(112, "snooze", { url: "/workout?start=abc", reminder: { title: "Phish", body: "x" } })).toEqual({ kind: "snooze", routineId: "abc" });
    expect(reminderAction(112, "snooze", { reminder: { title: "Phish" } })).toEqual({ kind: "snooze", routineId: null });
    expect(reminderAction(3, "snooze", { url: "/workout?start=empty" })).toEqual({ kind: "snooze", routineId: null });
  });
});
