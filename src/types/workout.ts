/**
 * Core domain model for the gym progress tracker.
 *
 * Design notes
 * - Weights are ALWAYS stored in kilograms. The UI converts to/from lbs
 *   based on the user's `WeightUnit` preference, so analytics never have
 *   to deal with mixed units.
 * - Every entity has a string `id` (nanoid-style). Sessions reference
 *   exercises by id so renaming an exercise never breaks history.
 * - `RoutineExercise` holds *planned* sets; `SessionExercise` holds the
 *   sets that were actually performed. They share the same `SetType`.
 */

export type WeightUnit = "kg" | "lbs";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "traps"
  | "lower_back"
  | "full_body"
  | "cardio";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "other";

/** W = warm-up (yellow), N = normal (default), D = drop set (purple), F = failure (red). */
export type SetType = "warmup" | "normal" | "dropset" | "failure";

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  /** Bodyweight movements have no external load; UI hides the weight column. */
  isBodyweight?: boolean;
  /** Set when the user created it, so we can let them edit/delete it. */
  isCustom?: boolean;
  notes?: string;
}

/** A single performed set inside an active or finished workout. */
export interface WorkoutSet {
  id: string;
  type: SetType;
  /** kg; `null` while the input is empty. */
  weightKg: number | null;
  reps: number | null;
  /** Rate of perceived exertion, 6–10 in 0.5 steps. */
  rpe: number | null;
  completed: boolean;
  completedAt?: number;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  /** Rest timer length (seconds) applied after each completed set. */
  restSeconds: number;
  notes?: string;
}

export type SessionStatus = "active" | "completed" | "discarded";

export interface WorkoutSession {
  id: string;
  name: string;
  /** Routine this session was started from, if any. */
  routineId?: string;
  startedAt: number;
  finishedAt?: number;
  status: SessionStatus;
  exercises: SessionExercise[];
  notes?: string;
}

/** Planned set inside a routine template. */
export interface RoutineSet {
  id: string;
  type: SetType;
  targetWeightKg: number | null;
  targetReps: number | null;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  sets: RoutineSet[];
  restSeconds: number;
  notes?: string;
}

export interface Routine {
  id: string;
  name: string;
  /** Free-form grouping label, e.g. "Push / Pull / Legs", "Upper / Lower". */
  folder?: string;
  exercises: RoutineExercise[];
  createdAt: number;
  updatedAt: number;
}

export interface RoutineFolder {
  id: string;
  name: string;
  order: number;
}

/* ------------------------------------------------------------------ */
/* Derived / analytics types                                           */
/* ------------------------------------------------------------------ */

export type PRKind = "heaviest_weight" | "best_1rm" | "best_set_volume";

export interface PersonalRecord {
  kind: PRKind;
  exerciseId: string;
  value: number;
  weightKg: number;
  reps: number;
  sessionId: string;
  setId: string;
  achievedAt: number;
}

export interface SessionSummary {
  totalVolumeKg: number;
  totalSets: number;
  completedSets: number;
  durationSec: number;
  /** Set ids that established a new PR in this session, by kind. */
  prs: PersonalRecord[];
}

export interface ExerciseHistoryPoint {
  sessionId: string;
  date: number;
  bestSetWeightKg: number;
  bestSetReps: number;
  estimated1RM: number;
  volumeKg: number;
}

export interface UserSettings {
  weightUnit: WeightUnit;
  defaultRestSeconds: number;
  /** Play a sound / vibrate when the rest timer hits zero. */
  restTimerAlert: boolean;
  firstDayOfWeek: 0 | 1; // Sunday | Monday
}

export const DEFAULT_SETTINGS: UserSettings = {
  weightUnit: "kg",
  defaultRestSeconds: 90,
  restTimerAlert: true,
  firstDayOfWeek: 1,
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  traps: "Traps",
  lower_back: "Lower Back",
  full_body: "Full Body",
  cardio: "Cardio",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  band: "Band",
  other: "Other",
};

export const SET_TYPE_META: Record<
  SetType,
  { short: string; label: string; colorClass: string }
> = {
  warmup: { short: "W", label: "Warm-up", colorClass: "text-yellow-400" },
  normal: { short: "", label: "Normal", colorClass: "text-zinc-300" },
  dropset: { short: "D", label: "Drop set", colorClass: "text-purple-400" },
  failure: { short: "F", label: "Failure", colorClass: "text-red-400" },
};
