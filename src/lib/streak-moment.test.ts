import { describe, expect, it } from "vitest";
import type { WorkoutSession } from "@/types/workout";
import { streakMoment } from "./streak-moment";

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
