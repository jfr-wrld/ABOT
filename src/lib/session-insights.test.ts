import { describe, expect, it } from "vitest";
import { muscleWork, previousComparable, sessionRecords, workedMuscles } from "./session-insights";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const DAY = 86_400_000;
const set = (w: number, r: number): WorkoutSet => ({ id: `${w}x${r}${Math.random()}`, type: "normal", weightKg: w, reps: r, rpe: null, completed: true });
const session = (id: string, at: number, ex: [string, WorkoutSet[]][], extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  name: "Push",
  startedAt: at,
  finishedAt: at + 3_600_000,
  status: "completed",
  exercises: ex.map(([exerciseId, sets], i) => ({ id: `${id}${i}`, exerciseId, restSeconds: 90, sets })),
  ...extra,
});

describe("session insights", () => {
  const first = session("a", 0, [["bench-press-barbell", [set(60, 5)]]], { routineId: "r" });
  const second = session("b", DAY, [["bench-press-barbell", [set(70, 5)]], ["overhead-press-barbell", [set(40, 5)]]], { routineId: "r" });

  it("separates beaten records from lifts done for the first time", () => {
    const r = sessionRecords(second, [first, second], byId);
    expect(new Set(r.records.map((p) => p.exerciseId))).toEqual(new Set(["bench-press-barbell"]));
    expect(r.newLifts).toEqual(["overhead-press-barbell"]);
    expect(sessionRecords(first, [first, second], byId).records).toEqual([]);
  });

  it("finds the previous session of the same routine", () => {
    expect(previousComparable(second, [first, second])?.id).toBe("a");
    expect(previousComparable(first, [first, second])).toBeNull();
  });

  it("lists primary muscles first, without repeating them as secondary", () => {
    const m = workedMuscles(second, byId);
    expect(m.primary).toContain("chest");
    expect(m.secondary.some((x) => m.primary.includes(x))).toBe(false);
  });

  it("counts muscle work by the balance radar's rule, also while the workout runs", () => {
    const fake = (id: string, primaryMuscles: Exercise["primaryMuscles"], secondaryMuscles: Exercise["secondaryMuscles"]) =>
      ({ ...SEED_EXERCISES[0]!, id, primaryMuscles, secondaryMuscles }) as Exercise;
    const lib = { row: fake("row", ["lats"], ["biceps"]), curl: fake("curl", ["biceps"], []) };
    const warm: WorkoutSet = { ...set(20, 10), type: "warmup" };
    const live = session("c", 0, [["row", [set(60, 8), set(60, 8), warm]], ["curl", [set(10, 12)]]], { status: "active", finishedAt: undefined });
    const w = muscleWork(live, lib);
    // Biceps: half a set for each of the two rows, one for the curl.
    expect(w.muscles).toHaveLength(2);
    expect(w.muscles).toEqual(expect.arrayContaining([
      { muscle: "lats", sets: 2, primary: true },
      { muscle: "biceps", sets: 2, primary: true },
    ]));
    // A helper only: half a set, after the main muscle.
    const rowOnly = muscleWork(session("e", 0, [["row", [set(60, 8)]]]), lib).muscles;
    expect(rowOnly).toEqual([
      { muscle: "lats", sets: 1, primary: true },
      { muscle: "biceps", sets: 0.5, primary: false },
    ]);
    // Biceps sit on Pull and Arms; each set counts once per axis.
    expect(w.axes.pull).toBe(3);
    expect(w.axes.arms).toBe(2);
    expect(w.axes.push).toBe(0);
    expect(w.dominant).toBe("pull");
    expect(muscleWork(session("d", 0, []), lib)).toMatchObject({ muscles: [], dominant: null });
  });
});
