import { describe, expect, it } from "vitest";
import { nextProtocol, prCounts, relativeDay, weekDayVolumes, weekStrip, weeklyFrequency, weeklyVolume } from "./home";
import { DEFAULT_SCHEDULE, type WorkoutSchedule } from "@/lib/notifications/schedule";
import type { Exercise, Routine, WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Wednesday 4 Nov 2026, noon. With Monday first, the week started on 2 Nov.
const now = new Date(2026, 10, 4, 12).getTime();

const set = (weightKg: number, reps: number): WorkoutSet => ({
  id: `${weightKg}x${reps}`,
  type: "normal",
  weightKg,
  reps,
  rpe: null,
  completed: true,
});

const session = (id: string, startedAt: number, exercises: [string, WorkoutSet[]][], routineId?: string): WorkoutSession => ({
  id,
  name: id,
  routineId,
  startedAt,
  finishedAt: startedAt + HOUR,
  status: "completed",
  exercises: exercises.map(([exerciseId, sets], i) => ({ id: `${id}-${i}`, exerciseId, restSeconds: 90, sets })),
});

const routine = (id: string, exerciseId = "bench-press-barbell"): Routine => ({
  id,
  name: id,
  exercises: [{ id: `${id}-e`, exerciseId, restSeconds: 90, sets: [] }] as unknown as Routine["exercises"],
  createdAt: 0,
  updatedAt: 0,
});

describe("weekStrip", () => {
  it("lights trained days and marks today in the lifter's week order", () => {
    const days = weekStrip([session("mon", now - 2 * DAY, [["bench-press-barbell", [set(60, 5)]]])], now, 1);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.trained)).toEqual([true, false, false, false, false, false, false]);
    expect(days.findIndex((d) => d.isToday)).toBe(2);
    expect(days[3].isFuture).toBe(true);
  });
});

describe("weekly figures", () => {
  const sessions = [
    session("this", now - DAY, [["bench-press-barbell", [set(100, 5)]]]),
    session("last-same-point", now - 8 * DAY, [["bench-press-barbell", [set(50, 5)]]]),
    // Later in last week than "now" is in this one: left out of the comparison.
    session("last-late", now - 3 * DAY, [["bench-press-barbell", [set(1000, 5)]]]),
  ];

  it("compares this week's volume with last week up to the same moment", () => {
    // "last-late" is Sunday 1 Nov, which is in last week but after Wednesday noon.
    expect(weeklyVolume(sessions, now, 1, byId)).toEqual({ kg: 500, changePct: 100 });
  });

  it("has no trend when last week was empty", () => {
    expect(weeklyVolume([sessions[0]], now, 1, byId).changePct).toBeNull();
  });

  it("counts training days against the scheduled days", () => {
    const schedule: WorkoutSchedule = {
      ...DEFAULT_SCHEDULE,
      enabled: true,
      days: { ...DEFAULT_SCHEDULE.days, 1: { on: true, routineId: null }, 3: { on: true, routineId: null }, 5: { on: true, routineId: null } },
    };
    expect(weeklyFrequency(sessions, schedule, now, 1)).toEqual({ done: 1, target: 3, lastWeek: 2 });
    expect(weeklyFrequency(sessions, DEFAULT_SCHEDULE, now, 1).target).toBeNull();
  });
});

describe("nextProtocol", () => {
  const routines = [routine("Push"), routine("Pull"), routine("Legs")];

  it("follows the last routine trained", () => {
    const sessions = [session("s", now - DAY, [["bench-press-barbell", [set(60, 5)]]], "Push")];
    expect(nextProtocol(routines, sessions, DEFAULT_SCHEDULE, now)).toEqual({ routine: routines[1], reason: "After Push" });
  });

  it("prefers the schedule when it names a routine", () => {
    const wd = new Date(now).getDay() as 3;
    const schedule: WorkoutSchedule = { ...DEFAULT_SCHEDULE, enabled: true, days: { ...DEFAULT_SCHEDULE.days, [wd]: { on: true, routineId: "Legs" } } };
    expect(nextProtocol(routines, [], schedule, now)).toEqual({ routine: routines[2], reason: "Scheduled today" });
  });

  it("is empty without a routine that has exercises", () => {
    expect(nextProtocol([{ ...routine("Empty"), exercises: [] }], [], DEFAULT_SCHEDULE, now)).toBeNull();
  });
});

describe("recent workout tags", () => {
  it("counts one record per lift, and none for a first attempt", () => {
    const first = session("a", now - 2 * DAY, [["bench-press-barbell", [set(60, 5)]]]);
    const second = session("b", now - DAY, [["bench-press-barbell", [set(70, 5)]]]);
    expect(prCounts([first, second], [first, second], byId)).toEqual({ a: 0, b: 1 });
  });
});

describe("home visuals", () => {
  it("splits this week's volume by day", () => {
    const v = weekDayVolumes([session("x", now - 2 * DAY, [["bench-press-barbell", [set(100, 5)]]])], now, 1, byId);
    expect(v).toEqual([500, 0, 0, 0, 0, 0, 0]);
  });

  it("names nearby days in words", () => {
    expect(relativeDay(now, now)).toBe("Today");
    expect(relativeDay(now - DAY, now)).toBe("Yesterday");
  });
});
