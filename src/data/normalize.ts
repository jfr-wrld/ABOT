import {
  EQUIPMENT_LABELS,
  MUSCLE_GROUP_LABELS,
  type Equipment,
  type Exercise,
  type ExerciseCategory,
  type ExerciseMedia,
  type MuscleGroup,
  type LoadMode,
  type LogType,
  type Routine,
  type RoutineExercise,
  type RoutineSet,
  type SessionExercise,
  type SessionStatus,
  type SetType,
  type WorkoutSession,
  type WorkoutSet,
} from "@/types/workout";

/**
 * Normalizers turn anything read from storage or a backup file into valid domain objects.
 * Old rows (from before a field existed) get defaults; malformed rows are dropped, not thrown.
 */

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

const SET_TYPES: SetType[] = ["warmup", "normal", "dropset", "failure"];
const STATUSES: SessionStatus[] = ["active", "completed", "discarded"];
const LOAD_MODES: LoadMode[] = ["total", "per_hand", "unilateral"];
const LOG_TYPES: LogType[] = ["weight_reps", "reps_only", "duration", "distance_duration"];

export function defaultLoadMode(equipment: Equipment, name: string): LoadMode {
  if (/one arm|single arm|bulgarian|split squat|single leg/i.test(name)) return "unilateral";
  if (equipment === "dumbbell" || equipment === "kettlebell") {
    // Swings and goblet work hold one bell with both hands: that is the whole load.
    if (/swing|goblet/i.test(name)) return "total";
    return "per_hand";
  }
  return "total";
}

function defaultLogType(name: string, isBodyweight: boolean | undefined): LogType {
  if (/plank|hold|hang\b/i.test(name)) return "duration";
  return isBodyweight ? "reps_only" : "weight_reps";
}

const CATEGORIES: ExerciseCategory[] = ["compound", "isolation", "cardio", "mobility"];

/** Input accepted by normalizeExercise: v2 fields, or the v1 single `primaryMuscle`. */
export type ExerciseInput = Partial<Omit<Exercise, "primaryMuscles">> &
  Pick<Exercise, "id" | "name" | "equipment"> &
  ({ primaryMuscles: MuscleGroup[] } | { primaryMuscle: MuscleGroup });

export function normalizeExercise(raw: ExerciseInput): Exercise {
  const { primaryMuscle, ...rest } = raw as ExerciseInput & { primaryMuscle?: MuscleGroup };
  const primaryMuscles = "primaryMuscles" in raw && raw.primaryMuscles ? raw.primaryMuscles : primaryMuscle ? [primaryMuscle] : [];
  const secondaryMuscles = raw.secondaryMuscles ?? [];
  return {
    ...rest,
    primaryMuscles,
    secondaryMuscles,
    category:
      raw.category && CATEGORIES.includes(raw.category) ? raw.category : secondaryMuscles.length > 0 ? "compound" : "isolation",
    loadMode: raw.loadMode && LOAD_MODES.includes(raw.loadMode) ? raw.loadMode : defaultLoadMode(raw.equipment, raw.name),
    logType: raw.logType && LOG_TYPES.includes(raw.logType) ? raw.logType : defaultLogType(raw.name, raw.isBodyweight),
    isMachineDependent:
      typeof raw.isMachineDependent === "boolean"
        ? raw.isMachineDependent
        : raw.equipment === "machine" || raw.equipment === "cable" || raw.equipment === "smith_machine",
    instructions: raw.instructions ?? [],
    formCues: raw.formCues ?? [],
    media: raw.media ?? {},
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const numOrNull = (v: unknown): number | null | undefined => (v === null ? null : num(v));

function normalizeSet(raw: unknown): WorkoutSet | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const reps = numOrNull(raw.reps);
  const weightKg = numOrNull(raw.weightKg);
  if (!id || reps === undefined || weightKg === undefined) return null;
  return {
    id,
    type: SET_TYPES.includes(raw.type as SetType) ? (raw.type as SetType) : "normal",
    weightKg,
    reps,
    rpe: numOrNull(raw.rpe) ?? null,
    completed: raw.completed === true,
    completedAt: num(raw.completedAt),
    durationSec: numOrNull(raw.durationSec) ?? undefined,
    distanceM: numOrNull(raw.distanceM) ?? undefined,
  };
}

function normalizeSessionExercise(raw: unknown): SessionExercise | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const exerciseId = str(raw.exerciseId);
  if (!id || !exerciseId) return null;
  const sets = Array.isArray(raw.sets) ? raw.sets.map(normalizeSet).filter((x): x is WorkoutSet => x !== null) : [];
  return {
    id,
    exerciseId,
    sets,
    restSeconds: num(raw.restSeconds) ?? 90,
    notes: str(raw.notes),
    supersetId: str(raw.supersetId),
  };
}

