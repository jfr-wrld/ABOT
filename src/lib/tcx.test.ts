import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { tcxFileName, workoutNotes, workoutToTcx } from "./tcx";

const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const start = Date.UTC(2024, 0, 15, 8, 30);
const session: WorkoutSession = {
  id: "w1",
  name: "Push & <Pull>",
  startedAt: start,
  finishedAt: start + 65 * 60_000,
  status: "completed",
  exercises: [
    {
      id: "e1",
      exerciseId: "bench-press-barbell",
      restSeconds: 90,
      sets: [
        { id: "a", type: "warmup", weightKg: 40, reps: 10, rpe: null, completed: true },
        { id: "b", type: "normal", weightKg: 80, reps: 8, rpe: null, completed: true },
        { id: "c", type: "normal", weightKg: 80, reps: 7, rpe: null, completed: true },
      ],
    },
    { id: "e2", exerciseId: "pull-up", restSeconds: 90, sets: [{ id: "d", type: "normal", weightKg: null, reps: 10, rpe: null, completed: true }] },
  ],
};

describe("workoutToTcx", () => {
  const xml = workoutToTcx(session, { kcal: 412.4, byId, unit: "kg" });

  it("writes one lap with the time, calories and start/end time points", () => {
    expect(xml).toContain('<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">');
    expect(xml).toContain("<Id>2024-01-15T08:30:00.000Z</Id>");
    expect(xml).toContain("<TotalTimeSeconds>3900</TotalTimeSeconds>");
    expect(xml).toContain("<Calories>412</Calories>");
    expect(xml).toContain("<Trackpoint><Time>2024-01-15T09:35:00.000Z</Time></Trackpoint>");
  });

  it("escapes the name and notes for XML", () => {
    expect(xml).toContain("<Notes>Push &amp; &lt;Pull&gt;");
    expect(xml).not.toContain("Push & <Pull>");
  });

  it("lists working sets in the notes, warm-ups left out", () => {
    expect(workoutNotes(session, byId, "kg").split("\n")).toEqual([
      "Push & <Pull>",
      "Bench Press (Barbell): 80 kg x 8, 80 kg x 7",
      "Pull Up: 10 reps",
    ]);
  });

  it("names the file by date and workout", () => {
    expect(tcxFileName(session)).toMatch(/^abot-2024-01-1[45]-push-pull\.tcx$/);
  });
});
