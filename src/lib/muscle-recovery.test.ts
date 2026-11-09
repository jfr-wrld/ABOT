import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { fatigueStage, muscleFatigue, regionTelemetry, sleepFactor } from "./muscle-recovery";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const HOUR = 3_600_000;
const now = new Date(2026, 10, 9, 12).getTime();

const sets = (n: number, at: number, extra: Partial<WorkoutSet> = {}): WorkoutSet[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${at}-${i}`,
    type: "normal",
    weightKg: 60,
    reps: 8,
    rpe: null,
    completed: true,
    completedAt: at,
    ...extra,
  }));

const session = (exerciseId: string, list: WorkoutSet[], status: WorkoutSession["status"] = "completed", id = `w${list[0]?.completedAt}`): WorkoutSession => ({
  id,
  name: id,
  startedAt: (list[0]?.completedAt ?? now) - HOUR,
  finishedAt: list[0]?.completedAt,
  status,
  exercises: [{ id: `${id}-e`, exerciseId, restSeconds: 90, sets: list }],
});

const round = (n: number | undefined) => Math.round((n ?? 0) * 100) / 100;

describe("muscleFatigue", () => {
  it("adds 15% per set to primary muscles and 7.5% to secondary ones", () => {
    // Bench press: chest primary; triceps and shoulders secondary.
    const f = muscleFatigue([session("bench-press-barbell", sets(4, now))], byId, now);
    expect(round(f.chest)).toBe(60);
    expect(round(f.triceps)).toBe(30);
    expect(round(f.shoulders)).toBe(30);
    expect(f.quads).toBeUndefined();
  });

  it("fades in a straight line: 72 hours for big muscles, 48 for small ones", () => {
    const f = muscleFatigue([session("bench-press-barbell", sets(4, now - 24 * HOUR))], byId, now);
    expect(round(f.chest)).toBe(round(60 - 24 * (100 / 72)));
    // 30% on a small muscle at 100/48 an hour is gone after 14.4 hours.
    expect(f.triceps).toBeUndefined();
  });

  it("scales by RPE when it was logged", () => {
    expect(round(muscleFatigue([session("bench-press-barbell", sets(1, now, { rpe: 10 }))], byId, now).chest)).toBe(18.75);
    expect(round(muscleFatigue([session("bench-press-barbell", sets(1, now, { rpe: 6 }))], byId, now).chest)).toBe(11.25);
  });

  it("never passes 100%", () => {
    expect(muscleFatigue([session("bench-press-barbell", sets(12, now))], byId, now).chest).toBe(100);
  });

  it("ignores warm-ups, unticked sets and discarded workouts", () => {
    const f = muscleFatigue(
      [
        session("bench-press-barbell", sets(3, now, { type: "warmup" }), "completed", "a"),
        session("bench-press-barbell", sets(3, now, { completed: false }), "completed", "b"),
        session("bench-press-barbell", sets(3, now), "discarded", "c"),
      ],
      byId,
      now,
    );
    expect(f.chest).toBeUndefined();
  });

  it("counts a timed set (a plank) without reps", () => {
    const f = muscleFatigue([session("plank", sets(2, now, { reps: null, weightKg: null, durationSec: 60 }))], byId, now);
    expect(round(f.abs)).toBe(30);
  });

  it("fatigue left from an earlier session stacks with a new one", () => {
    const f = muscleFatigue(
      [session("squat-barbell", sets(4, now - 36 * HOUR)), session("squat-barbell", sets(2, now - HOUR))],
      byId,
      now,
    );
    // 60% decays for 35 hours to 11.39, plus 30%, then one more hour of decay.
    expect(round(f.quads)).toBe(round(60 - 35 * (100 / 72) + 30 - 100 / 72));
  });
});

describe("sleep", () => {
  it("scales recovery speed by last night's sleep against 8 hours, within 0.7x and 1.1x", () => {
    expect(sleepFactor({ minutes: 480, endAt: now - HOUR }, now)).toBe(1);
    expect(sleepFactor({ minutes: 360, endAt: now - HOUR }, now)).toBe(0.75);
    expect(sleepFactor({ minutes: 200, endAt: now - HOUR }, now)).toBe(0.7);
    expect(sleepFactor({ minutes: 600, endAt: now - HOUR }, now)).toBe(1.1);
    // Sleep that ended over a day ago says nothing about tonight's recovery.
    expect(sleepFactor({ minutes: 300, endAt: now - 30 * HOUR }, now)).toBe(1);
    expect(sleepFactor(null, now)).toBe(1);
  });

  it("a short night leaves more fatigue and a later ready time", () => {
    const sessions = [session("bench-press-barbell", sets(4, now - 24 * HOUR))];
    const rested = muscleFatigue(sessions, byId, now, { minutes: 480, endAt: now - 2 * HOUR }).chest!;
    const short = muscleFatigue(sessions, byId, now, { minutes: 360, endAt: now - 2 * HOUR }).chest!;
    expect(round(short)).toBe(round(60 - 24 * (100 / 72) * 0.75));
    expect(short).toBeGreaterThan(rested);
    const t = regionTelemetry(sessions, byId, now, { minutes: 360, endAt: now - 2 * HOUR });
    expect(t.chest.readyInHours).toBe(Math.ceil((short - 20) / ((100 / 72) * 0.75)));
  });
});

describe("fatigueStage", () => {
  it("uses the four bands of the thermal scale", () => {
    expect([0, 20, 21, 50, 51, 80, 81, 100].map(fatigueStage)).toEqual([
      "fresh",
      "fresh",
      "recovering",
      "recovering",
      "high",
      "high",
      "exhausted",
      "exhausted",
    ]);
  });
});

describe("regionTelemetry", () => {
  it("reports recovery, the last session's sets and the hours to ready per drawn muscle", () => {
    const sessions = [session("bench-press-barbell", sets(4, now - 4 * HOUR))];
    const r = regionTelemetry(sessions, byId, now);
    const chest = r.chest;
    expect(chest.stage).toBe("high");
    expect(chest.lastTrainedAt).toBe(now - 4 * HOUR);
    expect(chest.lastSets).toBe(4);
    // 60% less 4 hours is 54.4%; down to 20% at 100/72 an hour takes about 25 more hours.
    expect(chest.readyInHours).toBe(Math.ceil((60 - 4 * (100 / 72) - 20) / (100 / 72)));
    expect(r["upper-back"]).toMatchObject({ stage: "fresh", lastTrainedAt: null, lastSets: 0, readyInHours: 0 });
  });
});
