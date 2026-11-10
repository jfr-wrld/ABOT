import { describe, expect, it } from "vitest";
import { byMonth, filterHistory, focusesIn } from "./history-search";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, WorkoutSession } from "@/types/workout";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const DAY = 86_400_000;
const t0 = new Date(2026, 9, 30, 18).getTime();

const workout = (id: string, name: string, exerciseId: string, daysAgo: number, locationId?: string): WorkoutSession => ({
  id,
  name,
  startedAt: t0 - daysAgo * DAY,
  finishedAt: t0 - daysAgo * DAY + 3_600_000,
  status: "completed",
  locationId,
  exercises: [
    {
      id: `${id}-e`,
      exerciseId,
      restSeconds: 90,
      sets: [{ id: `${id}-s`, type: "normal", weightKg: 60, reps: 8, rpe: null, completed: true }],
    },
  ],
});

const log = [
  workout("a", "Upper A", "bench-press-barbell", 1, "gym-1"),
  workout("b", "Leg day", "squat-barbell", 5),
  workout("c", "Morning", "bench-press-barbell", 40, "gym-1"),
];

describe("history search", () => {
  it("lists every workout newest first and finds by workout or exercise name", () => {
    expect(filterHistory(log, byId, { query: "", focus: "", gym: "" }).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(filterHistory(log, byId, { query: "leg", focus: "", gym: "" }).map((s) => s.id)).toEqual(["b"]);
    expect(filterHistory(log, byId, { query: "BENCH", focus: "", gym: "" }).map((s) => s.id)).toEqual(["a", "c"]);
    expect(filterHistory(log, byId, { query: "", focus: "", gym: "gym-1" }).map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("filters by the day's focus and offers only the focuses in the log", () => {
    expect(filterHistory(log, byId, { query: "", focus: "Legs", gym: "" }).map((s) => s.id)).toEqual(["b"]);
    expect(focusesIn(log, byId)).toEqual(["Push", "Legs"]);
  });

  it("groups by month", () => {
    const groups = byMonth(filterHistory(log, byId, { query: "", focus: "", gym: "" }));
    expect(groups.map((g) => g.sessions.length)).toEqual([2, 1]);
  });
});