export function normalizeSession(raw: unknown): WorkoutSession | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const startedAt = num(raw.startedAt);
  if (!id || startedAt === undefined) return null;
  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map(normalizeSessionExercise).filter((x): x is SessionExercise => x !== null)
    : [];
  return {
    id,
    name: str(raw.name) ?? "Workout",
    routineId: str(raw.routineId),
    locationId: str(raw.locationId),
    startedAt,
    finishedAt: num(raw.finishedAt),
    status: STATUSES.includes(raw.status as SessionStatus) ? (raw.status as SessionStatus) : "completed",
    exercises,
    notes: str(raw.notes),
  };
}

function normalizeRoutineSet(raw: unknown): RoutineSet | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    type: SET_TYPES.includes(raw.type as SetType) ? (raw.type as SetType) : "normal",
    targetWeightKg: numOrNull(raw.targetWeightKg) ?? null,
    targetReps: numOrNull(raw.targetReps) ?? null,
  };
}

export function normalizeRoutine(raw: unknown): Routine | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const exercises: RoutineExercise[] = Array.isArray(raw.exercises)
    ? raw.exercises.flatMap((e) => {
        if (!isObj(e) || !str(e.id) || !str(e.exerciseId)) return [];
        return [
          {
            id: e.id as string,
            exerciseId: e.exerciseId as string,
            restSeconds: num(e.restSeconds) ?? 90,
            notes: str(e.notes),
            supersetId: str(e.supersetId),
            sets: Array.isArray(e.sets) ? e.sets.map(normalizeRoutineSet).filter((x): x is RoutineSet => x !== null) : [],
          },
        ];
      })
    : [];
  return {
    id,
    name,
    folder: str(raw.folder),
    exercises,
    createdAt: num(raw.createdAt) ?? 0,
    updatedAt: num(raw.updatedAt) ?? 0,
  };
}

const isMuscle = (v: unknown): v is MuscleGroup => typeof v === "string" && v in MUSCLE_GROUP_LABELS;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : []);
const muscles = (v: unknown): MuscleGroup[] => (Array.isArray(v) ? v.filter(isMuscle) : []);

function normalizeMedia(v: unknown): ExerciseMedia {
  if (!isObj(v)) return {};
  const m: ExerciseMedia = {};
  const motion = strings(v.motionUrls);
  if (motion.length) m.motionUrls = motion;
  for (const k of ["youtubeId", "tiktokUrl", "customVideoUrl"] as const) {
    const val = str(v[k]);
    if (val) m[k] = val;
  }
  for (const k of ["youtubeStart", "youtubeEnd"] as const) {
    const val = num(v[k]);
    if (val !== undefined && val >= 0) m[k] = val;
  }
  return m;
}

/**
 * Custom exercises from storage or a backup file. Every field is checked: unknown muscles are
 * dropped, wrong types fall back to defaults, and rows without a usable primary muscle or a
 * known equipment are rejected. The result is always marked custom.
 */
export function normalizeStoredExercise(raw: unknown): Exercise | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  const equipment = raw.equipment;
  if (!id || !name || typeof equipment !== "string" || !(equipment in EQUIPMENT_LABELS)) return null;
  const primaryMuscles = muscles(raw.primaryMuscles);
  if (primaryMuscles.length === 0 && isMuscle(raw.primaryMuscle)) primaryMuscles.push(raw.primaryMuscle);
  if (primaryMuscles.length === 0) return null;
  return normalizeExercise({
    id,
    name,
    equipment: equipment as Equipment,
    primaryMuscles,
    secondaryMuscles: muscles(raw.secondaryMuscles),
    isBodyweight: raw.isBodyweight === true,
    loadMode: raw.loadMode as LoadMode | undefined,
    logType: raw.logType as LogType | undefined,
    category: raw.category as ExerciseCategory | undefined,
    isMachineDependent: typeof raw.isMachineDependent === "boolean" ? raw.isMachineDependent : undefined,
    instructions: strings(raw.instructions),
    formCues: strings(raw.formCues),
    media: normalizeMedia(raw.media),
    sourceId: str(raw.sourceId),
    notes: str(raw.notes),
    // Catalog exercises the user has logged are stored with the owned ones but stay "catalog".
    ...(raw.isCatalog === true ? { isCatalog: true } : { isCustom: true }),
  });
}
