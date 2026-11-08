import { describe, expect, it } from "vitest";
import { liveContent, nativeLiveContent, nextUp } from "./live-workout";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/types/workout";
import { SEED_EXERCISES } from "@/data/exercises";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const set = (completed: boolean): WorkoutSet => ({ id: String(Math.random()), type: "normal", weightKg: 60, reps: 5, rpe: null, completed });
const start = new Date(2026, 10, 8, 14, 0).getTime();
const session: WorkoutSession = {
  id: "s",
  name: "Push A",
  startedAt: start,
  status: "active",
  exercises: [
    { id: "a", exerciseId: "bench-press-barbell", restSeconds: 90, sets: [set(true), set(true)] },
    { id: "b", exerciseId: "overhead-press-barbell", restSeconds: 90, sets: [set(true), set(false), set(false)] },
  ],
};

describe("live workout notification", () => {
  it("names the next unticked set", () => {
    expect(nextUp(session, byId)).toEqual({ name: "Overhead Press (Barbell)", set: 2, of: 3 });
  });

  it("gives the time rest ends, which stays true while the page sleeps", () => {
    const c = liveContent(session, byId, { endsAt: start + 30 * 60_000 }, start + 29 * 60_000);
    expect(c.title).toMatch(/^Push A · rest until /);
    expect(c.body).toBe("Next: Overhead Press (Barbell), set 2 of 3");
  });

  it("says rest is over once the end time has passed", () => {
    expect(liveContent(session, byId, { endsAt: start }, start + 1).title).toBe("Push A · rest over");
  });

  it("without rest, shows when the workout started", () => {
    expect(liveContent(session, byId, null, start).title).toMatch(/^Push A · since /);
  });

  it("says when every set is done", () => {
    const done = { ...session, exercises: [{ ...session.exercises[0] }] };
    expect(liveContent(done, byId, null, start).body).toBe("All sets done. Tap to finish.");
  });
});

describe("Android live notification", () => {
  it("leads with the next lift and lets the clock count up from the start", () => {
    expect(nativeLiveContent(session, byId, null, start + 60_000)).toEqual({
      title: "Overhead Press (Barbell), set 2/3",
      text: "Push A",
      startedAt: start,
    });
  });

  it("counts a running rest down, then says rest is over", () => {
    const endsAt = start + 5 * 60_000;
    const c = nativeLiveContent(session, byId, { endsAt }, start + 4 * 60_000);
    expect(c).toMatchObject({
      restEndsAt: endsAt,
      restTitle: "Rest · next Overhead Press (Barbell), set 2/3",
      overTitle: "Rest over · Overhead Press (Barbell), set 2/3",
      overText: "Push A",
    });
  });

  it("drops a rest that already ended", () => {
    expect(nativeLiveContent(session, byId, { endsAt: start }, start + 1).restEndsAt).toBeUndefined();
  });
});
