"use client";

import { useMemo, useState } from "react";
import type { Exercise, SessionExercise, WeightUnit } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { FILTER_LABEL, convertLoad, lastTopWeight, swapCandidates, type EquipmentFilter } from "@/lib/exercise-swapper";
import { formatWeight } from "@/lib/units";
import { feedback } from "@/lib/feedback";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import { muscleText } from "@/lib/home";
import { useT } from "@/i18n";

const FILTERS = (Object.keys(FILTER_LABEL) as EquipmentFilter[]).map((value) => ({ value, label: FILTER_LABEL[value] }));

/**
 * Smart swap for a taken rack or a hotel gym: the closest alternatives to this exercise for the
 * chosen equipment, each with its match and the weight to start at. Picking one keeps the sets
 * left and fills in that weight.
 */
export function ExerciseSwapModal({
  open,
  onClose,
  item,
  exercise,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  item: SessionExercise;
  exercise: Exercise;
  unit: WeightUnit;
}) {
  const t = useT();
  const [filter, setFilter] = useState<EquipmentFilter>("all");
  const { list } = useAllExercises();
  const sessions = useWorkoutStore((s) => s.sessions);
  const activeId = useWorkoutStore((s) => s.active?.id);
  const swap = useWorkoutStore((s) => s.swapExercise);

  // The weight being worked with now: the next set's, else the last one ticked, else last time's.
  const base =
    item.sets.find((x) => !x.completed && (x.weightKg ?? 0) > 0)?.weightKg ??
    [...item.sets].reverse().find((x) => x.completed && (x.weightKg ?? 0) > 0)?.weightKg ??
    lastTopWeight(exercise.id, sessions, activeId);

  const rows = useMemo(
    () =>
      open
        ? swapCandidates(exercise, list, filter).map((c) => ({
            ...c,
            load: convertLoad(base, exercise, c.exercise, { sessions, unit, excludeSessionId: activeId }),
          }))
        : [],
    [open, exercise, list, filter, base, sessions, unit, activeId],
  );

  const muscle = (m?: string) => (m ? muscleText(MUSCLE_GROUP_LABELS[m as keyof typeof MUSCLE_GROUP_LABELS], t) : "");

  return (
    <Sheet open={open} onClose={onClose} title={t("Swap {name}", { name: exercise.name })}>
      <div className="flex flex-col gap-3">
        <div role="group" aria-label={t("Equipment")} className="grid grid-cols-2 gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => {
                feedback.tick();
                setFilter(f.value);
              }}
              className={`min-h-11 rounded-ctl border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                filter === f.value ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">{t("Nothing close enough with this equipment. Try another filter.")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(({ exercise: e, match, reason, load }) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    feedback.tick();
                    swap(item.id, e.id, load.weightKg);
                    onClose();
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-ctl border border-line bg-surface p-2 text-left transition-colors hover:border-line-hover active:bg-surface-2"
                >
                  <ExerciseThumb exercise={e} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{e.name}</span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase leading-snug tracking-[0.06em] text-text-muted">
                      <span className="tabular-nums text-accent">{t("{n}% match", { n: match })}</span>
                      {" · "}
                      {reason.kind === "pattern"
                        ? t("Same movement: {muscle}", { muscle: muscle(reason.muscle) })
                        : reason.kind === "muscle"
                          ? t("Same primary muscle: {muscle}", { muscle: muscle(reason.muscle) })
                          : t("Works {muscle}", { muscle: muscle(reason.muscle) })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-xs tabular-nums">
                    {load.weightKg !== null ? (
                      <>
                        <span className="block font-semibold">{formatWeight(load.weightKg, unit)}</span>
                        <span className="block text-[10px] uppercase text-text-muted">{load.source === "history" ? t("your last") : t("estimate")}</span>
                      </>
                    ) : (
                      <span className="block text-text-muted">{e.equipment === "bodyweight" || e.isBodyweight ? t("Bodyweight") : t("Set weight")}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-text-muted">
          {t("Ticked sets stay with {name}. The sets left move to the new exercise.", { name: exercise.name })}
        </p>
      </div>
    </Sheet>
  );
}
