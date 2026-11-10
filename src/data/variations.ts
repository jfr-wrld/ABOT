import type { Exercise } from "@/types/workout";
import { movementPattern, type MovementPattern } from "@/lib/exercise-swapper";

/**
 * Grip, stance and angle choices for an exercise in a workout. A variation is a note on how the
 * lift was done that day, not a separate exercise: records stay with the exercise. Keys are stored
 * on sessions and routines, so they must never be renamed; labels are English, translated by t().
 */
export const VARIATION_LABEL: Record<string, string> = {
  wide: "Wide grip",
  close: "Close grip",
  neutral: "Neutral grip",
  mixed: "Mixed grip",
  overhand: "Overhand grip",
  underhand: "Underhand grip",
  incline: "Incline",
  decline: "Decline",
  paused: "Paused",
  "high-bar": "High bar",
  "low-bar": "Low bar",
  "wide-stance": "Wide stance",
  "narrow-stance": "Narrow stance",
  front: "Front",
  conventional: "Conventional",
  sumo: "Sumo",
  deficit: "Deficit",
  "single-arm": "One arm",
  "single-leg": "One leg",
  seated: "Seated",
  standing: "Standing",
  "feet-elevated": "Feet elevated",
  "knees-down": "Knees down",
  reverse: "Reverse",
};

const BY_PATTERN: Partial<Record<MovementPattern, string[]>> = {
  "vertical-pull": ["wide", "close", "neutral", "mixed"],
  "horizontal-pull": ["overhand", "underhand", "neutral", "wide", "single-arm"],
  "horizontal-push": ["wide", "close", "incline", "decline", "paused"],
  "vertical-push": ["seated", "standing", "neutral", "single-arm"],
  squat: ["high-bar", "low-bar", "wide-stance", "narrow-stance", "paused"],
  lunge: ["front", "reverse", "single-leg"],
  hinge: ["conventional", "sumo", "deficit", "single-leg"],
};

/** Exercises whose choices differ from their pattern's. */
const BY_ID: Record<string, string[]> = {
  "push-up": ["wide", "close", "incline", "decline", "feet-elevated", "knees-down"],
  "diamond-push-up": ["incline", "decline", "knees-down"],
  "pike-push-up": ["feet-elevated"],
  "chin-up": ["close", "wide", "neutral"],
  "chest-dip": ["wide", "close"],
  "triceps-dip": ["wide", "close"],
};

/** The variations offered for an exercise; empty when there is nothing to choose. */
export function variationsFor(exercise: Exercise | undefined): string[] {
  if (!exercise) return [];
  return BY_ID[exercise.id] ?? BY_PATTERN[movementPattern(exercise)] ?? [];
}

/** The English label of a stored key; an unknown key shows as it was stored. */
export function variationLabel(key: string): string {
  return VARIATION_LABEL[key] ?? key;
}
