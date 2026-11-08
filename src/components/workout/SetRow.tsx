"use client";

import { useRef, useState } from "react";
import { Check, Trophy } from "lucide-react";
import type { PRKind, SetType, WeightUnit, WorkoutSet } from "@/types/workout";
import { NumberField } from "@/components/ui/NumberField";
import { SetTypeChip, setTypeA11yName } from "./SetTypeChip";
import { SetTypeMenu } from "./SetTypeMenu";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";

const PR_LABEL: Record<PRKind, string> = {
  heaviest_weight: "heaviest weight",
  best_1rm: "best estimated 1RM",
  best_set_volume: "best set volume",
};

export function SetRow({
  set,
  number,
  previous,
  unit,
  showRpe,
  isBodyweight,
  prKinds,
  onUpdate,
  onSetType,
  onRemove,
  onComplete,
}: {
  set: WorkoutSet;
  number: number | null;
  previous: WorkoutSet | undefined;
  unit: WeightUnit;
  showRpe: boolean;
  isBodyweight: boolean;
  prKinds: PRKind[];
  onUpdate: (patch: Partial<WorkoutSet>) => void;
  onSetType: (t: SetType) => void;
  onRemove: () => void;
  onComplete: (completed: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const repsRef = useRef<HTMLInputElement>(null);

  const prevLabel =
    previous && previous.reps !== null
      ? isBodyweight || previous.weightKg === null
        ? `${previous.reps} reps`
        : `${formatWeight(previous.weightKg, unit, false)} × ${previous.reps}`
      : null;

  function fillFromPrevious() {
    if (!previous) return;
    onUpdate({
      weightKg: set.weightKg ?? previous.weightKg,
      reps: set.reps ?? previous.reps,
      rpe: set.rpe ?? previous.rpe,
    });
  }

  function toggleComplete() {
    if (set.completed) {
      onComplete(false);
      return;
    }
    let reps = set.reps;
    let weightKg = set.weightKg;
    if (reps === null && previous?.reps != null) {
      reps = previous.reps;
      weightKg = weightKg ?? previous.weightKg;
      onUpdate({ reps, weightKg });
    }
    if (reps === null || reps <= 0) {
      setError("Enter reps before completing this set");
      repsRef.current?.focus();
      return;
    }
    setError(null);
    onComplete(true);
  }

  const a11yName = setTypeA11yName(set.type, number);

  return (
    <li
      className={`grid items-center gap-1.5 rounded-ctl px-1 py-1 transition-colors ${
        set.completed ? "bg-accent-tint" : ""
      }`}
      style={{ gridTemplateColumns: `44px minmax(0,1fr) 60px 52px ${showRpe ? "48px " : ""}44px` }}
    >
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={`${a11yName}: change type or remove`}
        aria-haspopup="dialog"
        className="flex h-11 w-11 items-center justify-center rounded-ctl hover:bg-surface-2"
      >
        <SetTypeChip type={set.type} number={number} completed={set.completed} />
      </button>

      <div className="min-w-0 text-[13px] leading-tight text-text-muted">
        {prevLabel ? (
          <button
            type="button"
            onClick={fillFromPrevious}
            disabled={set.completed}
            aria-label={`Previous ${prevLabel}. Use these values`}
            className="block h-11 w-full truncate rounded-ctl text-left hover:bg-surface-2 hover:text-text disabled:hover:bg-transparent"
          >
            {prevLabel}
          </button>
        ) : (
          <span className="block truncate" aria-label="No previous set">
            –
          </span>
        )}
        {prKinds.length > 0 && (
          <span className="flex items-center gap-1 text-accent" role="status">
            <Trophy aria-hidden="true" size={12} />
            <span className="sr-only">New record: {prKinds.map((k) => PR_LABEL[k]).join(", ")}</span>
            <span aria-hidden="true" className="text-[11px] font-semibold">
              PR
            </span>
          </span>
        )}
      </div>

      {isBodyweight ? (
        <span className="text-center text-xs text-text-muted" aria-label="Bodyweight">
          BW
        </span>
      ) : (
        <NumberField
          aria-label={`${a11yName} weight in ${unit}`}
          placeholder={previous?.weightKg != null ? formatWeight(previous.weightKg, unit, false) : "0"}
          value={set.weightKg === null ? null : toDisplay(set.weightKg, unit)}
          onCommit={(n) => onUpdate({ weightKg: n === null ? null : fromDisplay(n, unit) })}
          disabled={set.completed}
          className={set.completed ? "border-transparent bg-transparent" : ""}
          step={0.5}
          max={2000}
        />
      )}

      <NumberField
        ref={repsRef}
        aria-label={`${a11yName} reps`}
        aria-invalid={error ? true : undefined}
        placeholder={previous?.reps != null ? String(previous.reps) : "0"}
        value={set.reps}
        onCommit={(n) => {
          setError(null);
          onUpdate({ reps: n === null ? null : Math.round(n) });
        }}
        disabled={set.completed}
        className={set.completed ? "border-transparent bg-transparent" : ""}
        max={999}
      />

      {showRpe && (
        <NumberField
          aria-label={`${a11yName} RPE, 6 to 10`}
          placeholder="RPE"
          value={set.rpe}
          onCommit={(n) => onUpdate({ rpe: n === null ? null : Math.min(10, Math.max(6, Math.round(n * 2) / 2)) })}
          disabled={set.completed}
          className={`text-sm ${set.completed ? "border-transparent bg-transparent" : ""}`}
          max={10}
        />
      )}

      <button
        type="button"
        onClick={toggleComplete}
        aria-pressed={set.completed}
        aria-label={set.completed ? `${a11yName} done. Mark as not done` : `Mark ${a11yName} done`}
        className={`flex size-11 items-center justify-center rounded-ctl transition-colors ${
          set.completed
            ? "bg-accent-solid text-white hover:bg-[#1d4ed8]"
            : "border border-line-strong bg-surface-2 text-text-muted hover:border-text-muted hover:text-text active:bg-[#303035]"
        }`}
      >
        <Check aria-hidden="true" size={20} strokeWidth={2.5} />
      </button>

      {error && (
        <p role="alert" className="col-span-full px-1 pb-1 text-xs text-failure">
          {error}
        </p>
      )}

      <SetTypeMenu
        open={menuOpen}
        current={set.type}
        onSelect={onSetType}
        onRemove={onRemove}
        onClose={() => setMenuOpen(false)}
      />
    </li>
  );
}
