"use client";

import { useMemo } from "react";
import { AlertTriangle, Scissors, Shield, TrendingUp, Zap } from "lucide-react";
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

/** Volt for more load, cyan for more reps, amber for a deload: on black in every theme. */
const LOOK: Record<OverloadKind, { color: string; Icon: typeof Zap; label: string }> = {
  load: { color: "#ccff00", Icon: Zap, label: KIND_LABEL.load },
  reps: { color: "#00f0ff", Icon: TrendingUp, label: KIND_LABEL.reps },
  deload: { color: "#f59e0b", Icon: AlertTriangle, label: KIND_LABEL.deload },
  hold: { color: "#00f0ff", Icon: Shield, label: KIND_LABEL.hold },
  trim: { color: "#f59e0b", Icon: Scissors, label: KIND_LABEL.trim },
};

/** Exercises in this workout that already got the lean-bulk extra set (one per exercise). */
const extras = new Set<string>();
const extraAdded = (sessionExerciseId: string) => extras.has(sessionExerciseId);
const markExtraAdded = (sessionExerciseId: string) => extras.add(sessionExerciseId);

/**
 * The Coach Pill under an exercise's name: next target from the last three sessions
 * (lib/progressive-overload). APPLY writes it into every set still to do. Hidden when there is
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
    return suggestOverload(exercise, sessions, { unit, excludeSessionId: active?.id, variant: { byId, locationId: active?.locationId }, fresh });
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
    s.kind === "deload"
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

  return (
    <div
      role="group"
      aria-label={t("Coach: {label}", { label: t(look.label) })}
      className="force-dark mx-1 mt-2 flex items-center gap-2 rounded-ctl border bg-black py-1 pl-2.5 pr-1"
      style={{ borderColor: `${look.color}55`, boxShadow: `0 0 12px ${look.color}1f` }}
    >
      <look.Icon aria-hidden="true" size={14} className="shrink-0" style={{ color: look.color }} />
      <p className="min-w-0 flex-1 font-mono text-[11px] uppercase leading-tight tracking-[0.08em] text-zinc-300">
        <ProBadge className="mb-0.5 mr-1.5 align-middle" />
        <span className="font-semibold" style={{ color: look.color }}>
          {t(look.label)}:
        </span>{" "}
        <span className="tabular-nums text-white">{target}</span>{" "}
        <span className="tabular-nums" style={{ color: look.color }}>
          ({delta})
        </span>
      </p>
      <button
        type="button"
        onClick={apply}
        title={t(s.why)}
        aria-label={t("Apply {target} to the sets left", { target })}
        className="flex min-h-11 shrink-0 items-center rounded-[calc(var(--radius-ctl)-4px)] border px-2.5 font-mono text-[11px] font-bold tracking-[0.12em] transition-colors hover:bg-white/10 active:bg-white/15"
        style={{ borderColor: look.color, color: look.color }}
      >
        {t("APPLY")}
      </button>
    </div>
  );
}
