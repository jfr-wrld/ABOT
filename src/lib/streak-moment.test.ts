import { describe, expect, it } from "vitest";
import type { WorkoutSession } from "@/types/workout";
import { currentStreak, streakCardData, streakMoment } from "./streak-moment";

const DAY = 86_400_000;
// Wednesday 2026-11-11, noon local time; weeks start on Monday.
const NOW = new Date(2026, 10, 11, 12).getTime();

const session = (id: string, startedAt: number, finishedAt = startedAt + 3_600_000): WorkoutSession => ({
  id,
  name: "Push",
  startedAt,
  finishedAt,
  status: "completed",
  exercises: [],
});

describe("streakMoment", () => {
  it("starts a streak with the first workout", () => {
    const s = [session("a", NOW - 3_600_000, NOW - 60_000)];
    expect(streakMoment(s, "a", NOW)).toEqual({ before: 0, after: 1, weeks: [false, false, false, false, true] });
  });

  it("grows the streak with the first workout of a new week", () => {
    const s = [session("old2", NOW - 14 * DAY), session("old1", NOW - 7 * DAY), session("a", NOW - 3_600_000, NOW - 60_000)];
    expect(streakMoment(s, "a", NOW)).toMatchObject({ before: 2, after: 3, weeks: [false, false, true, true, true] });
  });

  it("stays quiet for a second workout in the same week", () => {
    const s = [session("first", NOW - DAY), session("a", NOW - 3_600_000, NOW - 60_000)];
    expect(streakMoment(s, "a", NOW)).toBeNull();
  });

  it("stays quiet when the summary is opened long after Finish", () => {
    const s = [session("a", NOW - 2 * 3_600_000, NOW - 3_600_000)];
    expect(streakMoment(s, "a", NOW)).toBeNull();
  });

  it("stays quiet for a workout that is not finished", () => {
    const s = [{ ...session("a", NOW - 3_600_000, NOW - 60_000), status: "active" as const }];
    expect(streakMoment(s, "a", NOW)).toBeNull();
  });
});

describe("currentStreak", () => {
  it("replays the streak as it stands, rolling up from one less", () => {
    const s = [session("old1", NOW - 7 * DAY), session("a", NOW - 2 * DAY)];
    expect(currentStreak(s, NOW)).toEqual({ before: 1, after: 2, weeks: [false, false, false, true, true] });
  });

  it("is null without a streak", () => {
    expect(currentStreak([], NOW)).toBeNull();
    expect(currentStreak([session("old", NOW - 21 * DAY)], NOW)).toBeNull();
  });
});

describe("streakCardData", () => {
  it("counts the streak's workouts and the date it began", () => {
    const s = [session("gone", NOW - 35 * DAY), session("w1", NOW - 14 * DAY), session("w2", NOW - 7 * DAY), session("w2b", NOW - 6 * DAY), session("now", NOW - DAY)];
    const d = streakCardData(s, "jafar", NOW)!;
    expect(d.weeks).toBe(3);
    expect(d.workouts).toBe(4);
    expect(new Date(d.since).getDay()).toBe(1);
    expect(d.since).toBeLessThanOrEqual(NOW - 14 * DAY);
    expect(d.row).toHaveLength(12);
    expect(d.row.slice(-3)).toEqual([true, true, true]);
    expect(d.handle).toBe("jafar");
  });

  it("is null without a streak", () => {
    expect(streakCardData([], null, NOW)).toBeNull();
  });
});

