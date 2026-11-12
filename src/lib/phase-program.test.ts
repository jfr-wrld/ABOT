import { describe, expect, it } from "vitest";
import {
  dayStart,
  fuelTarget,
  normalizePhase,
  programTemplates,
  sessionsThisWeek,
  trendWeight,
  weeklyCheckIn,
  type ActivePhaseConfig,
} from "./phase-engine";
import { ROUTINE_TEMPLATES } from "./seed-routines";
import type { WorkoutSession } from "@/types/workout";

const DAY = 86_400_000;
const phase = (over: Partial<ActivePhaseConfig> = {}): ActivePhaseConfig => ({
  id: "p",
  phaseType: "CUTTING",
  title: "CUT // 8 WEEKS",
  startDate: "2026-11-02",
  durationWeeks: 8,
  startWeightKg: 80,
  targetWeightKg: 76,
  heightCm: 180,
  age: 30,
  biologicalSex: "male",
  activityMultiplier: 1.375,
  weeklyRatePercent: -0.5,
  isActive: true,
  ...over,
});
const start = dayStart("2026-11-02");
/** A weigh-in every other day for `days` days, changing `perWeek` kg a week. */
const weighIns = (days: number, perWeek: number, from = 80) =>
  trendWeight(
    Array.from({ length: Math.floor(days / 2) + 1 }, (_, i) => ({ id: `w${i}`, date: start + i * 2 * DAY, weightKg: from + (perWeek * i * 2) / 7 })),
  );

describe("weekly check-in", () => {
  it("waits for the third week", () => {
    expect(weeklyCheckIn(phase(), weighIns(10, -0.4), start + 10 * DAY)).toBeNull();
  });

  it("asks for weigh-ins when there are too few", () => {
    const few = trendWeight([{ id: "a", date: start, weightKg: 80 }, { id: "b", date: start + 15 * DAY, weightKg: 79.5 }]);
    expect(weeklyCheckIn(phase(), few, start + 16 * DAY)?.kind).toBe("need_weighins");
  });

  it("a cut on plan is on track; a stalled cut gets 150 kcal less; a crash gets 150 more", () => {
    const now = start + 21 * DAY;
    expect(weeklyCheckIn(phase(), weighIns(21, -0.4), now)).toMatchObject({ kind: "on_track", adjustKcal: 0 });
    expect(weeklyCheckIn(phase(), weighIns(21, 0), now)).toMatchObject({ kind: "too_slow", adjustKcal: -150 });
    expect(weeklyCheckIn(phase(), weighIns(21, -1.2), now)).toMatchObject({ kind: "too_fast", adjustKcal: 150 });
  });

  it("a stalled bulk gets 150 kcal more", () => {
    const bulk = phase({ phaseType: "BULKING", weeklyRatePercent: 0.3, targetWeightKg: 82 });
    expect(weeklyCheckIn(bulk, weighIns(21, 0), start + 21 * DAY)).toMatchObject({ kind: "too_slow", adjustKcal: 150 });
  });

  it("recomp corrects a drift either way", () => {
    const recomp = phase({ phaseType: "RECOMP", weeklyRatePercent: 0, targetWeightKg: 80 });
    expect(weeklyCheckIn(recomp, weighIns(21, 0.8), start + 21 * DAY)).toMatchObject({ kind: "drifting", adjustKcal: -150 });
    expect(weeklyCheckIn(recomp, weighIns(21, 0.1), start + 21 * DAY)).toMatchObject({ kind: "on_track" });
  });

  it("shows once a week after an answer, and never moves the target past 600 kcal", () => {
    const answered = phase({ checkInDay: "2026-11-20" });
    expect(weeklyCheckIn(answered, weighIns(21, 0), dayStart("2026-11-23"))).toBeNull();
    expect(weeklyCheckIn(answered, weighIns(28, 0), dayStart("2026-11-27"))?.kind).toBe("too_slow");
    expect(weeklyCheckIn(phase({ kcalAdjust: -600 }), weighIns(21, 0), start + 21 * DAY)?.adjustKcal).toBe(0);
  });

  it("an accepted adjustment moves the day's target, and survives a backup", () => {
    const base = fuelTarget(phase(), 80, 200, false);
    const moved = fuelTarget(phase({ kcalAdjust: -150 }), 80, 200, false);
    expect(moved.kcal).toBe(base.kcal - 150);
    expect(moved.adjust).toBe(-150);
    expect(normalizePhase({ ...phase(), kcalAdjust: -900, sessionsPerWeek: 9, checkInDay: "2026-11-20" })).toMatchObject({ kcalAdjust: -600, sessionsPerWeek: 6, checkInDay: "2026-11-20" });
  });
});

describe("program", () => {
  it("picks templates that exist for every number of training days", () => {
    const ids = new Set(ROUTINE_TEMPLATES.map((t) => t.id));
    for (const n of [2, 3, 4, 5, 6]) {
      const list = programTemplates(n);
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((id) => ids.has(id))).toBe(true);
    }
  });

  it("counts this week's finished workouts from the week's first day", () => {
    const wed = new Date(2026, 10, 11, 18).getTime(); // a Wednesday
    const s = (at: number, status: WorkoutSession["status"] = "completed"): WorkoutSession => ({ id: String(at), name: "", startedAt: at, status, exercises: [] });
    const list = [s(wed - 1 * DAY), s(wed - 2 * DAY), s(wed - 3 * DAY), s(wed - 2 * DAY, "active")];
    expect(sessionsThisWeek(list, wed, 1)).toBe(2);
    expect(sessionsThisWeek(list, wed, 0)).toBe(3);
  });
});
