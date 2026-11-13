import { DEFAULT_SETTINGS, type Exercise, type Routine, type WorkoutSession } from "@/types/workout";
import { normalizeRoutine, normalizeSession, normalizeStoredExercise } from "./normalize";
import type { Repository, StoredSettings } from "./repo";

/** Keys written by the first version of the app (zustand persist, shape `{ state, version }`). */
const KEYS = {
  workouts: "heavy.workouts",
  routines: "heavy.routines",
  exercises: "heavy.exercises",
  settings: "heavy.settings",
} as const;

function readState(storage: Pick<Storage, "getItem">, key: string): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const state = (parsed as { state?: unknown }).state;
    return typeof state === "object" && state !== null ? (state as Record<string, unknown>) : null;
  } catch {
    return null; // a corrupt key is skipped; the others still migrate
  }
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const notNull = <T,>(x: T | null): x is T => x !== null;

/**
 * Copies legacy localStorage data into the repository once. localStorage is only read, never
 * written, so it stays as a fallback copy. The flag is set only after every write succeeds.
 */
export async function migrateFromLocalStorage(
  repo: Repository,
  storage: Pick<Storage, "getItem">,
): Promise<{ migrated: boolean; counts: { sessions: number; routines: number; exercises: number } }> {
  const none = { sessions: 0, routines: 0, exercises: 0 };
  if (await repo.kv.get("migratedFromLocalStorage")) return { migrated: false, counts: none };

  const workouts = readState(storage, KEYS.workouts);
  const routinesState = readState(storage, KEYS.routines);
  const exercisesState = readState(storage, KEYS.exercises);
  const settingsState = readState(storage, KEYS.settings);

  if (!workouts && !routinesState && !exercisesState && !settingsState) {
    await repo.kv.set("migratedFromLocalStorage", true);
    return { migrated: false, counts: none };
  }

  const sessions: WorkoutSession[] = list(workouts?.sessions).map(normalizeSession).filter(notNull);
  const routines: Routine[] = list(routinesState?.routines).map(normalizeRoutine).filter(notNull);
  const exercises: Exercise[] = list(exercisesState?.custom).map(normalizeStoredExercise).filter(notNull);
  const active = workouts?.active ? normalizeSession(workouts.active) : null;

  for (const s of sessions) await repo.sessions.put(s);
  for (const r of routines) await repo.routines.put(r);
  for (const e of exercises) await repo.exercises.put(e);
  if (active && !(await repo.kv.get("activeWorkout"))) await repo.kv.set("activeWorkout", { ...active, status: "active" });
  if (settingsState && !(await repo.kv.get("settings"))) {
    const s = settingsState as Partial<StoredSettings>;
    await repo.kv.set("settings", {
      weightUnit: s.weightUnit === "lbs" ? "lbs" : DEFAULT_SETTINGS.weightUnit,
      defaultRestSeconds: typeof s.defaultRestSeconds === "number" ? s.defaultRestSeconds : DEFAULT_SETTINGS.defaultRestSeconds,
      restTimerAlert: typeof s.restTimerAlert === "boolean" ? s.restTimerAlert : DEFAULT_SETTINGS.restTimerAlert,
      firstDayOfWeek: s.firstDayOfWeek === 0 ? 0 : 1,
      activeLocationId: null,
      profileName: DEFAULT_SETTINGS.profileName,
      profileHandle: DEFAULT_SETTINGS.profileHandle,
      language: DEFAULT_SETTINGS.language,
      theme: DEFAULT_SETTINGS.theme,
      visualEffects: DEFAULT_SETTINGS.visualEffects,
      tapFeedback: DEFAULT_SETTINGS.tapFeedback,
      healthAutoSync: DEFAULT_SETTINGS.healthAutoSync,
      lastSleep: DEFAULT_SETTINGS.lastSleep,
      entitlement: DEFAULT_SETTINGS.entitlement,
      bodyPhase: null,
      bodyweightKg: DEFAULT_SETTINGS.bodyweightKg,
      heightCm: DEFAULT_SETTINGS.heightCm,
      profilePhoto: DEFAULT_SETTINGS.profilePhoto,
      profileCover: DEFAULT_SETTINGS.profileCover,
      favoriteExercises: DEFAULT_SETTINGS.favoriteExercises,
      birthYear: null,
      biologicalSex: null,
      myFoods: [],
      trainingPlan: null,
      showRpe: typeof s.showRpe === "boolean" ? s.showRpe : true,
    });
  }
  await repo.kv.set("migratedFromLocalStorage", true);
  return { migrated: true, counts: { sessions: sessions.length, routines: routines.length, exercises: exercises.length } };
}
