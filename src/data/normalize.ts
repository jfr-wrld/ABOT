import type {
  Equipment,
  Exercise,
  LoadMode,
  LogType,
  Routine,
  RoutineExercise,
  RoutineSet,
  SessionExercise,
  SessionStatus,
  SetType,
  WorkoutSession,
  WorkoutSet,
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

export function normalizeExercise(
  raw: Partial<Exercise> & Pick<Exercise, "id" | "name" | "primaryMuscle" | "equipment">,
): Exercise {
  return {
    ...raw,
    secondaryMuscles: raw.secondaryMuscles ?? [],
    loadMode: raw.loadMode && LOAD_MODES.includes(raw.loadMode) ? raw.loadMode : defaultLoadMode(raw.equipment, raw.name),
    logType: raw.logType && LOG_TYPES.includes(raw.logType) ? raw.logType : defaultLogType(raw.name, raw.isBodyweight),
    isMachineDependent:
      typeof raw.isMachineDependent === "boolean"
        ? raw.isMachineDependent
        : raw.equipment === "machine" || raw.equipment === "cable",
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

/** Custom exercises from storage; returns null for rows missing required fields. */
export function normalizeStoredExercise(raw: unknown): Exercise | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name || !str(raw.primaryMuscle) || !str(raw.equipment)) return null;
  return normalizeExercise(raw as unknown as Exercise);
}
