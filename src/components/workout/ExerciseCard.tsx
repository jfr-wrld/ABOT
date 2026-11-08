"use client";

import { useState } from "react";
import { setGridColumns } from "./setGrid";
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Timer, Trash2 } from "lucide-react";
import type {
  Exercise,
  PRKind,
  SessionExercise,
  WeightUnit,
  WorkoutSet,
} from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { SetRow } from "./SetRow";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/calc";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export function ExerciseCard({
  item,
  exercise,
  previous,
  unit,
  showRpe,
  prBySet,
  canMoveUp,
  canMoveDown,
}: {
  item: SessionExercise;
  exercise: Exercise | undefined;
  previous: WorkoutSet[] | null;
  unit: WeightUnit;
  showRpe: boolean;
  prBySet: Record<string, PRKind[]>;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const store = useWorkoutStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  let working = 0;
  const numbers = item.sets.map((s) => (s.type === "warmup" ? null : ++working));

  const name = exercise?.name ?? "Unknown exercise";
  const subtitle = exercise
    ? `${MUSCLE_GROUP_LABELS[exercise.primaryMuscle]} · ${EQUIPMENT_LABELS[exercise.equipment]}`
    : "This exercise was removed from the library";

  return (
    <section aria-labelledby={`ex-${item.id}`} className="rounded-card bg-surface px-2 py-3">
      <header className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 id={`ex-${item.id}`} className="truncate text-base font-semibold text-accent">
            {name}
          </h2>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={`Options for ${name}`}
          aria-haspopup="dialog"
          className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <MoreHorizontal aria-hidden="true" size={20} />
        </button>
      </header>

      <div className="mt-2 flex items-center gap-1 px-1 text-xs text-text-muted">
        <Timer aria-hidden="true" size={14} />
        <span>Rest {item.restSeconds === 0 ? "off" : formatClock(item.restSeconds)}</span>
      </div>

      <div
        className="mt-3 grid gap-1 px-1 text-[11px] font-semibold uppercase text-text-muted"
        style={{ gridTemplateColumns: setGridColumns(showRpe) }}
        aria-hidden="true"
      >
        <span className="text-center">Set</span>
        <span className="truncate">Prev</span>
        <span className="text-center">{exercise?.isBodyweight ? "" : unit}</span>
        <span className="text-center">Reps</span>
        {showRpe && <span className="text-center">RPE</span>}
        <span className="text-center">Done</span>
      </div>

      <ol className="mt-1 flex flex-col gap-1" aria-label={`Sets for ${name}`}>
        {item.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            number={numbers[i] ?? null}
            previous={previous?.[i]}
            unit={unit}
            showRpe={showRpe}
            isBodyweight={exercise?.isBodyweight ?? false}
            prKinds={prBySet[set.id] ?? []}
            onUpdate={(patch) => store.updateSet(item.id, set.id, patch)}
            onSetType={(t) => store.setSetType(item.id, set.id, t)}
            onRemove={() => store.removeSet(item.id, set.id)}
            onComplete={(c) => store.completeSet(item.id, set.id, c)}
          />
        ))}
      </ol>

      <Button variant="ghost" onClick={() => store.addSet(item.id)} className="mt-2 w-full">
        <Plus aria-hidden="true" size={18} />
        Add set
      </Button>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={name}>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor={`rest-${item.id}`} className="mb-1 block text-sm font-semibold">
              Rest timer after each set
            </label>
            <select
              id={`rest-${item.id}`}
              value={item.restSeconds}
              onChange={(e) => store.setExerciseRest(item.id, Number(e.target.value))}
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
            >
              {REST_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? "Off" : formatClock(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`notes-${item.id}`} className="mb-1 block text-sm font-semibold">
              Notes for this exercise
            </label>
            <textarea
              id={`notes-${item.id}`}
              value={item.notes ?? ""}
              onChange={(e) => store.setExerciseNotes(item.id, e.target.value)}
              rows={2}
              placeholder="Seat height, grip, cues"
              className="w-full rounded-ctl border border-line-strong bg-surface-2 px-3 py-2 text-base placeholder:text-text-muted/70"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={!canMoveUp}
              onClick={() => {
                store.moveExercise(item.id, -1);
                setMenuOpen(false);
              }}
            >
              <ArrowUp aria-hidden="true" size={18} /> Move up
            </Button>
            <Button
              disabled={!canMoveDown}
              onClick={() => {
                store.moveExercise(item.id, 1);
                setMenuOpen(false);
              }}
            >
              <ArrowDown aria-hidden="true" size={18} /> Move down
            </Button>
          </div>

          {confirmRemove ? (
            <div className="rounded-ctl border border-failure/60 p-3">
              <p className="text-sm">Remove {name} and its {item.sets.length} sets from this workout?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => setConfirmRemove(false)}>Keep it</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    store.removeExercise(item.id);
                    setMenuOpen(false);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmRemove(true)}>
              <Trash2 aria-hidden="true" size={18} /> Remove exercise
            </Button>
          )}
        </div>
      </Sheet>
    </section>
  );
}
