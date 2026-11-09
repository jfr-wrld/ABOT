import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkoutStore } from "./useWorkoutStore";
import { sessionDurationSec } from "@/lib/calc";

const initial = useWorkoutStore.getState();

function setup() {
  useWorkoutStore.setState({ ...initial, sessions: [], active: null, restTimer: null }, true);
  const s = useWorkoutStore.getState();
  s.startEmpty(90);
  s.addExercise("bench-press-barbell", 90);
  const ex = useWorkoutStore.getState().active!.exercises[0]!;
  return { exId: ex.id, setIds: ex.sets.map((x) => x.id) };
}

beforeEach(() => {
  useWorkoutStore.setState({ ...initial, sessions: [], active: null, restTimer: null }, true);
});

describe("completeAllRemaining", () => {
  it("marks only sets with reps and does not start the rest timer", () => {
    const { exId, setIds } = setup();
    const s = useWorkoutStore.getState();
    s.updateSet(exId, setIds[0]!, { weightKg: 60, reps: 8 });
    s.updateSet(exId, setIds[1]!, { weightKg: 60, reps: 8 });
    // third set left empty
    const n = useWorkoutStore.getState().completeAllRemaining();
    expect(n).toBe(2);
    const sets = useWorkoutStore.getState().active!.exercises[0]!.sets;
    expect(sets.map((x) => x.completed)).toEqual([true, true, false]);
    expect(sets[0]!.completedAt).toBeTypeOf("number");
    expect(useWorkoutStore.getState().restTimer).toBeNull();
  });

  it("returns 0 with no active workout", () => {
    expect(useWorkoutStore.getState().completeAllRemaining()).toBe(0);
  });
});

describe("setStartedAt", () => {
  it("rejects a time in the future", () => {
    setup();
    const r = useWorkoutStore.getState().setStartedAt(Date.now() + 60_000);
    expect(r.ok).toBe(false);
  });

  it("rejects a time after the first completed set", () => {
    const { exId, setIds } = setup();
    const s = useWorkoutStore.getState();
    s.updateSet(exId, setIds[0]!, { reps: 5 });
    s.completeSet(exId, setIds[0]!, true);
    const doneAt = Date.now() - 10 * 60_000;
    useWorkoutStore.getState().updateSet(exId, setIds[0]!, { completedAt: doneAt });
    const r = useWorkoutStore.getState().setStartedAt(doneAt + 60_000);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("first completed set") });
  });

  it("accepts an earlier time", () => {
    setup();
    const t = Date.now() - 30 * 60_000;
    expect(useWorkoutStore.getState().setStartedAt(t)).toEqual({ ok: true });
    expect(useWorkoutStore.getState().active!.startedAt).toBe(t);
  });
});

describe("completeSet", () => {
  it("changes state synchronously", () => {
    const { exId, setIds } = setup();
    useWorkoutStore.getState().updateSet(exId, setIds[0]!, { reps: 5 });
    useWorkoutStore.getState().completeSet(exId, setIds[0]!, true);
    expect(useWorkoutStore.getState().active!.exercises[0]!.sets[0]!.completed).toBe(true);
    expect(useWorkoutStore.getState().restTimer?.totalSec).toBe(90);
  });
});

import { useLocationStore } from "./useLocationStore";

describe("gym location", () => {
  it("a new workout starts at the default gym and can switch", () => {
    useLocationStore.setState({ locations: [] });
    const a = useLocationStore.getState().add("Gym A");
    const b = useLocationStore.getState().add("Gym B");
    useWorkoutStore.getState().startEmpty(90);
    expect(useWorkoutStore.getState().active!.locationId).toBe(a.id);
    useWorkoutStore.getState().setLocation(b.id);
    expect(useWorkoutStore.getState().active!.locationId).toBe(b.id);
    useWorkoutStore.getState().setLocation(undefined);
    expect(useWorkoutStore.getState().active!.locationId).toBeUndefined();
  });

  it("with no gyms the workout has no location", () => {
    useLocationStore.setState({ locations: [] });
    useWorkoutStore.getState().startEmpty(90);
    expect(useWorkoutStore.getState().active!.locationId).toBeUndefined();
  });
});

