"use client";

import { useRef, useState } from "react";
import { setGridColumns } from "./setGrid";
import { Trash2, Trophy } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotionConfig, useTransform } from "framer-motion";
import type { LogType, PRKind, SetType, WeightUnit, WorkoutSet } from "@/types/workout";
import { NumberField } from "@/components/ui/NumberField";
import { TimeField } from "@/components/ui/TimeField";
import { clockText, distanceUnit, fromDistance, hasMeasure, isTimed, setText, toDistance } from "@/lib/set-metrics";
import { press } from "@/components/ui/Button";
import { SetTypeChip, setTypeA11yName } from "./SetTypeChip";
import { SetTypeMenu } from "./SetTypeMenu";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { useT } from "@/i18n";
import { feedback } from "@/lib/feedback";
import { stepped } from "@/lib/set-steps";

const PR_LABEL: Record<PRKind, string> = {
  heaviest_weight: "heaviest weight",
  best_1rm: "best estimated 1RM",
  best_set_volume: "best set volume",
};

/** Share of the row's width a pull must pass to remove the set on release. */
const REMOVE_AT = 0.4;

export function SetRow({
  set,
  number,
  previous,
  unit,
  showRpe,
  isBodyweight,
  assisted = false,
  logType = "weight_reps",
  prKinds,
  onUpdate,
  onSetType,
  onRemove,
  onComplete,
  weightStep,
}: {
  /**
   * Given on the set waiting to be done: tap buttons under the fields move the weight by this
   * much (in the lifter's unit) and the reps by one, so the keyboard never has to open.
   */
  weightStep?: number;
  set: WorkoutSet;
  number: number | null;
  previous: WorkoutSet | undefined;
  unit: WeightUnit;
  showRpe: boolean;
  isBodyweight: boolean;
  /** Bodyweight exercises: the weight column is assistance, stored as a negative load. */
  assisted?: boolean;
  /** Weight and reps, reps only, a time, or a distance and time (src/lib/set-metrics). */
  logType?: LogType;
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
  const reduceMotion = useReducedMotionConfig();
  const x = useMotionValue(0);
  const removeOpacity = useTransform(x, [-48, 0], [1, 0]);
  const armed = useRef(false);
  const rowWidth = useRef<HTMLDivElement>(null);

  const timed = isTimed(logType);
  // Bodyweight: "BW × 10", "BW+10 × 8", "BW−20 × 10" (assisted). Timed: "1:30", "5 km · 28:10".
  const prevLabel = timed
    ? previous && (previous.durationSec || previous.distanceM)
      ? setText(previous, logType, unit, { reps: (n) => t("{n} reps", { n }) })
      : null
    : previous && previous.reps !== null
      ? isBodyweight
        ? `BW${!previous.weightKg ? "" : previous.weightKg > 0 ? `+${formatWeight(previous.weightKg, unit, false)}` : `−${formatWeight(-previous.weightKg, unit, false)}`} × ${previous.reps}`
        : previous.weightKg === null || previous.weightKg <= 0
          ? t("{n} reps", { n: previous.reps })
          : `${formatWeight(previous.weightKg, unit, false)} × ${previous.reps}`
      : null;
  // The field shows the amount; the sign comes from the exercise's Added / Assisted choice.
  const sign = isBodyweight && assisted ? -1 : 1;
  const shown = (kg: number) => toDisplay(Math.abs(kg), unit);

  function fillFromPrevious() {
    if (!previous) return;
    if (timed) {
      onUpdate({
        durationSec: set.durationSec ?? previous.durationSec ?? null,
        distanceM: set.distanceM ?? previous.distanceM ?? null,
        rpe: set.rpe ?? previous.rpe,
      });
      return;
    }
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
    if (timed) {
      // Nothing typed: last time's values count, as with reps.
      let { durationSec, distanceM } = set;
      if (!hasMeasure(set, logType) && previous && hasMeasure(previous, logType)) {
        durationSec = previous.durationSec ?? null;
        distanceM = previous.distanceM ?? null;
        onUpdate({ durationSec, distanceM });
      }
      if (!hasMeasure({ reps: null, durationSec, distanceM }, logType)) {
        setError(logType === "duration" ? t("Enter a time before completing this set") : t("Enter a distance or time before completing this set"));
        repsRef.current?.focus();
        return;
      }
      setError(null);
      setSweep((n) => n + 1);
      feedback.setComplete();
      onComplete(true);
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
    feedback.setComplete();
    onComplete(true);
  }

  const a11yName = setTypeA11yName(set.type, number, t);

  return (
    // One pull removes the set: the row follows the finger left; once it is past 40% of the
    // way the phone ticks, and letting go removes it (a quick flick does too). Less springs
    // back. The set-type menu still offers Remove for anyone not swiping.
    <li className="relative overflow-hidden rounded-xl">
      {/* Shown only as the row moves left; at rest it is fully transparent. Inset a pixel so the
          rounded corners never show a red edge. */}
      <motion.span
        aria-hidden="true"
        style={{ opacity: removeOpacity }}
        className="pointer-events-none absolute inset-px flex items-center justify-end rounded-xl bg-failure pr-5 text-white"
      >
        {/* The bin alone: a word would be cut while the strip is still narrow. */}
        <Trash2 size={20} />
      </motion.span>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -2000, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        style={{
          x,
          gridTemplateColumns: setGridColumns(showRpe, logType),
          touchAction: "pan-y",
          // The row's tint is see-through, so it is laid over the card's own colour: the red
          // behind it never shows through.
          backgroundColor: "var(--color-surface)",
          backgroundImage: `linear-gradient(${set.completed ? "var(--color-accent-tint)" : "var(--color-row)"}, ${set.completed ? "var(--color-accent-tint)" : "var(--color-row)"})`,
        }}
        onDrag={() => {
          const past = x.get() < -(rowWidth.current?.offsetWidth ?? 320) * REMOVE_AT;
          if (past !== armed.current) {
            armed.current = past;
            if (past) feedback.tick();
          }
        }}
        onDragEnd={(_, info) => {
          const width = rowWidth.current?.offsetWidth ?? 320;
          armed.current = false;
          if (x.get() < -width * REMOVE_AT || info.velocity.x < -700) {
            void animate(x, -width, { duration: 0.16, ease: "easeIn" }).then(onRemove);
          } else {
            void animate(x, 0, { type: "spring", stiffness: 500, damping: 38 });
          }
        }}
        ref={rowWidth}
        className={`relative grid items-center gap-1 overflow-hidden rounded-xl border px-1 py-1 transition-colors duration-200 ${
          set.completed ? "border-accent/20" : "border-ink/[0.04]"
        }`}
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

      {logType === "distance_duration" && (
        <NumberField
          ref={repsRef}
          aria-label={t("{set} distance in {unit}", { set: a11yName, unit: distanceUnit(unit) })}
          aria-invalid={error ? true : undefined}
          placeholder={previous?.distanceM ? String(toDistance(previous.distanceM, unit)) : "0"}
          value={set.distanceM == null ? null : toDistance(set.distanceM, unit)}
          onCommit={(n) => {
            setError(null);
            onUpdate({ distanceM: n === null ? null : fromDistance(n, unit) });
          }}
          disabled={set.completed}
          className={set.completed ? "border-transparent bg-transparent" : ""}
          max={1000}
        />
      )}

      {timed && (
        <TimeField
          ref={logType === "duration" ? repsRef : undefined}
          aria-label={
            logType === "duration"
              ? t("{set} time, minutes and seconds", { set: a11yName })
              : t("{set} time, minutes", { set: a11yName })
          }
          aria-invalid={error ? true : undefined}
          plain={logType === "duration" ? "sec" : "min"}
          placeholder={previous?.durationSec ? clockText(previous.durationSec) : logType === "duration" ? "0:30" : "20:00"}
          value={set.durationSec ?? null}
          onCommit={(sec) => {
            setError(null);
            onUpdate({ durationSec: sec });
          }}
          disabled={set.completed}
          className={set.completed ? "border-transparent bg-transparent" : ""}
        />
      )}

      {!timed && (<>
      <NumberField
          aria-label={
            isBodyweight
              ? assisted
                ? t("{set} assistance in {unit}", { set: a11yName, unit })
                : t("{set} added weight in {unit}", { set: a11yName, unit })
              : t("{set} weight in {unit}", { set: a11yName, unit })
          }
          placeholder={previous?.weightKg != null ? String(shown(previous.weightKg)) : "0"}
          value={set.weightKg === null ? null : shown(set.weightKg)}
          onCommit={(n) => onUpdate({ weightKg: n === null ? null : sign * fromDisplay(Math.abs(n), unit) })}
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
      </>)}

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
      </motion.div>

      {weightStep !== undefined && !timed && !set.completed && (
        // Above the swipe backing, which spans the whole row: taps here must reach the buttons.
        <div className="relative z-[1] flex items-center justify-between gap-2 bg-surface px-1 pb-1 pt-1.5">
          {logType === "weight_reps" ? (
            <div role="group" aria-label={t("Weight steppers, {set}", { set: a11yName })} className="flex items-center gap-1">
              <StepButton
                label={t("{n} {unit} less on {set}", { set: a11yName, n: weightStep, unit })}
                onClick={() => {
                  const cur = set.weightKg !== null ? shown(set.weightKg) : previous?.weightKg != null ? shown(previous.weightKg) : 0;
                  onUpdate({ weightKg: sign * fromDisplay(stepped(cur, -weightStep), unit) });
                }}
              >
                −{weightStep}
              </StepButton>
              <span aria-hidden="true" className="label-caps w-8 text-center normal-case">{unit}</span>
              <StepButton
                label={t("{n} {unit} more on {set}", { set: a11yName, n: weightStep, unit })}
                onClick={() => {
                  const cur = set.weightKg !== null ? shown(set.weightKg) : previous?.weightKg != null ? shown(previous.weightKg) : 0;
                  onUpdate({ weightKg: sign * fromDisplay(stepped(cur, weightStep), unit) });
                }}
              >
                +{weightStep}
              </StepButton>
            </div>
          ) : (
            <span />
          )}
          <div role="group" aria-label={t("Reps steppers, {set}", { set: a11yName })} className="flex items-center gap-1">
            <StepButton
              label={t("One rep fewer on {set}", { set: a11yName })}
              onClick={() => {
                setError(null);
                onUpdate({ reps: stepped(set.reps ?? previous?.reps ?? 0, -1) });
              }}
            >
              −1
            </StepButton>
            <span aria-hidden="true" className="label-caps w-10 text-center">{t("Reps")}</span>
            <StepButton
              label={t("One rep more on {set}", { set: a11yName })}
              onClick={() => {
                setError(null);
                onUpdate({ reps: stepped(set.reps ?? previous?.reps ?? 0, 1) });
              }}
            >
              +1
            </StepButton>
          </div>
        </div>
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

/** One tap on the set stepper: a light tick and a short press-in. */
function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        feedback.tick();
        onClick();
      }}
      className="min-h-[40px] min-w-[52px] rounded-ctl border border-line-strong bg-surface-2 px-2 font-mono text-sm font-bold tabular-nums text-text transition-transform duration-100 hover:bg-press active:scale-95 motion-reduce:active:scale-100"
    >
      {children}
    </button>
  );
}
