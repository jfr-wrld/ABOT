import { beforeEach, describe, expect, it } from "vitest";
import { useWorkoutStore } from "./useWorkoutStore";

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
