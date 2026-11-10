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

import { DEFAULT_ENTITLEMENT, type EntitlementState } from "@/lib/entitlements";
import type { ActivePhaseConfig } from "@/lib/phase-engine";

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
  | "lats"
  | "lower_back"
  | "adductors"
  | "abductors"
  | "neck"
  | "full_body"
  | "cardio";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "smith_machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "other";

/**
 * How the typed weight maps to volume:
 * total      the number is the whole load (barbell, machine, cable)
 * per_hand   the number is one dumbbell; volume counts both hands (x2)
 * unilateral one side at a time; the number and reps are per side, volume counts both sides (x2)
 */
export type LoadMode = "total" | "per_hand" | "unilateral";

/** Which inputs a set row shows. */
export type LogType = "weight_reps" | "reps_only" | "duration" | "distance_duration";

/** W = warm-up (yellow), N = normal (default), D = drop set (purple), F = failure (red). */
export type SetType = "warmup" | "normal" | "dropset" | "failure";

export type ExerciseCategory = "compound" | "isolation" | "cardio" | "mobility";

export interface ExerciseMedia {
  /** Image frames (start, end) or a looping .mp4/.webm/.gif. */
  motionUrls?: string[];
  youtubeId?: string;
  youtubeStart?: number;
  youtubeEnd?: number;
  tiktokUrl?: string;
  /** Pasted by the user: YouTube, Shorts, TikTok or a direct video file. */
  customVideoUrl?: string;
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  /** Bodyweight movements: the weight input is optional added load (weighted pull-up). */
  isBodyweight?: boolean;
  loadMode: LoadMode;
  logType: LogType;
  /** Machine and cable loads differ between gyms, so records are kept per location. */
  isMachineDependent: boolean;
  instructions: string[];
  formCues: string[];
  media: ExerciseMedia;
  /** free-exercise-db id when the exercise came from that dataset. */
  sourceId?: string;
  /** Set when the user created it, so we can let them edit/delete it. */
  isCustom?: boolean;
  /** Downloaded from the full catalog on demand. */
  isCatalog?: boolean;
  notes?: string;
}

/** What a create/edit form supplies; derived fields are filled by normalizeExercise. */
export type ExerciseDraft = Pick<Exercise, "name" | "primaryMuscles" | "secondaryMuscles" | "equipment" | "isBodyweight"> &
  Partial<Pick<Exercise, "loadMode" | "logType" | "isMachineDependent" | "category" | "instructions" | "formCues" | "media">>;

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
  durationSec?: number | null;
  distanceM?: number | null;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  /** Rest timer length (seconds) applied after each completed set. */
  restSeconds: number;
  notes?: string;
  supersetId?: string;
}

export type SessionStatus = "active" | "completed" | "discarded";

export interface WorkoutSession {
  id: string;
  name: string;
  /** Routine this session was started from, if any. */
  routineId?: string;
  /** Gym the workout was done at; drives per-location records for machine exercises. */
  locationId?: string;
  startedAt: number;
  finishedAt?: number;
  /** Set while the workout is paused; the clock stops until it is resumed. */
  pausedAt?: number;
  /** Total time spent paused so far, left out of the duration. */
  pausedMs?: number;
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
  supersetId?: string;
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

export interface GymLocation {
  id: string;
  name: string;
  barWeightKg: number;
  /** Plate sizes available, heaviest first. */
  plateInventoryKg: number[];
  isDefault: boolean;
  /** Where the gym is, if pinned in Settings: lets ABOT pick it when a workout starts there. */
  lat?: number;
  lng?: number;
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
  activeLocationId: string | null;
  /** Profile, all optional: "" / null mean not filled in. Bodyweight in kg like every weight. */
  profileName: string;
  /** Social handle without the "@", shown on shared story cards; "" when not set. */
  profileHandle: string;
  /** Current bodyweight: the latest log entry, or a value typed before the log existed. */
  bodyweightKg: number | null;
  heightCm: number | null;
  /** Square JPEG data URL (256px), made on the device from a picked photo. */
  profilePhoto: string | null;
  /** "auto" follows the phone: Indonesian when its language is Indonesian, else English. */
  language: AppLanguage;
  /** "system" follows the phone's light or dark mode. */
  theme: AppTheme;
  /** Glass and motion: "auto" picks light effects on modest phones (lib/effects). */
  visualEffects: VisualEffects;
  /** Tick, latch and PR sounds with matching vibration on taps (Phase 2 tactile feedback). */
  tapFeedback: boolean;
  /** Send each finished workout to Health Connect (Android app). */
  healthAutoSync: boolean;
  /** Last night's sleep from Health Connect; scales the recovery map. */
  lastSleep: { minutes: number; endAt: number } | null;
  /** ABOT // BLACK PRO tier, founder pass and the monetization simulator (lib/entitlements). */
  entitlement: EntitlementState;
  /** Cut, lean bulk, recomp or strength peak, with its targets (lib/phase-engine); null for none. */
  bodyPhase: ActivePhaseConfig | null;
}

export type AppLanguage = "auto" | "en" | "id";
export type AppTheme = "system" | "dark" | "light";
export type VisualEffects = "auto" | "full" | "lite";

/** One weigh-in per local calendar day; `id` is that day as "YYYY-MM-DD". */
export interface BodyweightEntry {
  id: string;
  date: number;
  weightKg: number;
  /** Optional measurements taken with the weigh-in. */
  bodyFatPercent?: number;
  waistCm?: number;
}

export const PROFILE_LIMITS = {
  nameMax: 40,
  handleMax: 30,
  bodyweightKg: [20, 400],
  heightCm: [100, 250],
  /** Characters in the photo data URL; a 256px JPEG is about 20-40k. */
  photoMax: 300_000,
} as const;

export const DEFAULT_SETTINGS: UserSettings = {
  weightUnit: "kg",
  defaultRestSeconds: 90,
  restTimerAlert: true,
  firstDayOfWeek: 1,
  activeLocationId: null,
  profileName: "",
  profileHandle: "",
  language: "auto",
  theme: "system",
  visualEffects: "auto",
  tapFeedback: true,
  healthAutoSync: false,
  lastSleep: null,
  entitlement: DEFAULT_ENTITLEMENT,
  bodyPhase: null,
  bodyweightKg: null,
  heightCm: null,
  profilePhoto: null,
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
  lats: "Lats",
  adductors: "Adductors",
  abductors: "Abductors",
  neck: "Neck",
  lower_back: "Lower Back",
  full_body: "Full Body",
  cardio: "Cardio",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  smith_machine: "Smith Machine",
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

/** "Chest" or "Back / Glutes": the primary muscles as one display string. */
export function primaryMusclesLabel(e: Pick<Exercise, "primaryMuscles">): string {
  return e.primaryMuscles.map((m) => MUSCLE_GROUP_LABELS[m]).join(" / ");
}
