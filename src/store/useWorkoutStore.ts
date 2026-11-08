import { create } from "zustand";
import type {
  Routine,
  SessionExercise,
  SetType,
  WorkoutSession,
  WorkoutSet,
} from "@/types/workout";
import { newId } from "@/lib/id";
import { useLocationStore } from "./useLocationStore";

export interface RestTimer {
  /** Epoch ms when the countdown reaches zero. Persisted so a refresh keeps the clock. */
  endsAt: number;
  totalSec: number;
  sessionExerciseId: string;
}

interface WorkoutState {
  sessions: WorkoutSession[];
  active: WorkoutSession | null;
  restTimer: RestTimer | null;

  startEmpty: (defaultRest: number) => void;
  startFromRoutine: (routine: Routine) => void;
  renameActive: (name: string) => void;
  /** Which gym this workout is at; undefined when no gym is set. */
  setLocation: (locationId: string | undefined) => void;
  addExercise: (exerciseId: string, restSeconds: number) => void;
  removeExercise: (sessionExerciseId: string) => void;
  moveExercise: (sessionExerciseId: string, dir: -1 | 1) => void;
  /** Puts the exercises in this order (ids from the current workout; unknown or missing ids are ignored). */
  reorderExercises: (sessionExerciseIds: string[]) => void;
  /** Swaps the movement of one exercise, keeping its sets as typed (for picking the wrong variant). */
  replaceExercise: (sessionExerciseId: string, exerciseId: string) => void;
  /** Stops the workout clock and the rest timer; ticking a set or resume starts it again. */
  pauseActive: () => void;
  resumeActive: () => void;
  /** Puts two exercises in one superset (joining the one either is already in). */
  linkSuperset: (sessionExerciseId: string, withSessionExerciseId: string) => void;
  /** Takes an exercise out of its superset; a superset left with one exercise dissolves. */
  unlinkSuperset: (sessionExerciseId: string) => void;
  setExerciseRest: (sessionExerciseId: string, restSeconds: number) => void;
  setExerciseNotes: (sessionExerciseId: string, notes: string) => void;
  addSet: (sessionExerciseId: string) => void;
  removeSet: (sessionExerciseId: string, setId: string) => void;
  updateSet: (sessionExerciseId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  setSetType: (sessionExerciseId: string, setId: string, type: SetType) => void;
  /** Marks complete and starts the rest timer; or un-completes and clears the timer for that set. */
  completeSet: (sessionExerciseId: string, setId: string, completed: boolean) => void;

  /** Ticks every unticked set that has reps; returns how many. Does not start the rest timer. */
  completeAllRemaining: () => number;
  /** Moves the workout start earlier, e.g. when the timer was started late or left running. */
  setStartedAt: (ts: number) => { ok: true } | { ok: false; reason: string };

  adjustRest: (deltaSec: number) => void;
  skipRest: () => void;

  finishActive: () => WorkoutSession | null;
  discardActive: () => void;
  deleteSession: (id: string) => void;
}

export function newSet(partial: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: newId(), type: "normal", weightKg: null, reps: null, rpe: null, completed: false, ...partial };
}

function patchActive(
  s: WorkoutState,
  fn: (active: WorkoutSession) => WorkoutSession,
): Partial<WorkoutState> {
  if (!s.active) return {};
  return { active: fn(s.active) };
}

function patchExercise(
  active: WorkoutSession,
  sessionExerciseId: string,
  fn: (ex: SessionExercise) => SessionExercise,
): WorkoutSession {
  return {
    ...active,
    exercises: active.exercises.map((ex) => (ex.id === sessionExerciseId ? fn(ex) : ex)),
  };
}

