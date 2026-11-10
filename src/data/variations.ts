import type { Exercise } from "@/types/workout";
import { movementPattern, type MovementPattern } from "@/lib/exercise-swapper";

/**
 * Grip, stance and angle choices for an exercise in a workout. A variation is a note on how the
 * lift was done that day, not a separate exercise: records stay with the exercise. Keys are stored
 * on sessions and routines, so they must never be renamed; labels are English, translated by t().
 * Exercises whose name already fixes the handle (rope pushdown, rope hammer curl, face pull,
 * pallof press) offer nothing.
 */
export const VARIATION_LABEL: Record<string, string> = {
  wide: "Wide grip",
  close: "Close grip",
  neutral: "Neutral grip",
  mixed: "Mixed grip",
  hook: "Hook grip",
  thumbless: "Thumbless grip",
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
  // Cable attachments: on a cable the handle sets the grip.
  "v-handle": "V handle",
  "straight-bar": "Straight bar",
  "wide-bar": "Wide bar",
  rope: "Rope",
  "single-handle": "Single handle",
  "ez-bar": "EZ bar",
  "mag-grip": "MAG grip",
  "ankle-strap": "Ankle strap",
};

const BY_PATTERN: Partial<Record<MovementPattern, string[]>> = {
  "vertical-pull": ["wide", "close", "neutral", "mixed", "thumbless"],
  "horizontal-pull": ["overhand", "underhand", "neutral", "wide", "single-arm"],
  // Incline and decline are their own exercises, so a press offers grips and a pause.
  "horizontal-push": ["wide", "close", "paused"],
  "vertical-push": ["seated", "standing", "neutral", "single-arm"],
  squat: ["high-bar", "low-bar", "wide-stance", "narrow-stance", "paused"],
  lunge: ["front", "reverse", "single-leg"],
  hinge: ["conventional", "sumo", "deficit", "single-leg"],
};

/**
 * On a cable machine the attachment is the variation that matters (V handle, rope, bars), so
 * cable exercises offer attachments instead of grips, by pattern or by the muscle worked.
 */
const CABLE_BY_PATTERN: Partial<Record<MovementPattern, string[]>> = {
  "horizontal-pull": ["v-handle", "wide-bar", "straight-bar", "mag-grip", "rope", "single-handle"],
  "vertical-pull": ["wide-bar", "v-handle", "straight-bar", "mag-grip", "single-handle"],
  "isolation-triceps": ["rope", "straight-bar", "v-handle", "ez-bar", "single-handle"],
  "isolation-biceps": ["straight-bar", "ez-bar", "rope", "single-handle"],
  "isolation-lats": ["rope", "straight-bar", "single-handle"],
  "isolation-shoulders": ["single-handle", "rope"],
  "isolation-back": ["rope", "single-handle"],
  "isolation-abs": ["rope", "single-handle"],
};

/** Exercises whose choices differ from their pattern's. */
const BY_ID: Record<string, string[]> = {
  "push-up": ["wide", "close", "incline", "decline", "feet-elevated", "knees-down"],
  "diamond-push-up": ["incline", "decline", "knees-down"],
  "pike-push-up": ["feet-elevated"],
  "chin-up": ["close", "wide", "neutral"],
  "chest-dip": ["wide", "close"],
  "triceps-dip": ["wide", "close"],
  "triceps-rope-pushdown-cable": [],
  "rope-hammer-curl-cable": [],
  "face-pull-cable": [],
  "pallof-press": [],
  "single-arm-lat-pulldown": [],
  "single-arm-seated-row-cable": [],
  "close-grip-lat-pulldown": ["v-handle", "straight-bar", "mag-grip"],
  "reverse-grip-lat-pulldown": ["straight-bar", "ez-bar"],
  "reverse-grip-pushdown-cable": ["straight-bar", "ez-bar", "single-handle"],
  // Dumbbells and machines: grips that the equipment allows.
  "bench-press-dumbbell": ["neutral", "paused"],
  "incline-bench-press-dumbbell": ["neutral", "paused"],
  "decline-bench-press-dumbbell": ["neutral", "paused"],
  "floor-press-dumbbell": ["neutral", "paused"],
  "chest-press-machine": ["wide", "close", "neutral"],
  "incline-chest-press-machine": ["wide", "close", "neutral"],
  "incline-push-up": ["wide", "close"],
  "bench-dip": ["feet-elevated"],
  "inverted-row": ["overhand", "underhand", "wide", "feet-elevated"],
  "high-row-machine": ["neutral", "overhand", "single-arm"],
  "chest-supported-t-bar-row": ["neutral", "wide"],
  "bent-over-row-smith": ["overhand", "underhand"],
  "shoulder-press-machine": ["neutral", "single-arm"],
  "seated-overhead-press-barbell": [],
  "push-press": [],
  "romanian-deadlift-dumbbell": ["single-leg"],
  "reverse-lunge-dumbbell": [],
  "lunge-barbell": [],
  "sumo-squat-dumbbell": [],
  "calf-press-leg-press": [],
  // Machines and front-loaded squats have no bar position to choose.
  "leg-press-machine": ["wide-stance", "narrow-stance", "single-leg"],
  "hack-squat-machine": ["wide-stance", "narrow-stance"],
  "squat-smith-machine": ["wide-stance", "narrow-stance", "paused"],
  "goblet-squat": ["wide-stance", "paused"],
  "front-squat-barbell": ["wide-stance", "narrow-stance", "paused"],
  "bodyweight-squat": ["wide-stance", "narrow-stance", "paused"],
  "box-squat": ["high-bar", "low-bar", "wide-stance", "narrow-stance"],
  "straight-arm-pulldown-cable": ["straight-bar", "rope"],
  "glute-kickback-cable": ["ankle-strap", "single-handle"],
  // Heavy pulls: the grip that holds the bar is the choice that matters.
  "deadlift-barbell": ["mixed", "hook", "deficit", "paused"],
  "sumo-deadlift-barbell": ["mixed", "hook", "deficit"],
  "rack-pull-barbell": ["mixed", "hook"],
  "trap-bar-deadlift": [],
  "lateral-raise-cable": [],
  "rear-delt-fly-cable": [],
  "cable-woodchopper": [],
};

/** The variations offered for an exercise; empty when there is nothing to choose. */
export function variationsFor(exercise: Exercise | undefined): string[] {
  if (!exercise) return [];
  if (exercise.id in BY_ID) return BY_ID[exercise.id];
  const pattern = movementPattern(exercise);
  if (exercise.equipment === "cable") return CABLE_BY_PATTERN[pattern] ?? [];
  return BY_PATTERN[pattern] ?? [];
}

/** The English label of a stored key; an unknown key shows as it was stored. */
export function variationLabel(key: string): string {
  return VARIATION_LABEL[key] ?? key;
}