describe("pause and resume", () => {
  it("paused time is left out of the duration, and resuming carries on", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 8, 9, 0, 0));
      setup();
      vi.setSystemTime(new Date(2026, 10, 8, 9, 10, 0)); // 10 min in
      useWorkoutStore.getState().pauseActive();
      const paused = useWorkoutStore.getState().active!;
      expect(paused.pausedAt).toBe(Date.now());
      vi.setSystemTime(new Date(2026, 10, 8, 9, 40, 0)); // 30 min break
      expect(sessionDurationSec(useWorkoutStore.getState().active!, Date.now())).toBe(600);
      useWorkoutStore.getState().resumeActive();
      vi.setSystemTime(new Date(2026, 10, 8, 9, 45, 0));
      expect(sessionDurationSec(useWorkoutStore.getState().active!, Date.now())).toBe(900);
      expect(useWorkoutStore.getState().active!.pausedAt).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pausing clears the rest timer, ticking a set resumes, and finishing while paused counts the pause out", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 8, 9, 0, 0));
      const { exId, setIds } = setup();
      const s = useWorkoutStore.getState();
      s.updateSet(exId, setIds[0]!, { weightKg: 60, reps: 8 });
      s.completeSet(exId, setIds[0]!, true);
      expect(useWorkoutStore.getState().restTimer).not.toBeNull();
      vi.setSystemTime(new Date(2026, 10, 8, 9, 5, 0));
      useWorkoutStore.getState().pauseActive();
      expect(useWorkoutStore.getState().restTimer).toBeNull();

      vi.setSystemTime(new Date(2026, 10, 8, 9, 20, 0));
      s.updateSet(exId, setIds[1]!, { weightKg: 60, reps: 8 });
      useWorkoutStore.getState().completeSet(exId, setIds[1]!, true);
      expect(useWorkoutStore.getState().active!.pausedAt).toBeUndefined();
      expect(useWorkoutStore.getState().active!.pausedMs).toBe(15 * 60_000);

      useWorkoutStore.getState().pauseActive();
      vi.setSystemTime(new Date(2026, 10, 8, 9, 50, 0));
      const done = useWorkoutStore.getState().finishActive()!;
      expect(done.pausedAt).toBeUndefined();
      expect(sessionDurationSec(done)).toBe(5 * 60);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("reorder and replace", () => {
  it("reorderExercises puts the exercises in the given order and ignores unknown ids", () => {
    setup();
    const s = useWorkoutStore.getState();
    s.addExercise("squat-barbell", 90);
    s.addExercise("deadlift-barbell", 90);
    const ids = useWorkoutStore.getState().active!.exercises.map((e) => e.id);
    useWorkoutStore.getState().reorderExercises([ids[2]!, ids[0]!, ids[1]!]);
    expect(useWorkoutStore.getState().active!.exercises.map((e) => e.exerciseId)).toEqual([
      "deadlift-barbell",
      "bench-press-barbell",
      "squat-barbell",
    ]);
    useWorkoutStore.getState().reorderExercises([ids[0]!, "nope"]);
    expect(useWorkoutStore.getState().active!.exercises).toHaveLength(3);
  });

  it("replaceExercise swaps the movement and keeps the sets as typed", () => {
    const { exId, setIds } = setup();
    useWorkoutStore.getState().updateSet(exId, setIds[0]!, { weightKg: 60, reps: 8 });
    useWorkoutStore.getState().replaceExercise(exId, "bench-press-dumbbell");
    const ex = useWorkoutStore.getState().active!.exercises[0]!;
    expect(ex.id).toBe(exId);
    expect(ex.exerciseId).toBe("bench-press-dumbbell");
    expect(ex.sets[0]).toMatchObject({ weightKg: 60, reps: 8 });
  });
});

describe("supersets", () => {
  function three() {
    setup();
    const s = useWorkoutStore.getState();
    s.addExercise("squat-barbell", 90);
    s.addExercise("deadlift-barbell", 120);
    return useWorkoutStore.getState().active!.exercises.map((e) => e.id) as [string, string, string];
  }

  it("linking two exercises gives them one superset; a third joins the same one", () => {
    const [a, b, c] = three();
    useWorkoutStore.getState().linkSuperset(a, b);
    let ex = useWorkoutStore.getState().active!.exercises;
    expect(ex[0]!.supersetId).toBeTruthy();
    expect(ex[1]!.supersetId).toBe(ex[0]!.supersetId);
    useWorkoutStore.getState().linkSuperset(c, a);
    ex = useWorkoutStore.getState().active!.exercises;
    expect(ex[2]!.supersetId).toBe(ex[0]!.supersetId);
  });

  it("removing one of two leaves no lonely superset behind", () => {
    const [a, b] = three();
    useWorkoutStore.getState().linkSuperset(a, b);
    useWorkoutStore.getState().unlinkSuperset(a);
    const ex = useWorkoutStore.getState().active!.exercises;
    expect(ex[0]!.supersetId).toBeUndefined();
    expect(ex[1]!.supersetId).toBeUndefined();
  });

  it("rest starts only after the last exercise of the superset", () => {
    const [a, b] = three();
    useWorkoutStore.getState().linkSuperset(a, b);
    const ex = useWorkoutStore.getState().active!.exercises;
    const s = useWorkoutStore.getState();
    s.updateSet(a, ex[0]!.sets[0]!.id, { weightKg: 60, reps: 8 });
    s.completeSet(a, ex[0]!.sets[0]!.id, true);
    expect(useWorkoutStore.getState().restTimer).toBeNull();
    s.updateSet(b, ex[1]!.sets[0]!.id, { weightKg: 100, reps: 5 });
    useWorkoutStore.getState().completeSet(b, ex[1]!.sets[0]!.id, true);
    expect(useWorkoutStore.getState().restTimer).toMatchObject({ sessionExerciseId: b, totalSec: 90 });
  });

  it("a giant set hands off A1 to A2 to A3 with no rest, then rests", () => {
    const [a, b, c] = three();
    useWorkoutStore.getState().linkSuperset(a, b);
    useWorkoutStore.getState().linkSuperset(b, c);
    const ex = () => useWorkoutStore.getState().active!.exercises;
    const tick = (i: number, k = 0) => useWorkoutStore.getState().completeSet(ex()[i]!.id, ex()[i]!.sets[k]!.id, true);

    tick(0);
    expect(useWorkoutStore.getState()).toMatchObject({ restTimer: null, handoff: { sessionExerciseId: b, setIndex: 0 } });
    tick(1);
    expect(useWorkoutStore.getState()).toMatchObject({ restTimer: null, handoff: { sessionExerciseId: c, setIndex: 0 } });
    tick(2);
    expect(useWorkoutStore.getState().handoff).toBeNull();
    expect(useWorkoutStore.getState().restTimer).toMatchObject({ sessionExerciseId: c });
    // Round two points at set 2 of A2.
    tick(0, 1);
    expect(useWorkoutStore.getState().handoff).toEqual({ sessionExerciseId: b, setIndex: 1 });
  });

  it("an extra set on A1 with nothing left on A2 rests straight away", () => {
    const [a, b] = three();
    useWorkoutStore.getState().linkSuperset(a, b);
    const ex = () => useWorkoutStore.getState().active!.exercises;
    for (const st of ex()[1]!.sets) useWorkoutStore.getState().completeSet(b, st.id, true);
    useWorkoutStore.getState().completeSet(a, ex()[0]!.sets[0]!.id, true);
    expect(useWorkoutStore.getState().handoff).toBeNull();
    expect(useWorkoutStore.getState().restTimer).toMatchObject({ sessionExerciseId: a });
  });

  it("removing the exercise waiting next clears the handoff", () => {
    const [a, b] = three();
    useWorkoutStore.getState().linkSuperset(a, b);
    useWorkoutStore.getState().completeSet(a, useWorkoutStore.getState().active!.exercises[0]!.sets[0]!.id, true);
    expect(useWorkoutStore.getState().handoff?.sessionExerciseId).toBe(b);
    useWorkoutStore.getState().removeExercise(b);
    expect(useWorkoutStore.getState().handoff).toBeNull();
  });
});

describe("starting from a routine", () => {
  it("keeps the routine's supersets", () => {
    useWorkoutStore.setState({ ...initial, sessions: [], active: null, restTimer: null }, true);
    const set = { id: "s", type: "normal" as const, targetWeightKg: null, targetReps: 10 };
    useWorkoutStore.getState().startFromRoutine({
      id: "r",
      name: "Arms",
      createdAt: 1,
      updatedAt: 1,
      exercises: [
        { id: "a", exerciseId: "bicep-curl-barbell", restSeconds: 60, sets: [set], supersetId: "x" },
        { id: "b", exerciseId: "triceps-pushdown-cable", restSeconds: 60, sets: [set], supersetId: "x" },
      ],
    });
    const ex = useWorkoutStore.getState().active!.exercises;
    expect(ex[0]!.supersetId).toBeTruthy();
    expect(ex[1]!.supersetId).toBe(ex[0]!.supersetId);
  });
});
