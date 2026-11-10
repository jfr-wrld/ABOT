import { describe, expect, it } from "vitest";
import { monthGrid, startOfWeek, streakWeeks, weekStreak, weeklyBuckets } from "./analytics";
import type { WorkoutSession } from "@/types/workout";

const session = (startedAt: number, volumeSet = true): WorkoutSession => ({
  id: String(startedAt),
  name: "w",
  startedAt,
  finishedAt: startedAt + 60_000,
  status: "completed",
  exercises: volumeSet
    ? [
        {
          id: "e",
          exerciseId: "squat-barbell",
          restSeconds: 90,
          sets: [{ id: "s", type: "normal", weightKg: 100, reps: 5, rpe: null, completed: true }],
        },
      ]
    : [],
});

// Wednesday 2026-11-04 12:00 local
const now = new Date(2026, 10, 4, 12).getTime();
const WEEK = 7 * 86_400_000;

describe("startOfWeek", () => {
  it("snaps to Monday by default", () => {
    const d = new Date(startOfWeek(now));
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(2);
  });
  it("snaps to Sunday when asked", () => {
    expect(new Date(startOfWeek(now, 0)).getDay()).toBe(0);
  });
});

describe("weeklyBuckets", () => {
  it("zero-fills and sums volume into the right week", () => {
    const b = weeklyBuckets([session(now), session(now - WEEK), session(now - WEEK)], 4, now);
    expect(b).toHaveLength(4);
    expect(b.map((x) => x.workouts)).toEqual([0, 0, 2, 1]);
    expect(b[3]!.volumeKg).toBe(500);
    expect(b[2]!.volumeKg).toBe(1000);
  });
});

describe("weekStreak", () => {
  it("counts consecutive weeks and survives an empty current week", () => {
    expect(weekStreak([session(now - WEEK), session(now - 2 * WEEK)], now)).toBe(2);
    expect(weekStreak([session(now), session(now - WEEK), session(now - 3 * WEEK)], now)).toBe(2);
    expect(weekStreak([session(now - 2 * WEEK)], now)).toBe(0);
    expect(weekStreak([], now)).toBe(0);
  });

  it("four trained weeks earn one rest week that keeps the streak", () => {
    const weeks = (...ago: number[]) => ago.map((n) => session(now - n * WEEK));
    // Trained 6..3 weeks ago, off 2 weeks ago, trained last week: the rest week bridges it.
    expect(weekStreak(weeks(6, 5, 4, 3, 1), now)).toBe(5);
    expect(streakWeeks(weeks(6, 5, 4, 3, 1), now).restWeeks.size).toBe(1);
    // Only three trained weeks before the gap: no rest week yet.
    expect(weekStreak(weeks(5, 4, 3, 1), now)).toBe(1);
    // Two weeks off in a row are one too many.
    expect(weekStreak(weeks(7, 6, 5, 4, 1), now)).toBe(1);
    // The rest week is spent; the next gap needs four more trained weeks.
    expect(weekStreak(weeks(8, 7, 6, 5, 3, 1), now)).toBe(1);
  });
});

describe("monthGrid", () => {
  it("returns 42 cells starting on the configured first day", () => {
    const g = monthGrid(2026, 10, 1, now);
    expect(g).toHaveLength(42);
    expect(new Date(g[0]!.date).getDay()).toBe(1);
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(g.filter((c) => c.isToday)).toHaveLength(1);
  });
});