export const useWorkoutStore = create<WorkoutState>()(
    (set, get) => ({
      sessions: [],
      active: null,
      restTimer: null,

      startEmpty: () => {
        if (get().active) return;
        set({
          active: {
            id: newId(),
            name: defaultWorkoutName(),
            locationId: defaultLocationId(),
            startedAt: Date.now(),
            status: "active",
            exercises: [],
          },
          restTimer: null,
        });
      },

      startFromRoutine: (routine) => {
        if (get().active) return;
        set({
          active: {
            id: newId(),
            name: routine.name,
            routineId: routine.id,
            locationId: defaultLocationId(),
            startedAt: Date.now(),
            status: "active",
            exercises: routine.exercises.map((re) => ({
              id: newId(),
              exerciseId: re.exerciseId,
              restSeconds: re.restSeconds,
              notes: re.notes,
              ...(re.supersetId ? { supersetId: re.supersetId } : {}),
              sets: re.sets.map((rs) =>
                newSet({ type: rs.type, weightKg: rs.targetWeightKg, reps: rs.targetReps }),
              ),
            })),
          },
          restTimer: null,
        });
      },

      renameActive: (name) => set((s) => patchActive(s, (a) => ({ ...a, name }))),

      setLocation: (locationId) => set((s) => patchActive(s, (a) => ({ ...a, locationId }))),

      addExercise: (exerciseId, restSeconds) =>
        set((s) =>
          patchActive(s, (a) => ({
            ...a,
            exercises: [
              ...a.exercises,
              { id: newId(), exerciseId, restSeconds, sets: [newSet(), newSet(), newSet()] },
            ],
          })),
        ),

      removeExercise: (id) =>
        set((s) => ({
          ...patchActive(s, (a) => ({ ...a, exercises: a.exercises.filter((e) => e.id !== id) })),
          restTimer: s.restTimer?.sessionExerciseId === id ? null : s.restTimer,
        })),

      moveExercise: (id, dir) =>
        set((s) =>
          patchActive(s, (a) => {
            const i = a.exercises.findIndex((e) => e.id === id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= a.exercises.length) return a;
            const next = [...a.exercises];
            [next[i], next[j]] = [next[j]!, next[i]!];
            return { ...a, exercises: next };
          }),
        ),

      reorderExercises: (ids) =>
        set((s) =>
          patchActive(s, (a) => {
            const byId = new Map(a.exercises.map((e) => [e.id, e]));
            const ordered = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
            // Only a full permutation of the current exercises is applied.
            if (ordered.length !== a.exercises.length || new Set(ids).size !== ids.length) return a;
            return { ...a, exercises: ordered };
          }),
        ),

      replaceExercise: (id, exerciseId) =>
        set((s) => ({
          ...patchActive(s, (a) => ({
            ...a,
            exercises: a.exercises.map((e) => (e.id === id ? { ...e, exerciseId } : e)),
          })),
        })),

      pauseActive: () =>
        set((s) => {
          if (!s.active || s.active.pausedAt !== undefined) return {};
          return { active: { ...s.active, pausedAt: Date.now() }, restTimer: null };
        }),

      linkSuperset: (id, withId) =>
        set((s) =>
          patchActive(s, (a) => {
            const x = a.exercises.find((e) => e.id === id);
            const y = a.exercises.find((e) => e.id === withId);
            if (!x || !y || x === y) return a;
            const group = y.supersetId ?? x.supersetId ?? newId();
            const old = new Set([x.supersetId, y.supersetId].filter(Boolean));
            return {
              ...a,
              // Merging: everything in either superset ends up in one.
              exercises: a.exercises.map((e) =>
                e.id === id || e.id === withId || (e.supersetId && old.has(e.supersetId)) ? { ...e, supersetId: group } : e,
              ),
            };
          }),
        ),

      unlinkSuperset: (id) =>
        set((s) =>
          patchActive(s, (a) => {
            const group = a.exercises.find((e) => e.id === id)?.supersetId;
            if (!group) return a;
            const remaining = a.exercises.filter((e) => e.supersetId === group && e.id !== id).length;
            return {
              ...a,
              exercises: a.exercises.map((e) =>
                e.id === id || (remaining < 2 && e.supersetId === group) ? { ...e, supersetId: undefined } : e,
              ),
            };
          }),
        ),

      resumeActive: () => set((s) => (s.active ? { active: resumed(s.active, Date.now()) } : {})),

      setExerciseRest: (id, restSeconds) =>
        set((s) => patchActive(s, (a) => patchExercise(a, id, (ex) => ({ ...ex, restSeconds })))),

      setExerciseNotes: (id, notes) =>
        set((s) => patchActive(s, (a) => patchExercise(a, id, (ex) => ({ ...ex, notes })))),

      addSet: (id) =>
        set((s) =>
          patchActive(s, (a) =>
            patchExercise(a, id, (ex) => {
              const last = ex.sets[ex.sets.length - 1];
              // Carry weight/reps forward: the next set is usually the same load.
              return {
                ...ex,
                sets: [
                  ...ex.sets,
                  newSet({
                    weightKg: last?.weightKg ?? null,
                    reps: last?.reps ?? null,
                    type: last?.type === "warmup" ? "normal" : "normal",
                  }),
                ],
              };
            }),
          ),
        ),

      removeSet: (id, setId) =>
        set((s) =>
          patchActive(s, (a) =>
            patchExercise(a, id, (ex) => ({ ...ex, sets: ex.sets.filter((st) => st.id !== setId) })),
          ),
        ),

      updateSet: (id, setId, patch) =>
        set((s) =>
          patchActive(s, (a) =>
            patchExercise(a, id, (ex) => ({
              ...ex,
              sets: ex.sets.map((st) => (st.id === setId ? { ...st, ...patch } : st)),
            })),
          ),
        ),

      setSetType: (id, setId, type) => get().updateSet(id, setId, { type }),

      completeSet: (id, setId, completed) =>
        set((s) => {
          if (!s.active) return {};
          const ex = s.active.exercises.find((e) => e.id === id);
          if (!ex) return {};
          // Ticking a set means training again: a paused workout resumes.
          const active = patchExercise(completed ? resumed(s.active, Date.now()) : s.active, id, (e) => ({
            ...e,
            sets: e.sets.map((st) =>
              st.id === setId
                ? { ...st, completed, completedAt: completed ? Date.now() : undefined }
                : st,
            ),
          }));
          // In a superset the lifter moves straight to the next exercise; rest comes after the last.
          const idx = s.active.exercises.findIndex((e) => e.id === id);
          const moreInSuperset =
            ex.supersetId !== undefined && s.active.exercises.slice(idx + 1).some((e) => e.supersetId === ex.supersetId);
          const restTimer: RestTimer | null = completed
            ? moreInSuperset
              ? null
              : ex.restSeconds > 0
              ? { endsAt: Date.now() + ex.restSeconds * 1000, totalSec: ex.restSeconds, sessionExerciseId: id }
              : null
            : s.restTimer?.sessionExerciseId === id
              ? null
              : s.restTimer;
          return { active, restTimer };
        }),

      completeAllRemaining: () => {
        const a = get().active;
        if (!a) return 0;
        const now = Date.now();
        let n = 0;
        const exercises = a.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((st) => {
            if (st.completed || st.reps === null || st.reps <= 0) return st;
            n++;
            return { ...st, completed: true, completedAt: now };
          }),
        }));
        if (n > 0) set({ active: { ...a, exercises } });
        return n;
      },

      setStartedAt: (ts) => {
        const a = get().active;
        if (!a) return { ok: false, reason: "No workout in progress" };
        if (ts > Date.now()) return { ok: false, reason: "The start time cannot be in the future" };
        const firstDone = Math.min(
          ...a.exercises.flatMap((ex) => ex.sets.map((st) => st.completedAt ?? Infinity)),
        );
        if (ts > firstDone) {
          return { ok: false, reason: "The start time must be before your first completed set" };
        }
        set({ active: { ...a, startedAt: ts } });
        return { ok: true };
      },

      adjustRest: (deltaSec) =>
        set((s) => {
          if (!s.restTimer) return {};
          const endsAt = Math.max(Date.now(), s.restTimer.endsAt + deltaSec * 1000);
          const totalSec = Math.max(1, s.restTimer.totalSec + deltaSec);
          return { restTimer: { ...s.restTimer, endsAt, totalSec } };
        }),

      skipRest: () => set({ restTimer: null }),

      finishActive: () => {
        const a = get().active;
        if (!a) return null;
        const now = Date.now();
        const done: WorkoutSession = {
          ...resumed(a, now),
          status: "completed",
          finishedAt: now,
          // Drop sets the lifter never ticked; they were plans, not work.
          exercises: a.exercises
            .map((ex) => ({ ...ex, sets: ex.sets.filter((st) => st.completed) }))
            .filter((ex) => ex.sets.length > 0),
        };
        set((s) => ({ sessions: [...s.sessions, done], active: null, restTimer: null }));
        return done;
      },

      discardActive: () => set({ active: null, restTimer: null }),

      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
    }),
);

/** Closes a running pause, adding its length to pausedMs. */
function resumed(a: WorkoutSession, now: number): WorkoutSession {
  if (a.pausedAt === undefined) return a;
  const { pausedAt, ...rest } = a;
  return { ...rest, pausedMs: (a.pausedMs ?? 0) + Math.max(0, now - pausedAt) };
}

function defaultLocationId(): string | undefined {
  return useLocationStore.getState().locations.find((l) => l.isDefault)?.id;
}

function defaultWorkoutName(): string {
  const h = new Date().getHours();
  if (h < 11) return "Morning Workout";
  if (h < 17) return "Afternoon Workout";
  return "Evening Workout";
}
