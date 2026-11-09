import type { Exercise, MuscleGroup, WorkoutSession } from "@/types/workout";
import { isWorkingSet } from "./calc";

/**
 * What a day of training was, in the words lifters use: Push, Pull, Legs, Upper, Lower, Core,
 * Full body or Cardio. Read from the working sets done, by each exercise's primary muscles, so
 * a routine's name does not decide it. Used by the Home week strip and the Lifts filter.
 */
export type Bucket = "push" | "pull" | "legs" | "core";
export type FocusLabel = "Push" | "Pull" | "Legs" | "Core" | "Upper" | "Lower" | "Full body" | "Cardio";

export const BUCKET_OF: Partial<Record<MuscleGroup, Bucket>> = {
  chest: "push",
  shoulders: "push",
  triceps: "push",
  back: "pull",
  lats: "pull",
  biceps: "pull",
  traps: "pull",
  forearms: "pull",
  lower_back: "pull",
  quads: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
  adductors: "legs",
  abductors: "legs",
  abs: "core",
};

export const BUCKET_LABEL: Record<Bucket, FocusLabel> = { push: "Push", pull: "Pull", legs: "Legs", core: "Core" };

export interface Focus {
  label: FocusLabel;
  /** The muscle with the most sets, for the day's icon. */
  muscle: MuscleGroup;
  sets: number;
}

/** The focus of a set of workouts (usually one day's); null when nothing was done. */
export function trainingFocus(sessions: WorkoutSession[], byId: Record<string, Exercise>): Focus | null {
  const perMuscle = new Map<MuscleGroup, number>();
  const perBucket: Record<Bucket, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  let cardio = 0;
  let sets = 0;
  for (const s of sessions) {
    for (const e of s.exercises) {
      const muscles = byId[e.exerciseId]?.primaryMuscles ?? [];
      const done = e.sets.filter((st) => st.completed && isWorkingSet(st)).length;
      if (done === 0 || muscles.length === 0) continue;
      sets += done;
      for (const m of muscles) {
        perMuscle.set(m, (perMuscle.get(m) ?? 0) + done / muscles.length);
        const b = BUCKET_OF[m];
        if (b) perBucket[b] += done / muscles.length;
        if (m === "cardio") cardio += done / muscles.length;
      }
    }
  }
  if (sets === 0) return null;
  const muscle = [...perMuscle.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const total = Object.values(perBucket).reduce((a, b) => a + b, 0);
  if (total === 0) return { label: cardio > 0 ? "Cardio" : "Full body", muscle, sets };
  const share = (b: Bucket) => perBucket[b] / total;
  const top = (Object.keys(perBucket) as Bucket[]).sort((a, b) => perBucket[b] - perBucket[a])[0]!;
  let label: FocusLabel;
  if (share(top) >= 0.6) label = BUCKET_LABEL[top];
  else if (share("push") + share("pull") >= 0.75) label = "Upper";
  else if (share("legs") + share("core") >= 0.75) label = "Lower";
  else label = "Full body";
  return { label, muscle, sets };
}

/** The bucket an exercise belongs to, by its first primary muscle. */
export function exerciseBucket(ex: Pick<Exercise, "primaryMuscles">): Bucket | null {
  for (const m of ex.primaryMuscles) {
    const b = BUCKET_OF[m];
    if (b) return b;
  }
  return null;
}
