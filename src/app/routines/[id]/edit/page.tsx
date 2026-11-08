"use client";

import { setNumbers } from "@/lib/sets";
import { Select } from "@/components/ui/Select";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { newRoutineExercise, newRoutineSet, useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { SetTypeChip, setTypeA11yName } from "@/components/workout/SetTypeChip";
import { SetTypeMenu } from "@/components/workout/SetTypeMenu";
import { formatClock } from "@/lib/calc";
import { fromDisplay, toDisplay } from "@/lib/units";
import type { RoutineExercise, RoutineSet } from "@/types/workout";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export default function EditRoutinePage() {
  return (
    <HydrationGate>
      <Editor />
    </HydrationGate>
  );
}

function Editor() {
  const { id } = useParams<{ id: string }>();
  const routine = useRoutineStore((s) => s.routines.find((r) => r.id === id));
  const { update, setExercises } = useRoutineStore();
  const { weightUnit, defaultRestSeconds } = useSettingsStore();
  const { byId } = useAllExercises();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menu, setMenu] = useState<{ exId: string; setId: string } | null>(null);

  if (!routine) {
    return (
      <main className="px-4 pt-4">
        <PageHeader title="Routine not found" back={{ href: "/workout", label: "Workout" }} />
        <p className="mt-4 text-sm text-text-muted">
          This routine does not exist on this device. It may have been deleted.
        </p>
      </main>
    );
  }

  const patchExercise = (exId: string, fn: (e: RoutineExercise) => RoutineExercise | null) =>
    setExercises(
      routine.id,
      routine.exercises.flatMap((e) => (e.id === exId ? (fn(e) ? [fn(e)!] : []) : [e])),
    );
  const patchSet = (exId: string, setId: string, patch: Partial<RoutineSet>) =>
    patchExercise(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
  const move = (exId: string, dir: -1 | 1) => {
    const i = routine.exercises.findIndex((e) => e.id === exId);
    const j = i + dir;
    if (j < 0 || j >= routine.exercises.length) return;
    const next = [...routine.exercises];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setExercises(routine.id, next);
  };

  const menuSet = menu
    ? routine.exercises.find((e) => e.id === menu.exId)?.sets.find((s) => s.id === menu.setId)
    : undefined;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Edit routine" back={{ href: "/workout", label: "Workout" }} />

      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="r-name" className="mb-1 block text-sm font-semibold">
              Name
            </label>
            <input
              id="r-name"
              value={routine.name}
              onChange={(e) => update(routine.id, { name: e.target.value })}
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor="r-folder" className="mb-1 block text-sm font-semibold">
              Folder <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="r-folder"
              value={routine.folder ?? ""}
              onChange={(e) => update(routine.id, { folder: e.target.value })}
              placeholder="Push / Pull / Legs"
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted/70"
            />
          </div>
        </div>

        {routine.exercises.length === 0 && (
          <p className="panel px-4 py-6 text-center text-sm text-text-muted">
            No exercises in this routine yet. Add the first one below; each starts with three planned sets.
          </p>
        )}

        {routine.exercises.map((ex, i) => {
          const def = byId[ex.exerciseId];
          const nums = setNumbers(ex.sets);
          return (
            <section key={ex.id} aria-labelledby={`rex-${ex.id}`} className="panel p-3">
              <div className="flex items-start justify-between gap-2">
                <h2 id={`rex-${ex.id}`} className="min-w-0 truncate text-base font-semibold text-accent">
                  {def?.name ?? "Removed exercise"}
                </h2>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={() => move(ex.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${def?.name ?? "exercise"} up`}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(ex.id, 1)}
                    disabled={i === routine.exercises.length - 1}
                    aria-label={`Move ${def?.name ?? "exercise"} down`}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => patchExercise(ex.id, () => null)}
                    aria-label={`Remove ${def?.name ?? "exercise"} from routine`}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-failure/10 hover:text-failure"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                <label htmlFor={`rest-${ex.id}`}>Rest</label>
                <Select
                  id={`rest-${ex.id}`}
                  value={ex.restSeconds}
                  onChange={(restSeconds) => patchExercise(ex.id, (x) => ({ ...x, restSeconds }))}
                  options={REST_OPTIONS.map((s) => ({ value: s, label: s === 0 ? "Off" : formatClock(s) }))}
                />
              </div>

              <div
                className="mt-3 grid gap-1.5 px-1 label-caps"
                style={{ gridTemplateColumns: "44px minmax(0,1fr) 72px 64px" }}
                aria-hidden="true"
              >
                <span className="text-center">Set</span>
                <span />
                <span className="text-center">{def?.isBodyweight ? "" : weightUnit}</span>
                <span className="text-center">Reps</span>
              </div>
              <ol className="mt-1 flex flex-col gap-1" aria-label={`Planned sets for ${def?.name ?? "exercise"}`}>
                {ex.sets.map((s, i) => {
                  const num = nums[i] ?? null;
                  const name = setTypeA11yName(s.type, num);
                  return (
                    <li
                      key={s.id}
                      className="grid items-center gap-1.5 px-1"
                      style={{ gridTemplateColumns: "44px minmax(0,1fr) 72px 64px" }}
                    >
                      <button
                        type="button"
                        onClick={() => setMenu({ exId: ex.id, setId: s.id })}
                        aria-label={`${name}: change type or remove`}
                        aria-haspopup="dialog"
                        className="flex h-11 w-11 items-center justify-center rounded-ctl hover:bg-surface-2"
                      >
                        <SetTypeChip type={s.type} number={num} />
                      </button>
                      <span className="text-xs text-text-muted">target</span>
                      {def?.isBodyweight ? (
                        <span className="text-center text-xs text-text-muted">BW</span>
                      ) : (
                        <NumberField
                          aria-label={`${name} target weight in ${weightUnit}`}
                          placeholder="0"
                          value={s.targetWeightKg === null ? null : toDisplay(s.targetWeightKg, weightUnit)}
                          onCommit={(v) =>
                            patchSet(ex.id, s.id, { targetWeightKg: v === null ? null : fromDisplay(v, weightUnit) })
                          }
                          max={2000}
                        />
                      )}
                      <NumberField
                        aria-label={`${name} target reps`}
                        placeholder="0"
                        value={s.targetReps}
                        onCommit={(v) => patchSet(ex.id, s.id, { targetReps: v === null ? null : Math.round(v) })}
                        max={999}
                      />
                    </li>
                  );
                })}
              </ol>
              <Button
                variant="ghost"
                onClick={() =>
                  patchExercise(ex.id, (x) => {
                    const last = x.sets[x.sets.length - 1];
                    return {
                      ...x,
                      sets: [
                        ...x.sets,
                        newRoutineSet({ targetWeightKg: last?.targetWeightKg ?? null, targetReps: last?.targetReps ?? null }),
                      ],
                    };
                  })
                }
                className="mt-2 w-full"
              >
                <Plus aria-hidden="true" size={18} /> Add set
              </Button>
            </section>
          );
        })}

        <Button onClick={() => setPickerOpen(true)} className="w-full">
          <Plus aria-hidden="true" size={18} /> Add exercise
        </Button>

        <p className="text-center text-xs text-text-muted">
          Changes save as you type.{" "}
          <Link href="/workout" className="text-accent underline-offset-2 hover:underline">
            Back to routines
          </Link>
        </p>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        inWorkout={new Set(routine.exercises.map((e) => e.exerciseId))}
        onPick={(e) => {
          setExercises(routine.id, [...routine.exercises, newRoutineExercise(e.id, defaultRestSeconds)]);
          setPickerOpen(false);
        }}
      />

      <SetTypeMenu
        open={menu !== null && menuSet !== undefined}
        current={menuSet?.type ?? "normal"}
        onSelect={(t) => menu && patchSet(menu.exId, menu.setId, { type: t })}
        onRemove={() =>
          menu && patchExercise(menu.exId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== menu.setId) }))
        }
        onClose={() => setMenu(null)}
      />
    </main>
  );
}
