import { create } from "zustand";
import type { Exercise, WeightUnit, WorkoutSession } from "@/types/workout";
import { previousSets, sessionVolume } from "@/lib/calc";
import { supersetNext, type SupersetHandoff } from "@/lib/superset";
import { formatVolume, formatWeight } from "@/lib/units";
import { currentT, type T } from "@/i18n";
import type { NativeLive } from "@/lib/notifications/live-workout";

/**
 * The Android app's live workout notification: what it shows and what its buttons do. Android
 * draws it and ticks its clock (LiveWorkoutPlugin, held by WorkoutLiveService), so the status bar
 * chip keeps counting while ABOT is frozen; this file decides the text and handles the taps.
 */

/** "full": the workout clock between rests too. "rest": only while a rest counts down. */
export type CapsuleMode = "full" | "rest";
/** The second line: the next set's weight and reps, or the workout's volume so far. */
export type CapsuleDetail = "set" | "volume";

interface CapsulePrefs {
  mode: CapsuleMode;
  detail: CapsuleDetail;
  set(patch: Partial<Pick<CapsulePrefs, "mode" | "detail">>): void;
}

/** Per device, like the on/off switch: a display choice, not training data. */
const KEY = "abot.liveCapsule";

function load(): Pick<CapsulePrefs, "mode" | "detail"> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<CapsulePrefs>;
    return { mode: v.mode === "rest" ? "rest" : "full", detail: v.detail === "volume" ? "volume" : "set" };
  } catch {
    return { mode: "full", detail: "set" };
  }
}

export const useCapsulePrefs = create<CapsulePrefs>((set, get) => ({
  ...(typeof window === "undefined" ? { mode: "full" as const, detail: "set" as const } : load()),
  set(patch) {
    set(patch);
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode: get().mode, detail: get().detail }));
    } catch {
      // Without storage the choice lasts until the app closes.
    }
  },
}));

export interface CapsuleTarget {
  sessionExerciseId: string;
  /** The catalog exercise, for its photo. */
  exerciseId: string;
  setId: string;
  name: string;
  /** 1-based, warm-ups included, as on the card. */
  set: number;
  of: number;
  /** From the set, else from the same set last time; null when neither has it. */
  weightKg: number | null;
  reps: number | null;
  /** The rest after this set: 0 mid-superset, where the next exercise follows at once. */
  restSec: number;
}

/**
 * The set the lifter does next, with the weight and reps it will be logged with. Mid-superset
 * that is the handoff (A1 done, A2 next, no rest); otherwise the first unticked set in order.
 */
export function nextTarget(
  session: WorkoutSession,
  sessions: WorkoutSession[],
  byId: Record<string, Exercise>,
  t: T = currentT(),
  handoff: SupersetHandoff | null = null,
): CapsuleTarget | null {
  const handed = handoff && session.exercises.find((e) => e.id === handoff.sessionExerciseId);
  if (handed && handed.sets[handoff.setIndex]?.completed === false) return target(session, sessions, byId, t, handed, handoff.setIndex);
  for (const ex of session.exercises) {
    const i = ex.sets.findIndex((s) => !s.completed);
    if (i >= 0) return target(session, sessions, byId, t, ex, i);
  }
  return null;
}

function target(session: WorkoutSession, sessions: WorkoutSession[], byId: Record<string, Exercise>, t: T, ex: WorkoutSession["exercises"][number], i: number): CapsuleTarget {
  const st = ex.sets[i]!;
  const before = st.reps === null ? previousSets(ex.exerciseId, sessions, session.id, { byId, locationId: session.locationId })?.[i] : undefined;
  const ticked = session.exercises.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, completed: true } : s)) } : e));
  return {
    sessionExerciseId: ex.id,
    exerciseId: ex.exerciseId,
    setId: st.id,
    name: byId[ex.exerciseId]?.name ?? t("Exercise"),
    set: i + 1,
    of: ex.sets.length,
    weightKg: st.reps === null ? (before?.weightKg ?? st.weightKg) : st.weightKg,
    reps: st.reps ?? before?.reps ?? null,
    restSec: supersetNext(ticked, ex.id) ? 0 : ex.restSeconds,
  };
}

/** "Bench Press (Barbell)" → "Bench Press": the pill is narrow, and the photo shows the tool. */
export function shortName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
}

const loggable = (x: CapsuleTarget | null): x is CapsuleTarget => !!x && x.reps !== null && x.reps > 0;

export interface CapsuleInput {
  session: WorkoutSession;
  sessions: WorkoutSession[];
  byId: Record<string, Exercise>;
  rest: { endsAt: number } | null;
  now: number;
  unit: WeightUnit;
  mode: CapsuleMode;
  detail: CapsuleDetail;
  /** Rest alert. */
  ring: boolean;
  /** Mid-superset: the exercise that follows with no rest. */
  handoff?: SupersetHandoff | null;
}

