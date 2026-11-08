"use client";

import { useRef, useState } from "react";
import { setGridColumns } from "./setGrid";
import { Trophy } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { PRKind, SetType, WeightUnit, WorkoutSet } from "@/types/workout";
import { NumberField } from "@/components/ui/NumberField";
import { press } from "@/components/ui/Button";
import { SetTypeChip, setTypeA11yName } from "./SetTypeChip";
import { SetTypeMenu } from "./SetTypeMenu";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { useT } from "@/i18n";

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
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped only by the lifter's own tap, so a restored or bulk-completed set does not flash.
  const [sweep, setSweep] = useState(0);
  const repsRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const prevLabel =
    previous && previous.reps !== null
      ? previous.weightKg === null || previous.weightKg <= 0
        ? t("{n} reps", { n: previous.reps })
        : isBodyweight
          ? `+${formatWeight(previous.weightKg, unit, false)} × ${previous.reps}`
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
      setError(t("Enter reps before completing this set"));
      repsRef.current?.focus();
      return;
    }
    setError(null);
    setSweep((n) => n + 1);
    onComplete(true);
  }

  const a11yName = setTypeA11yName(set.type, number, t);

  return (
    <li
      className={`relative grid items-center gap-1 overflow-hidden rounded-xl border px-1 py-1 transition-colors duration-200 ${
        set.completed ? "border-accent/20 bg-accent-tint" : "border-ink/[0.04] bg-row"
      }`}
      style={{ gridTemplateColumns: setGridColumns(showRpe) }}
    >
      {sweep > 0 && (
        <span key={sweep} aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute inset-y-0 left-0 w-full animate-[sweep_650ms_cubic-bezier(0.2,0.7,0.2,1)_forwards] bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
        </span>
      )}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={t("{set}: change type or remove", { set: a11yName })}
        aria-haspopup="dialog"
        className="flex h-11 w-11 items-center justify-center rounded-ctl hover:bg-surface-2"
      >
        <SetTypeChip type={set.type} number={number} completed={set.completed} />
      </button>

      <div className="num min-w-0 text-[11px] leading-tight text-text-muted">
        {prevLabel ? (
          <button
            type="button"
            onClick={fillFromPrevious}
            disabled={set.completed}
            aria-label={t("Previous {value}. Use these values", { value: prevLabel })}
            className="block h-11 w-full truncate rounded-ctl px-0.5 text-left hover:bg-ink/[0.05] hover:text-text disabled:hover:bg-transparent"
          >
            {prevLabel}
          </button>
        ) : (
          <span className="block truncate" aria-label={t("No previous set")}>
            –
          </span>
        )}
        {prKinds.length > 0 && (
          <span className="flex items-center gap-1 text-pr" role="status">
            <Trophy aria-hidden="true" size={12} />
            <span className="sr-only">{t("New record: {kinds}", { kinds: prKinds.map((k) => t(PR_LABEL[k])).join(", ") })}</span>
            <span aria-hidden="true" className="text-[11px] font-bold tracking-wider">
              PR
            </span>
          </span>
        )}
      </div>

      <NumberField
          aria-label={isBodyweight ? t("{set} added weight in {unit}", { set: a11yName, unit }) : t("{set} weight in {unit}", { set: a11yName, unit })}
          placeholder={previous?.weightKg != null ? formatWeight(previous.weightKg, unit, false) : "0"}
          value={set.weightKg === null ? null : toDisplay(set.weightKg, unit)}
          onCommit={(n) => onUpdate({ weightKg: n === null ? null : fromDisplay(n, unit) })}
          disabled={set.completed}
          className={set.completed ? "border-transparent bg-transparent" : ""}
          step={0.5}
          max={2000}
        />

      <NumberField
        ref={repsRef}
        aria-label={t("{set} reps", { set: a11yName })}
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
          aria-label={t("{set} RPE, 6 to 10", { set: a11yName })}
          placeholder="RPE"
          value={set.rpe}
          onCommit={(n) => onUpdate({ rpe: n === null ? null : Math.min(10, Math.max(6, Math.round(n * 2) / 2)) })}
          disabled={set.completed}
          className={`!text-sm ${set.completed ? "border-transparent bg-transparent" : ""}`}
          max={10}
        />
      )}

      <motion.button
        type="button"
        onClick={toggleComplete}
        aria-pressed={set.completed}
        aria-label={set.completed ? t("{set} done. Mark as not done", { set: a11yName }) : t("Mark {set} done", { set: a11yName })}
        {...press}
        className={`relative z-[1] flex size-11 items-center justify-center rounded-xl border transition-colors duration-150 ${
          set.completed
            ? "border-accent bg-accent text-on-accent hover:brightness-110"
            : "border-ink/15 bg-transparent text-text-muted hover:border-ink/30 hover:text-text"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          {/* The tick draws itself once when the set is done; the remount restarts it. */}
          <motion.path
            key={set.completed ? "on" : "off"}
            d="M20 6 9 17l-5-5"
            initial={set.completed && !reduceMotion && sweep > 0 ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />
        </svg>
      </motion.button>

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
