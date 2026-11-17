"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, X } from "@/components/icons";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { useActionBarSpace } from "@/components/layout/useActionBarSpace";
import { autoSyncFinished } from "@/store/useHealthSyncStore";
import { newSet, useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { isTimed } from "@/lib/set-metrics";
import { fromDisplay, toInput } from "@/lib/units";
import { newId } from "@/lib/id";
import { historyPath } from "@/lib/routes";
import { previousIs } from "@/lib/nav-memory";
import { Sheet } from "@/components/ui/Sheet";
import { SetTypeChip, setTypeA11yName } from "@/components/workout/SetTypeChip";
import type { SessionExercise, SetType } from "@/types/workout";
import { useT } from "@/i18n";
import type { WorkoutSession, WorkoutSet } from "@/types/workout";

/** A tap on a set's number steps through the types. */
const NEXT_TYPE: Record<SetType, SetType> = { normal: "warmup", warmup: "dropset", dropset: "failure", failure: "normal" };

export default function EditSessionPage() {
  return (
    <HydrationGate>
      <SessionEditor />
    </HydrationGate>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateValue = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeValue = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * A workout logged afterwards: an hour that ended now, or that started at `at` (a missed day on
 * Home passes its planned time), until the lifter says when it was.
 */
function blankWorkout(name: string, at: number | null): WorkoutSession {
  const start = at !== null && at <= Date.now() ? at : Date.now() - 60 * 60_000;
  return { id: newId(), name, startedAt: start, finishedAt: start + 60 * 60_000, status: "completed", exercises: [] };
}

/**
 * Corrects a finished workout (a typo in a weight, a forgotten set, the wrong day), or logs one
 * that was never logged. A plain form rather than the live logger: no timer, no rest, nothing
 * that says a workout is running. Saving rewrites the workout; its records follow from the sets.
 */
function SessionEditor() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const atParam = Number(params.get("at"));
  const sessions = useWorkoutStore((s) => s.sessions);
  const saveSession = useWorkoutStore((s) => s.saveSession);
  const unit = useSettingsStore((s) => s.weightUnit);
  const defaultRest = useSettingsStore((s) => s.defaultRestSeconds);
  const { byId } = useAllExercises();
  const original = id ? sessions.find((s) => s.id === id) : undefined;
  const [draft, setDraft] = useState<WorkoutSession | null>(() => (id ? (original ? structuredClone(original) : null) : blankWorkout(t("Workout"), Number.isFinite(atParam) && atParam > 0 ? atParam : null)));
  const [minutes, setMinutes] = useState<number | null>(() => (draft ? Math.max(1, Math.round(((draft.finishedAt ?? draft.startedAt) - draft.startedAt - (draft.pausedMs ?? 0)) / 60_000)) : 60));
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => dateValue(Date.now()));
  // What the page opened with, to tell whether leaving would lose anything.
  const [initial] = useState(() => JSON.stringify({ draft, minutes }));
  const [asking, setAsking] = useState(false);
  const [removed, setRemoved] = useState<{ ex: SessionExercise; at: number; name: string } | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useActionBarSpace(76);
  const inWorkout = useMemo(() => new Set(draft?.exercises.map((e) => e.exerciseId) ?? []), [draft]);

  if (!draft) {
    return (
      <main>
        <PageHeader title={t("Workout not found")} back={{ href: "/", label: t("Home") }} />
        <p className="px-4 pt-4 text-sm text-text-muted">{t("This workout is not on this device. It may have been deleted.")}</p>
      </main>
    );
  }

  const back = id ? { href: historyPath(id), label: t("Workout") } : { href: "/history/all", label: t("All workouts") };
  const dirty = JSON.stringify({ draft, minutes }) !== initial;
  // Back to where the editor was opened from, without a new history entry: Cancel used to push
  // the workout page, so the phone's Back then reopened the editor.
  const leave = () => {
    if (previousIs(back.href.split(/[?#]/)[0]!)) router.back();
    else router.replace(back.href);
  };
  const tryLeave = () => (dirty ? setAsking(true) : leave());
  const patch = (fn: (d: WorkoutSession) => WorkoutSession) => {
    setError(null);
    setDraft((d) => (d ? fn(d) : d));
  };
  const patchSet = (exId: string, setId: string, p: Partial<WorkoutSet>) =>
    patch((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...p } : s)) } : e)) }));

  // Moving the workout moves its sets with it: records and the recovery map date each set by its
  // own completedAt, so a workout moved to Tuesday must not leave its sets on today.
  const setWhen = (date: string, time: string) => {
    const at = new Date(`${date}T${time}`).getTime();
    if (!Number.isFinite(at)) return;
    patch((d) => {
      const by = at - d.startedAt;
      return {
        ...d,
        startedAt: at,
        exercises: d.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => (s.completedAt === undefined ? s : { ...s, completedAt: s.completedAt + by })) })),
      };
    });
  };

  function save() {
    if (!draft) return;
    const dur = Math.round((minutes ?? 0) * 60_000);
    // The message shows in the bar beside Save, where the eye already is.
    const fail = (m: string) => {
      setError(m);
      requestAnimationFrame(() => errorRef.current?.focus());
    };
    if (dur <= 0) return fail(t("Enter how long the workout took"));
    if (draft.startedAt > Date.now()) return fail(t("The start time cannot be in the future"));
    if (!draft.name.trim()) return fail(t("Give the workout a name"));
    // Logged afterwards, "started 30 minutes ago, 90 minutes long" would end in the future.
    const ok = saveSession({ ...draft, name: draft.name.trim(), finishedAt: Math.min(draft.startedAt + dur, Date.now()) });
    if (!ok) return fail(t("Add at least one set with reps or a time"));
    // With Auto-sync on, the health apps get the corrected workout (it replaces the old record).
    const saved = useWorkoutStore.getState().sessions.find((s) => s.id === draft.id);
    if (saved) autoSyncFinished(saved, byId);
    router.replace(historyPath(draft.id));
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={id ? t("Edit workout") : t("Log a past workout")}
        back={back}
        onBack={(e) => {
          if (!dirty) return;
          e.preventDefault();
          setAsking(true);
        }}
      />
      <div className="flex flex-col gap-4 px-4 pt-2">
        <section aria-label={t("When")} className="panel grid grid-cols-2 gap-3 p-3">
          <div className="col-span-2">
            <label htmlFor="ed-name" className="mb-1 block text-sm font-semibold">
              {t("Name")}
            </label>
            <input
              id="ed-name"
              value={draft.name}
              onChange={(e) => patch((d) => ({ ...d, name: e.target.value }))}
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor="ed-date" className="mb-1 block text-sm font-semibold">
              {t("Date")}
            </label>
            <input
              id="ed-date"
              type="date"
              value={dateValue(draft.startedAt)}
              max={today}
              onChange={(e) => e.target.value && setWhen(e.target.value, timeValue(draft.startedAt))}
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor="ed-time" className="mb-1 block text-sm font-semibold">
              {t("Started at")}
            </label>
            <input
              id="ed-time"
              type="time"
              value={timeValue(draft.startedAt)}
              onChange={(e) => e.target.value && setWhen(dateValue(draft.startedAt), e.target.value)}
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="ed-min" className="mb-1 block text-sm font-semibold">
              {t("Duration (minutes)")}
            </label>
            <NumberField id="ed-min" value={minutes} onCommit={setMinutes} min={1} max={600} inputMode="numeric" className="!text-left px-3" />
          </div>
        </section>

        {draft.exercises.map((ex) => {
          const def = byId[ex.exerciseId];
          const logType = def?.logType;
          const timed = isTimed(logType);
          // Like the logger: every lift that is not timed has a weight box, bodyweight ones for the
          // added load or the assistance (weighted pull-ups are reps_only but carry +20 kg).
          const weighted = !timed;
          const bw = !!def?.isBodyweight;
          const sign = bw && ex.assisted ? -1 : 1;
          const name = def?.name ?? t("Removed exercise");
          return (
            <section key={ex.id} aria-label={name} className="panel flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-base font-bold">{name}</h2>
                <button
                  type="button"
                  aria-label={t("Remove {name}", { name })}
                  onClick={() => {
                    setRemoved({ ex, at: draft.exercises.indexOf(ex), name });
                    patch((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== ex.id) }));
                  }}
                  className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:text-failure"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </div>
              {/* Column names, so a filled row still says which number is which. */}
              <div aria-hidden="true" className="field-label flex items-center gap-2">
                <span className="w-11 shrink-0 text-center">{t("Set")}</span>
                {timed ? (
                  <>
                    <span className="flex-1 text-center">{t("min")}</span>
                    {logType === "distance_duration" && <span className="flex-1 text-center">km</span>}
                  </>
                ) : (
                  <>
                    {weighted && <span className="flex-1 text-center">{bw ? `${ex.assisted ? "−" : "+"}${unit}` : unit}</span>}
                    <span className="flex-1 text-center">{t("Reps")}</span>
                  </>
                )}
                <span className="w-11 shrink-0" />
              </div>
              <ol className="flex flex-col gap-1.5">
                {ex.sets.map((st, i) => {
                  const n = i + 1;
                  // Working sets are numbered 1, 2, 3; warm-ups show W, as in the logger.
                  function number(j: number) {
                    return ex.sets.slice(0, j + 1).filter((x) => x.type !== "warmup").length;
                  }
                  return (
                    <li key={st.id} className="flex items-center gap-2">
                      {/* Tap to change the type: warm-ups count apart from the working sets in records. */}
                      <button
                        type="button"
                        aria-label={t("{set}, change type", { set: setTypeA11yName(st.type, number(i), t) })}
                        onClick={() => patchSet(ex.id, st.id, { type: NEXT_TYPE[st.type] })}
                        className="flex size-11 shrink-0 items-center justify-center rounded-ctl"
                      >
                        <SetTypeChip type={st.type} number={number(i)} />
                      </button>
                      {timed ? (
                        <>
                          <NumberField
                            aria-label={t("Set {n} minutes", { n })}
                            placeholder={t("min")}
                            value={st.durationSec ? Math.round((st.durationSec / 60) * 10) / 10 : null}
                            onCommit={(v) => patchSet(ex.id, st.id, { durationSec: v === null ? null : Math.round(v * 60) })}
                          />
                          {logType === "distance_duration" && (
                            <NumberField
                              aria-label={t("Set {n} distance in km", { n })}
                              placeholder="km"
                              value={st.distanceM ? Math.round(st.distanceM / 10) / 100 : null}
                              onCommit={(v) => patchSet(ex.id, st.id, { distanceM: v === null ? null : Math.round(v * 1000) })}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          {weighted && (
                            <NumberField
                              aria-label={
                                bw
                                  ? ex.assisted
                                    ? t("Set {n} assistance in {unit}", { n, unit })
                                    : t("Set {n} added weight in {unit}", { n, unit })
                                  : t("Set {n} weight in {unit}", { n, unit })
                              }
                              placeholder={unit}
                              step={0.5}
                              value={st.weightKg === null ? null : toInput(Math.abs(st.weightKg), unit)}
                              onCommit={(v) => patchSet(ex.id, st.id, { weightKg: v === null ? null : sign * fromDisplay(Math.abs(v), unit) })}
                            />
                          )}
                          <NumberField
                            aria-label={t("Set {n} reps", { n })}
                            placeholder={t("reps")}
                            inputMode="numeric"
                            value={st.reps}
                            onCommit={(v) => patchSet(ex.id, st.id, { reps: v === null ? null : Math.round(v) })}
                          />
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={t("Remove set {n}", { n })}
                        onClick={() => patch((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.filter((s) => s.id !== st.id) } : e)) }))}
                        className="flex size-11 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:text-failure"
                      >
                        <X aria-hidden="true" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                onClick={() =>
                  patch((d) => ({
                    ...d,
                    exercises: d.exercises.map((e) => {
                      if (e.id !== ex.id) return e;
                      // A new set starts as a copy of the one above it: the common case is "one more like that".
                      const last = e.sets[e.sets.length - 1];
                      const copy = last ? { type: last.type, weightKg: last.weightKg, reps: last.reps, durationSec: last.durationSec, distanceM: last.distanceM } : {};
                      return { ...e, sets: [...e.sets, newSet(copy)] };
                    }),
                  }))
                }
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-ctl border border-dashed border-line-strong text-sm font-semibold"
              >
                <Plus aria-hidden="true" size={16} /> {t("Add set")}
              </button>
            </section>
          );
        })}

        <Button onClick={() => setPicker(true)} className="min-h-12 text-base">
          <Plus aria-hidden="true" size={18} /> {t("Add exercise")}
        </Button>
      </div>

      <div className="h-24" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[640px] border-t border-line bg-bg/85 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        {error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="mb-2 text-sm font-semibold text-failure outline-none">
            {error}
          </p>
        )}
        {removed && !error && (
          <div role="status" className="mb-2 flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{t("Removed {name}", { name: removed.name })}</span>
            <button
              type="button"
              onClick={() => {
                const r = removed;
                setRemoved(null);
                patch((d) => {
                  const list = [...d.exercises];
                  list.splice(Math.min(r.at, list.length), 0, r.ex);
                  return { ...d, exercises: list };
                });
              }}
              className="min-h-11 rounded-ctl px-3 font-semibold text-accent-text"
            >
              {t("Undo")}
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={tryLeave} className="min-h-12 text-base">
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={save} className="min-h-12 text-base">
            {t("Save")}
          </Button>
        </div>
      </div>

      <Sheet
        open={asking}
        onClose={() => setAsking(false)}
        title={t("Discard your changes?")}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setAsking(false)}>{t("Keep editing")}</Button>
            <Button variant="danger" onClick={leave}>
              {t("Discard")}
            </Button>
          </div>
        }
      >
        <p className="pb-2 text-sm text-text-muted">{t("The workout stays as it was before you opened it.")}</p>
      </Sheet>

      {picker && (
        <ExercisePicker
          open={picker}
          onClose={() => setPicker(false)}
          inWorkout={inWorkout}
          onPick={(e) => {
            setPicker(false);
            patch((d) => ({ ...d, exercises: [...d.exercises, { id: newId(), exerciseId: e.id, restSeconds: defaultRest, sets: [newSet()] }] }));
          }}
        />
      )}
    </main>
  );
}