/** Everything the notification shows, for each state it can switch to on its own. */
export function capsuleContent({ session, sessions, byId, rest, now, unit, mode, detail, ring, handoff = null }: CapsuleInput, t: T = currentT()): NativeLive {
  const next = nextTarget(session, sessions, byId, t, handoff);
  const lift = next ? t("{name} · {set}/{of}", { name: shortName(next.name), set: next.set, of: next.of }) : null;
  const load = next && next.reps !== null ? (next.weightKg !== null && next.weightKg > 0 ? `${formatWeight(next.weightKg, unit)} × ${next.reps}` : t("{n} reps", { n: next.reps })) : null;
  const second =
    detail === "volume"
      ? t("Volume {volume}", { volume: formatVolume(sessionVolume(session, byId), unit) })
      : (load ?? session.name);
  const clockStart = session.startedAt + (session.pausedMs ?? 0);
  const counted = session.exercises.filter((e) => e.sets.length > 0);
  const base: NativeLive = {
    title: lift ?? t("All sets done"),
    text: next ? second : `${session.name} · ${t("tap to finish")}`,
    clockStart,
    pausedTitle: lift ? `${t("Paused")} · ${lift}` : t("Paused"),
    pausedChip: t("Paused"),
    ring,
    restOnly: mode === "rest",
    canLog: loggable(next) && session.pausedAt === undefined,
    logRestSec: next?.restSec ?? 0,
    loggedTitle: t("Set logged"),
    loggedText: t("Open ABOT for the next set."),
    addLabel: t("+30s"),
    skipLabel: t("Skip rest"),
    logLabel: t("Log set"),
    pauseLabel: t("Pause"),
    resumeLabel: t("Resume"),
    progressSegments: counted.map((e) => e.sets.length),
    progressDone: counted.reduce((n, e) => n + e.sets.filter((st) => st.completed).length, 0),
    photoKey: next?.exerciseId,
  };
  if (session.pausedAt !== undefined) return { ...base, pausedElapsed: Math.max(0, session.pausedAt - clockStart) };
  if (!rest || rest.endsAt <= now) return base;
  return {
    ...base,
    restEndsAt: rest.endsAt,
    restTitle: lift ? t("Rest · next {lift}", { lift }) : t("Resting"),
    restText: second,
    overTitle: lift ? `${t("Rest over")} · ${lift}` : t("Rest over"),
    overText: base.text,
  };
}

interface WorkoutActions {
  active: WorkoutSession | null;
  sessions: WorkoutSession[];
  restTimer: { endsAt: number } | null;
  handoff?: SupersetHandoff | null;
  pauseActive(): void;
  resumeActive(): void;
  skipRest(): void;
  adjustRest(deltaSec: number): void;
  updateSet(sessionExerciseId: string, setId: string, patch: { reps?: number | null; weightKg?: number | null }): void;
  completeSet(sessionExerciseId: string, setId: string, completed: boolean): void;
}

/**
 * A notification button, applied to the workout as if tapped in the app. The store saves to
 * IndexedDB on change, so a set logged from the notification is kept like any other.
 */
export function applyCapsuleAction(id: string, w: WorkoutActions, byId: Record<string, Exercise>): void {
  if (!w.active) return;
  switch (id) {
    case "open":
      // Handled by the caller, which can navigate.
      return;
    case "pause":
      return w.pauseActive();
    case "resume":
      return w.resumeActive();
    case "skip":
      return w.skipRest();
    case "add30":
      if (w.restTimer) w.adjustRest(30);
      return;
    case "log": {
      const next = nextTarget(w.active, w.sessions, byId, currentT(), w.handoff ?? null);
      if (!loggable(next)) return;
      const st = w.active.exercises.find((e) => e.id === next.sessionExerciseId)?.sets.find((s) => s.id === next.setId);
      if (st && st.reps === null) w.updateSet(next.sessionExerciseId, next.setId, { reps: next.reps, weightKg: next.weightKg });
      w.completeSet(next.sessionExerciseId, next.setId, true);
      return;
    }
  }
}

const photoCache = new Map<string, Promise<string | undefined>>();

/**
 * A notification's large icon shows at about 64 dp, so 128 px is plenty. Smaller base64 means
 * less to store and decode on every notification update. Falls back to the original image.
 */
async function iconSized(blob: Blob): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return blob;
    const bmp = await createImageBitmap(blob, { resizeWidth: 128, resizeQuality: "medium" });
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0);
    bmp.close();
    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  } catch {
    return blob;
  }
}

/**
 * An exercise's photo as base64 for the notification's large icon: the bundled thumbnail
 * (offline), else the free-exercise-db frame while online, scaled to icon size. Read once per
 * exercise.
 */
export function capsulePhoto(id: string, url: string | undefined): Promise<string | undefined> {
  if (!url) return Promise.resolve(undefined);
  let p = photoCache.get(id);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(iconSized)
      .then(
        (blob) =>
          new Promise<string | undefined>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] || undefined);
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => {
        photoCache.delete(id);
        return undefined;
      });
    photoCache.set(id, p);
  }
  return p;
}
