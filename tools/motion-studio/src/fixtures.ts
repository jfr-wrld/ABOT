import { SEED_EXERCISES } from "@/data/exercises";
import { buildPeriodStoryData, buildStoryData, type StoryData } from "@/lib/story-data";
import { streakCardData } from "@/lib/streak-moment";
import type { StreakCardData } from "@/lib/streak-moment";
import type { Exercise, WorkoutSession } from "@/types/workout";

/** Sample workouts to design against: a fixed date, so every frame is the same on every run. */
const NOW = new Date(2026, 10, 13, 19, 0).getTime();
const DAY = 86_400_000;
const byId: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));

let n = 0;
function session(lifts: Record<string, [number, number][]>, daysAgo: number, name: string): WorkoutSession {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id: `fixture-${++n}`,
    name,
    startedAt,
    finishedAt: startedAt + 52 * 60_000,
    status: "completed",
    exercises: Object.entries(lifts).map(([exerciseId, sets]) => ({
      id: `item-${++n}`,
      exerciseId,
      restSeconds: 90,
      sets: sets.map(([weightKg, reps], i) => ({ id: `set-${++n}`, type: "normal", weightKg, reps, rpe: null, completed: true, completedAt: startedAt + i * 180_000 })),
    })),
  };
}

const history = [
  session({ "bench-press-barbell": [[60, 5]], "squat-barbell": [[90, 5]], "deadlift-barbell": [[130, 5]] }, 7, "Full Body"),
  session({ "bench-press-barbell": [[62.5, 5]], "squat-barbell": [[95, 5]] }, 14, "Full Body"),
  session({ "overhead-press-barbell": [[40, 6]] }, 21, "Push"),
];

export type Sample = "full-day" | "one-lift" | "many-records" | "four-weeks";

const today: Record<Sample, WorkoutSession> = {
  "full-day": session(
    {
      "bench-press-barbell": [[60, 8], [70, 6], [80, 5]],
      "squat-barbell": [[100, 5], [110, 5], [120, 3]],
      "deadlift-barbell": [[140, 5], [150, 3]],
      "pull-up": [[0, 10], [0, 8]],
      "overhead-press-barbell": [[40, 8], [45, 6]],
    },
    0,
    "Push Pull Legs",
  ),
  "one-lift": session({ "squat-barbell": [[100, 5], [100, 5], [100, 5]] }, 0, "Squat Day"),
  "many-records": session(
    {
      "bench-press-barbell": [[85, 5], [90, 3]],
      "squat-barbell": [[130, 3]],
      "deadlift-barbell": [[170, 2]],
      "overhead-press-barbell": [[50, 5]],
    },
    0,
    "Test Day",
  ),
  "four-weeks": session({}, 0, ""),
};

/** The card's data for a sample, built by the app's own builders. */
export function storySample(sample: Sample, handle: string): StoryData {
  const data =
    sample === "four-weeks"
      ? buildPeriodStoryData([...history, today["full-day"]], NOW - 28 * DAY, NOW, byId, "kg", "Last 4 weeks")
      : buildStoryData(today[sample], [...history, today[sample]], byId, "kg");
  return { ...data, handle: handle || null };
}

/** A four-week streak ending this week. */
export function streakSample(handle: string): StreakCardData {
  return streakCardData([...history, today["full-day"]], handle || null, NOW)!;
}
