"use client";

import { useMemo } from "react";
import { AlertTriangle, RotateCcw, Scissors, Shield, TrendingUp, Zap } from "@/components/icons";
import type { Exercise, SessionExercise, WeightUnit } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { KIND_LABEL, suggestOverload, type OverloadKind } from "@/lib/progressive-overload";
import { muscleFatigue } from "@/lib/muscle-recovery";
import { formatWeight } from "@/lib/units";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { useEntitlements } from "@/store/useEntitlements";
import { ProBadge } from "@/components/paywall/ProBadge";

/**
 * Each call's colour, in theme tokens so it reads on chalk and on iron: good news (more load,
 * more reps, a return) in the accent, a pause in the muted text, a step back (deload, one set
 * fewer) in the warm-up amber.
 */
const LOOK: Record<OverloadKind, { color: string; Icon: typeof Zap; label: string }> = {
  load: { color: "var(--color-accent-text)", Icon: Zap, label: KIND_LABEL.load },
  reps: { color: "var(--color-accent-text)", Icon: TrendingUp, label: KIND_LABEL.reps },
  deload: { color: "var(--color-warmup)", Icon: AlertTriangle, label: KIND_LABEL.deload },
  hold: { color: "var(--color-text-muted)", Icon: Shield, label: KIND_LABEL.hold },
  trim: { color: "var(--color-warmup)", Icon: Scissors, label: KIND_LABEL.trim },
  comeback: { color: "var(--color-accent-text)", Icon: RotateCcw, label: KIND_LABEL.comeback },
};

/** Exercises in this workout that already got the lean-bulk extra set (one per exercise). */
const extras = new Set<string>();
const extraAdded = (sessionExerciseId: string) => extras.has(sessionExerciseId);
const markExtraAdded = (sessionExerciseId: string) => extras.add(sessionExerciseId);

/**
 * The Coach Pill under an exercise's name: next target from the last three sessions
 * (lib/progressive-overload). Apply writes it into every set still to do. Hidden when there is
 * no call to make, or when the sets left already hold the target.
 */
export function OverloadBanner({ item, exercise, unit }: { item: SessionExercise; exercise: Exercise | undefined; unit: WeightUnit }) {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const { byId } = useAllExercises();
  const { canAccessPro, openPaywall } = useEntitlements();
  const startedAt = active?.startedAt;
  const s = useMemo(() => {
    // Lean bulk adds a set only when every muscle the lift trains is fully recovered.
    const fatigue = exercise ? muscleFatigue(sessions, byId, startedAt ?? 0) : {};
    const fresh = !!exercise && exercise.primaryMuscles.every((m) => (fatigue[m] ?? 0) < 1);
    return suggestOverload(exercise, sessions, { unit, excludeSessionId: active?.id, variant: { byId, locationId: active?.locationId }, fresh, now: startedAt });
  }, [exercise, sessions, unit, active?.id, active?.locationId, byId, startedAt]);
  const todo = item.sets.filter((x) => !x.completed && x.type !== "warmup");
  if (!s || todo.length === 0) return null;
  // Trim needs a set to drop; the extra set is shown until one has been added this session.
  if (s.kind === "trim" && todo.length < 2) return null;
  const extraDue = !!s.extraSet && !extraAdded(item.id);
  if (s.kind !== "trim" && !extraDue && todo.every((x) => x.reps === s.reps && (s.weightKg === null || x.weightKg === s.weightKg))) return null;

  const look = { ...LOOK[s.kind], label: s.label ?? LOOK[s.kind].label };
  const w = s.weightKg === null ? t("Bodyweight") : formatWeight(s.weightKg, unit);
  const target = `${w} × ${s.reps}`;
  const change =
    s.kind === "deload" || s.kind === "comeback"
      ? "-10%"
      : s.kind === "trim"
        ? t("−1 set")
        : s.kind === "hold"
          ? t("hold")
          : s.deltaKg !== 0
            ? `${s.deltaKg > 0 ? "+" : "−"}${formatWeight(Math.abs(s.deltaKg), unit)}`
            : s.deltaReps !== 0
              ? t.n(s.deltaReps, "+{n} rep", "+{n} reps")
              : "";
  const delta = [change, extraDue ? t("+1 set") : ""].filter(Boolean).join(", ");

  function apply() {
    if (!canAccessPro("progressive_overload_coach")) {
      openPaywall("progressive_overload_coach");
      return;
    }
    feedback.tick();
    if (s!.kind === "trim") {
      removeSet(item.id, todo[todo.length - 1]!.id);
      return;
    }
    for (const x of todo) updateSet(item.id, x.id, { reps: s!.reps, ...(s!.weightKg !== null ? { weightKg: s!.weightKg } : {}) });
    if (extraDue) {
      addSet(item.id);
      markExtraAdded(item.id);
    }
  }

  // A raised card in the page's own material, tinted with the call's colour: the call and its
  // change in words on top, the target in figures under it, and Apply as a raised key.
  return (
    <div
      role="group"
      aria-label={t("Coach: {label}", { label: t(look.label) })}
      className="tile mx-1 mt-2 flex items-center gap-3 rounded-card border py-2 pl-2.5 pr-2"
      style={{
        backgroundColor: `color-mix(in oklab, ${look.color} 9%, var(--color-surface))`,
        borderColor: `color-mix(in oklab, ${look.color} 30%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ color: look.color, backgroundColor: `color-mix(in oklab, ${look.color} 16%, transparent)` }}
      >
        <look.Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold" style={{ color: look.color }}>
          {t(look.label)}
          <ProBadge />
        </p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="num text-base font-bold text-text">{target}</span>
          {delta && <span className="num text-xs font-semibold" style={{ color: look.color }}>{delta}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={apply}
        title={t(s.why)}
        aria-label={t("Apply {target} to the sets left", { target })}
        className="raised min-h-11 shrink-0 rounded-ctl px-3.5 text-sm font-semibold"
        style={{ color: look.color }}
      >
        {t("Apply")}
      </button>
    </div>
  );
}