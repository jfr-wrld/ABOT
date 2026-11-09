import { describe, expect, it } from "vitest";
import { initials, liftBoard, profileStats } from "./profile";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));

const set = (weightKg: number | null, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `${weightKg}x${reps}${extra.type ?? ""}`,
  type: "normal",
  weightKg,
  reps,
  rpe: null,
  completed: true,
  ...extra,
});

const session = (id: string, startedAt: number, exercises: [string, WorkoutSet[]][], status: WorkoutSession["status"] = "completed"): WorkoutSession => ({
  id,
  name: id,
  startedAt,
  finishedAt: startedAt + 45 * 60_000,
  status,
  exercises: exercises.map(([exerciseId, sets], i) => ({ id: `${id}-${i}`, exerciseId, restSeconds: 90, sets })),
});

const DAY = 86_400_000;
const now = new Date(2026, 10, 4, 12).getTime();

describe("profileStats", () => {
  const sessions = [
    session("a", now - 20 * DAY, [["bench-press-barbell", [set(80, 5), set(40, 10, { type: "warmup" })]]]),
    session("b", now - 2 * DAY, [
      ["squat-barbell", [set(120, 3)]],
      ["deadlift-barbell", [set(150, 2), set(160, 1, { completed: false })]],
    ]),
    session("live", now, [["bench-press-barbell", [set(200, 1)]]], "active"),
  ];
  const stats = profileStats(sessions, byId, now, 1);

  it("counts finished workouts only, and their completed working sets", () => {
    expect(stats.workouts).toBe(2);
    expect(stats.sets).toBe(3);
  });

  it("sums volume and training time from finished workouts", () => {
    expect(stats.volumeKg).toBe(80 * 5 + 120 * 3 + 150 * 2);
    expect(stats.trainingSec).toBe(2 * 45 * 60);
  });

  it("knows when training started", () => {
    expect(stats.firstWorkoutAt).toBe(now - 20 * DAY);
  });

  it("ranks every weighted lift by estimated 1RM, ignoring the unfinished workout", () => {
    const board = liftBoard(sessions, byId);
    expect(board.map((l) => l.exercise.id).slice(0, 3)).toEqual(["deadlift-barbell", "squat-barbell", "bench-press-barbell"]);
    expect(board[2]!.best.weightKg).toBe(80);
    expect(board[2]!.points.length).toBeGreaterThan(0);
    expect(liftBoard([], byId)).toEqual([]);
  });

  it("is empty, not broken, with no history", () => {
    const empty = profileStats([], byId, now, 1);
    expect(empty).toMatchObject({ workouts: 0, sets: 0, volumeKg: 0, trainingSec: 0, firstWorkoutAt: null });
  });
});

describe("initials", () => {
  it("takes the first letters of the first and last word", () => {
    expect(initials("Jafar Shodiq Akram")).toBe("JA");
    expect(initials("budi")).toBe("B");
  });
  it("returns null for an empty name", () => {
    expect(initials("   ")).toBeNull();
  });
});

describe("normalizeHandle", () => {
  it("keeps what a social handle may contain", async () => {
    const { normalizeHandle } = await import("./profile");
    expect(normalizeHandle("  @@Jafar Lifts!  ")).toBe("JafarLifts");
    expect(normalizeHandle("abot.gym_01")).toBe("abot.gym_01");
    expect(normalizeHandle("x".repeat(40))).toHaveLength(30);
  });
});
