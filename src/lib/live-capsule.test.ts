import { describe, expect, it, vi } from "vitest";
import { applyCapsuleAction, capsuleContent, nextTarget, type CapsuleInput } from "./live-capsule";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
let n = 0;
const set = (completed: boolean, weightKg: number | null = 60, reps: number | null = 5): WorkoutSet => ({ id: `set${n++}`, type: "normal", weightKg, reps, rpe: null, completed });
const start = new Date(2026, 10, 8, 14, 0).getTime();
const session: WorkoutSession = {
  id: "s",
  name: "Push A",
  startedAt: start,
  status: "active",
  exercises: [
    { id: "a", exerciseId: "bench-press-barbell", restSeconds: 90, sets: [set(true), set(true)] },
    { id: "b", exerciseId: "overhead-press-barbell", restSeconds: 120, sets: [set(true), set(false, 40, 8), set(false)] },
  ],
};
const input = (over: Partial<CapsuleInput> = {}): CapsuleInput => ({
  session,
  sessions: [],
  byId,
  rest: null,
  now: start + 60_000,
  unit: "kg",
  mode: "full",
  detail: "set",
  ring: true,
  ...over,
});

describe("nextTarget", () => {
  it("is the first unticked set, with its weight, reps and the rest after it", () => {
    expect(nextTarget(session, [], byId)).toMatchObject({ sessionExerciseId: "b", name: "Overhead Press (Barbell)", set: 2, of: 3, weightKg: 40, reps: 8, restSec: 120 });
  });

  it("borrows weight and reps from the same set last time when the set is blank", () => {
    const blank = { ...session, exercises: [{ ...session.exercises[1]!, sets: [set(true), set(false, null, null)] }] };
    const last: WorkoutSession = { ...session, id: "old", status: "completed", startedAt: start - 86_400_000, exercises: [{ ...session.exercises[1]!, sets: [set(true), set(true, 42.5, 6)] }] };
    expect(nextTarget(blank, [last], byId)).toMatchObject({ weightKg: 42.5, reps: 6 });
  });
});

describe("capsuleContent", () => {
  it("counts the workout up from its start, with the next set's target and a Log set button", () => {
    expect(capsuleContent(input())).toMatchObject({
      title: "Overhead Press (Barbell), set 2/3",
      text: "Target: 40 kg × 8",
      clockStart: start,
      canLog: true,
      logRestSec: 120,
      restOnly: false,
      ring: true,
    });
  });

  it("counts a running rest down under the next lift, then says rest is over", () => {
    const endsAt = start + 5 * 60_000;
    expect(capsuleContent(input({ rest: { endsAt }, now: start + 4 * 60_000 }))).toMatchObject({
      restEndsAt: endsAt,
      restTitle: "Resting · next: Overhead Press (Barbell)",
      restText: "Set 2: 40 kg × 8",
      overTitle: "Rest over · Overhead Press (Barbell), set 2/3",
    });
  });

  it("shows the volume instead when asked, in the lifter's unit", () => {
    const c = capsuleContent(input({ detail: "volume", unit: "lbs" }));
    expect(c.text).toMatch(/^Volume [\d,.]+k? lbs$/);
  });

  it("passes rest-only mode and Rest alert through, and drops a rest that already ended", () => {
    const c = capsuleContent(input({ mode: "rest", ring: false, rest: { endsAt: start }, now: start + 1 }));
    expect(c).toMatchObject({ restOnly: true, ring: false });
    expect(c.restEndsAt).toBeUndefined();
  });

  it("freezes the clock while paused, with no Log set button", () => {
    const paused = { ...session, pausedMs: 60_000, pausedAt: start + 10 * 60_000 };
    const c = capsuleContent(input({ session: paused, now: start + 20 * 60_000 }));
    expect(c.clockStart).toBe(start + 60_000);
    expect(c.pausedElapsed).toBe(9 * 60_000);
    expect(c.canLog).toBe(false);
  });
});

describe("applyCapsuleAction", () => {
  const actions = (over: Partial<Parameters<typeof applyCapsuleAction>[1]> = {}) => ({
    active: session,
    sessions: [],
    restTimer: { endsAt: start + 90_000 },
    pauseActive: vi.fn(),
    resumeActive: vi.fn(),
    skipRest: vi.fn(),
    adjustRest: vi.fn(),
    updateSet: vi.fn(),
    completeSet: vi.fn(),
    ...over,
  });

  it("adds 30 seconds only while resting", () => {
    const w = actions();
    applyCapsuleAction("add30", w, byId);
    expect(w.adjustRest).toHaveBeenCalledWith(30);
    const idle = actions({ restTimer: null });
    applyCapsuleAction("add30", idle, byId);
    expect(idle.adjustRest).not.toHaveBeenCalled();
  });

  it("logs the next set as it stands", () => {
    const w = actions();
    applyCapsuleAction("log", w, byId);
    const target = session.exercises[1]!.sets[1]!;
    expect(w.updateSet).not.toHaveBeenCalled();
    expect(w.completeSet).toHaveBeenCalledWith("b", target.id, true);
  });

  it("does not log a set with no reps to log", () => {
    const blank = { ...session, exercises: [{ ...session.exercises[1]!, sets: [set(false, null, null)] }] };
    const w = actions({ active: blank });
    applyCapsuleAction("log", w, byId);
    expect(w.completeSet).not.toHaveBeenCalled();
  });
});
