import { describe, expect, it } from "vitest";
import { buildPeriodStoryData, buildStoryData } from "./story-data";
import type { GymLocation, WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES_BY_ID as byId } from "@/data/exercises";

const set = (weightKg: number | null, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `${weightKg}x${reps}${extra.type ?? ""}${extra.id ?? ""}`,
  type: "normal",
  weightKg,
  reps,
  rpe: null,
  completed: true,
  ...extra,
});

const session = (id: string, startedAt: number, exercises: [string, WorkoutSet[]][], extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  name: "Push day",
  startedAt,
  finishedAt: startedAt + 50 * 60_000,
  status: "completed",
  exercises: exercises.map(([exerciseId, sets], i) => ({ id: `${id}-${i}`, exerciseId, restSeconds: 90, sets })),
  ...extra,
});

const DAY = 86_400_000;
const t0 = new Date(2026, 10, 1, 7).getTime();

const gym: GymLocation = { id: "gym", name: "Garage", barWeightKg: 20, plateInventoryKg: [20], isDefault: true };

describe("buildStoryData", () => {
  const first = session("a", t0, [["bench-press-barbell", [set(60, 8, { id: "a1" })]]]);
  const second = session("b", t0 + 2 * DAY, [["bench-press-barbell", [set(65, 6, { id: "b1" })]]]);
  const today = session(
    "c",
    t0 + 4 * DAY,
    [
      ["bench-press-barbell", [set(70, 5, { id: "c1" }), set(40, 10, { id: "c2", type: "warmup" })]],
      ["squat-barbell", [set(100, 5, { id: "c3" }), set(100, 5, { id: "c4" }), set(100, 5, { id: "c5" })]],
      ["pull-up", [set(null, 8, { id: "c6" }), set(null, 6, { id: "c7", completed: false })]],
    ],
    { locationId: "gym" },
  );
  const sessions = [first, second, today];
  const data = buildStoryData(today, sessions, byId, "kg", [gym]);

  it("totals only what was done", () => {
    expect(data.setsDone).toBe(6);
    // Warm-ups add no volume (calc.isWorkingSet).
    expect(data.volumeKg).toBe(70 * 5 + 3 * 500);
    expect(data.durationSec).toBe(50 * 60);
    expect(data.exercises.map((e) => e.name)).toEqual(["Bench Press (Barbell)", "Squat (Barbell)", "Pull Up"]);
    expect(data.exercises[2].sets).toHaveLength(1);
  });

  it("picks the heaviest set as the best and leaves bodyweight lifts without one", () => {
    expect(data.exercises[0].best).toMatchObject({ weightKg: 70, reps: 5 });
    expect(data.exercises[2].best).toBeNull();
  });

  it("marks record sets and lists every record kind", () => {
    const bench = data.prs.filter((p) => p.exerciseName === "Bench Press (Barbell)").map((p) => p.kind);
    expect(bench).toContain("heaviest_weight");
    expect(data.exercises[0].sets.find((s) => s.weightKg === 70)?.isPR).toBe(true);
    expect(data.exercises[0].sets.find((s) => s.weightKg === 40)?.isPR).toBe(false);
  });

  it("draws the trend for the lift with the longest history, up to this workout", () => {
    expect(data.trend?.exerciseName).toBe("Bench Press (Barbell)");
    expect(data.trend?.points.map((p) => Math.round(p.e1rmKg))).toEqual([76, 78, 82]);
  });

  it("ignores later workouts when an old one is shared", () => {
    const old = buildStoryData(second, sessions, byId, "kg");
    expect(old.trend?.points).toHaveLength(2);
    expect(old.prs.length).toBeGreaterThan(0);
  });

  it("counts muscles, equipment and the gym", () => {
    expect(data.muscles[0]).toEqual({ muscle: "quads", sets: 3 });
    expect(data.equipment.find((e) => e.label === "Barbell")?.count).toBe(2);
    expect(data.locationName).toBe("Garage");
    expect(data.barWeightKg).toBe(20);
  });

  it("has no trend when nothing carried load", () => {
    const bw = session("d", t0 + 5 * DAY, [["pull-up", [set(null, 10, { id: "d1" })]]]);
    expect(buildStoryData(bw, [...sessions, bw], byId, "kg").trend).toBeNull();
  });
});

describe("buildPeriodStoryData", () => {
  const a = session("a", t0, [["bench-press-barbell", [set(60, 8, { id: "a1" })]]]);
  const b = session("b", t0 + 2 * DAY, [["bench-press-barbell", [set(70, 5, { id: "b1" }), set(65, 8, { id: "b2" })]]]);
  const outside = session("z", t0 - 30 * DAY, [["squat-barbell", [set(200, 1, { id: "z1" })]]]);
  const data = buildPeriodStoryData([outside, a, b], t0 - DAY, t0 + 3 * DAY, byId, "kg", "Last 4 weeks");

  it("adds up only the workouts in the range", () => {
    expect(data.kind).toBe("period");
    expect(data.workouts).toBe(2);
    expect(data.volumeKg).toBe(480 + 350 + 520);
    expect(data.setsDone).toBe(3);
    expect(data.title).toBe("Last 4 weeks");
    expect(data.exercises.map((e) => e.name)).toEqual(["Bench Press (Barbell)"]);
  });

  it("keeps the biggest sets per lift and the records that still stand", () => {
    expect(data.exercises[0].sets.map((s) => s.volumeKg)).toEqual([520, 480, 350]);
    expect(data.prs.every((p) => p.exerciseName === "Bench Press (Barbell)")).toBe(true);
    expect(data.prs.map((p) => p.kind).sort()).toEqual(["best_1rm", "best_set_volume", "heaviest_weight"]);
  });

  it("uses an id of letters and digits only", () => {
    expect(data.sessionId).toMatch(/^R\d{16}$/);
  });
});
