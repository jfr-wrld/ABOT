import type { Exercise } from "@/types/workout";

/**
 * The share of body weight a bodyweight exercise moves, so a pull-up at 70 kg counts as 70 kg
 * and a push-up as about 45 kg. Rough, published figures, good enough for volume and records:
 * pull-up, chin-up and dips move the whole body; a push-up about two thirds (more with the hands
 * close, more again in a pike); a bodyweight squat about the body above the knees.
 * 0 means reps only: core work, where a load figure means nothing useful.
 */
const BY_ID: Record<string, number> = {
  "pull-up": 1,
  "chin-up": 1,
  "chest-dip": 1,
  "triceps-dip": 1,
  "push-up": 0.64,
  "diamond-push-up": 0.66,
  "pike-push-up": 0.7,
  "bodyweight-squat": 0.85,
  "single-leg-calf-raise": 1,
  "back-extension": 0.5,
  plank: 0,
  "hanging-leg-raise": 0,
  crunch: 0,
  "russian-twist": 0,
  "ab-wheel-rollout": 0,
  "mountain-climber": 0,
};

/** Catalog and custom exercises: matched by name, in this order. */
const BY_NAME: [RegExp, number][] = [
  [/crunch|sit.?up|twist|plank|climber|leg raise|knee raise|ab wheel|rollout|hollow|v.?up|flutter|bridge|burpee|jack/i, 0],
  [/pull.?up|chin.?up|muscle.?up|dip/i, 1],
  [/pike/i, 0.7],
  [/push.?up|press.?up/i, 0.64],
  [/inverted row|australian/i, 0.6],
  [/squat|lunge|step.?up|pistol/i, 0.85],
];

/** For a bodyweight exercise, the share of body weight it moves; 0 for anything else. */
export function bodyweightFactor(exercise: Pick<Exercise, "id" | "name" | "isBodyweight"> | undefined): number {
  if (!exercise?.isBodyweight) return 0;
  if (exercise.id in BY_ID) return BY_ID[exercise.id];
  for (const [re, f] of BY_NAME) if (re.test(exercise.name)) return f;
  return 1;
}

/** The load a bodyweight set carries from the body, rounded to 0.1 kg; undefined without one. */
export function bodyLoadFor(exercise: Pick<Exercise, "id" | "name" | "isBodyweight"> | undefined, bodyweightKg: number | null): number | undefined {
  const f = bodyweightFactor(exercise);
  if (f <= 0 || !bodyweightKg || bodyweightKg <= 0) return undefined;
  return Math.round(bodyweightKg * f * 10) / 10;
}
