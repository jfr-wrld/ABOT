import { afterEach, describe, expect, it } from "vitest";
import {
  bmr,
  fuelTarget,
  mesocycleWeek,
  normalizePhase,
  peakRestSec,
  recoveryModifier,
  setPhaseSource,
  activePhase,
  strengthShield,
  trendRatePerWeek,
  trendWeight,
  type ActivePhaseConfig,
} from "./phase-engine";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const DAY = 86_400_000;
const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
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

afterEach(() => setPhaseSource(() => null));

describe("trendWeight", () => {
  it("smooths with EMA = today × 0.25 + yesterday × 0.75", () => {
    const t = trendWeight([
      { id: "2026-11-01", date: 1 * DAY, weightKg: 80 },
      { id: "2026-11-03", date: 3 * DAY, weightKg: 76 },
      { id: "2026-11-02", date: 2 * DAY, weightKg: 84 },
    ]);
    expect(t.map((p) => p.emaKg)).toEqual([80, 81, 79.75]);
  });

  it("gives kg per week over the last two weeks", () => {
    const pts = Array.from({ length: 15 }, (_, i) => ({ date: i * DAY, weightKg: 80 - i * 0.1, emaKg: 80 - i * 0.1 }));
    expect(trendRatePerWeek(pts, 14 * DAY)).toBeCloseTo(-0.7, 2);
    expect(trendRatePerWeek(pts.slice(0, 1), 14 * DAY)).toBeNull();
  });
});

describe("energy", () => {
  it("uses Mifflin-St Jeor", () => {
    expect(bmr(80, 180, 30, "male")).toBe(1780);
    expect(bmr(60, 165, 30, "female")).toBe(1320.25);
  });

  it("cuts 350-500 kcal with 2.2 g protein and 0.8 g fat per kg", () => {
    const f = fuelTarget(phase(), 80, 200, true);
    expect(f.tdee).toBe(Math.round(1780 * 1.375 + 200));
    expect(f.delta).toBe(-440);
    expect(f.proteinG).toBe(176);
    expect(f.fatG).toBe(64);
    expect(f.carbsG).toBe(Math.round((f.kcal - 176 * 4 - 64 * 9) / 4));
  });

  it("bulks 250-350 kcal over, and recomp cycles ±150 by training day", () => {
    expect(fuelTarget(phase({ phaseType: "BULKING", weeklyRatePercent: 0.3 }), 80, 0, true).delta).toBe(264);
    expect(fuelTarget(phase({ phaseType: "BULKING", weeklyRatePercent: 1 }), 80, 0, true).delta).toBe(350);
    expect(fuelTarget(phase({ phaseType: "RECOMP" }), 80, 0, true).delta).toBe(150);
    expect(fuelTarget(phase({ phaseType: "RECOMP" }), 80, 0, false).delta).toBe(-150);
    expect(fuelTarget(phase({ phaseType: "RECOMP" }), 80, 0, false).proteinG).toBe(160);
  });
});

describe("calibration", () => {
  it("slows recovery 15% on a cut, speeds it 10% on a bulk", () => {
    expect(recoveryModifier(phase())).toBe(1.15);
    expect(recoveryModifier(phase({ phaseType: "BULKING" }))).toBe(0.9);
    expect(recoveryModifier(phase({ phaseType: "RECOMP" }))).toBe(1);
    expect(recoveryModifier(null)).toBe(1);
  });

  it("rests 180 s after compounds only while peaking", () => {
    expect(peakRestSec({ category: "compound" }, phase({ phaseType: "STRENGTH_PEAK" }))).toBe(180);
    expect(peakRestSec({ category: "isolation" }, phase({ phaseType: "STRENGTH_PEAK" }))).toBeNull();
    expect(peakRestSec({ category: "compound" }, phase())).toBeNull();
  });

  it("reads the active phase from its source, ignoring a finished one", () => {
    setPhaseSource(() => phase());
    expect(activePhase()?.phaseType).toBe("CUTTING");
    setPhaseSource(() => phase({ isActive: false }));
    expect(activePhase()).toBeNull();
  });
});

describe("mesocycleWeek", () => {
  it("counts weeks from the start day and marks every fourth week as deload", () => {
    const start = new Date(2026, 10, 2).getTime();
    expect(mesocycleWeek(phase(), start + DAY)).toMatchObject({ week: 1, of: 8, deload: false, finished: false });
    expect(mesocycleWeek(phase(), start + 22 * DAY)).toMatchObject({ week: 4, deload: true });
    expect(mesocycleWeek(phase(), start + 60 * DAY)).toMatchObject({ week: 8, finished: true, daysLeft: 0 });
  });
});

describe("strengthShield", () => {
  const session = (at: number, kg: number): WorkoutSession => ({
    id: `s${at}`,
    name: "Lower",
    startedAt: at,
    status: "completed",
    exercises: [{ id: "e", exerciseId: "squat-barbell", restSeconds: 120, sets: [{ id: "a", type: "normal", weightKg: kg, reps: 5, rpe: null, completed: true }] }],
  });

  it("reads strength per kg of trend weight and calls muscle-loss risk low when it holds on a cut", () => {
    const now = 100 * DAY;
    const pts = [
      { date: now - 30 * DAY, weightKg: 82, emaKg: 82 },
      { date: now - DAY, weightKg: 79, emaKg: 79 },
    ];
    const s = strengthShield([session(now - 40 * DAY, 120), session(now - 3 * DAY, 120)], byId, pts, now, phase());
    expect(s?.ratio).toBeCloseTo((120 * (1 + 5 / 30)) / 79, 2);
    expect(s?.changePct).toBeGreaterThan(0);
    expect(s?.risk).toBe("low");
    const losing = strengthShield([session(now - 40 * DAY, 120), session(now - 3 * DAY, 105)], byId, pts, now, phase());
    expect(losing?.risk).toBe("high");
  });
});

describe("normalizePhase", () => {
  it("keeps a good phase and bounds what is out of range", () => {
    expect(normalizePhase(phase())).toEqual(phase());
    expect(normalizePhase({ ...phase(), age: 300, activityMultiplier: 5 })).toMatchObject({ age: 100, activityMultiplier: 1.9 });
    expect(normalizePhase({ ...phase(), phaseType: "SHRED" })).toBeNull();
    expect(normalizePhase(null)).toBeNull();
  });
});

describe("templateFitsPhase", () => {
  it("matches templates to the phase they suit", async () => {
    const { templateFitsPhase } = await import("./phase-engine");
    const { ROUTINE_TEMPLATES } = await import("./seed-routines");
    const fits = (p: Parameters<typeof templateFitsPhase>[1]) => ROUTINE_TEMPLATES.filter((t) => templateFitsPhase(t, p)).map((t) => t.id);
    expect(fits("STRENGTH_PEAK")).toContain("tpl-push-a");
    expect(fits("BULKING").length).toBeGreaterThan(0);
    expect(fits("CUTTING").every((id) => !id.startsWith("tpl-push") && !id.startsWith("tpl-pull") && !id.startsWith("tpl-legs"))).toBe(true);
    expect(fits("RECOMP").length).toBeGreaterThan(0);
    for (const p of ["CUTTING", "BULKING", "RECOMP", "STRENGTH_PEAK"] as const) expect(fits(p).length, p).toBeLessThan(ROUTINE_TEMPLATES.length);
  });
});
