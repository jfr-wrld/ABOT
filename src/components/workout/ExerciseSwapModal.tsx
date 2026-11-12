"use client";

import { useMemo, useState } from "react";
import type { Exercise, SessionExercise, WeightUnit } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { FILTER_LABEL, convertLoad, lastTopWeight, swapCandidates, swapInRoutine, type EquipmentFilter } from "@/lib/exercise-swapper";
import { useRoutineStore } from "@/store/useRoutineStore";
import { Button } from "@/components/ui/Button";
import { formatWeight } from "@/lib/units";
import { feedback } from "@/lib/feedback";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import { muscleText } from "@/lib/home";
import { useT } from "@/i18n";

/** A crowded gym needs a quick yes, not a long list: the three closest. */
const SHOWN = 3;

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
  const routineId = useWorkoutStore((s) => s.active?.routineId);
  const routine = useRoutineStore((s) => (routineId ? s.routines.find((r) => r.id === routineId) : undefined));
  const inRoutine = !!routine?.exercises.some((e) => e.exerciseId === exercise.id);
  // From a routine, a pick asks whether the routine changes too; otherwise it swaps at once.
  const [chosen, setChosen] = useState<{ exercise: Exercise; weightKg: number | null } | null>(null);
  const close = () => {
    setChosen(null);
    onClose();
  };
  const commit = (to: Exercise, weightKg: number | null, alsoRoutine: boolean) => {
    feedback.tick();
    swap(item.id, to.id, weightKg);
    if (alsoRoutine && routine) {
      const next = swapInRoutine(routine.exercises, exercise.id, to.id, weightKg);
      if (next) useRoutineStore.getState().setExercises(routine.id, next);
    }
    close();
  };

  // The weight being worked with now: the next set's, else the last one ticked, else last time's.
  const base =
    item.sets.find((x) => !x.completed && (x.weightKg ?? 0) > 0)?.weightKg ??
    [...item.sets].reverse().find((x) => x.completed && (x.weightKg ?? 0) > 0)?.weightKg ??
    lastTopWeight(exercise.id, sessions, activeId);

  const rows = useMemo(
    () =>
      open
        ? swapCandidates(exercise, list, filter, SHOWN).map((c) => ({
            ...c,
            load: convertLoad(base, exercise, c.exercise, { sessions, unit, excludeSessionId: activeId }),
          }))
        : [],
    [open, exercise, list, filter, base, sessions, unit, activeId],
  );

  const muscle = (m?: string) => (m ? muscleText(MUSCLE_GROUP_LABELS[m as keyof typeof MUSCLE_GROUP_LABELS], t) : "");

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("Swap {name}", { name: exercise.name })}
      footer={
        chosen ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {t("Swap to {name}", { name: chosen.exercise.name })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => commit(chosen.exercise, chosen.weightKg, false)}>{t("Today only")}</Button>
              <Button variant="primary" onClick={() => commit(chosen.exercise, chosen.weightKg, true)}>
                {t("Update routine")}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
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
                  aria-pressed={inRoutine ? chosen?.exercise.id === e.id : undefined}
                  onClick={() => {
                    if (inRoutine) {
                      feedback.tick();
                      setChosen({ exercise: e, weightKg: load.weightKg });
                    } else commit(e, load.weightKg, false);
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-ctl border p-2 text-left transition-colors hover:border-line-hover active:bg-surface-2 ${
                    chosen?.exercise.id === e.id ? "border-accent bg-accent-tint" : "border-line bg-surface"
                  }`}
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
                        <span className="block font-semibold">
                          {e.loadMode === "per_hand" ? t("{weight} / hand", { weight: formatWeight(load.weightKg, unit) }) : formatWeight(load.weightKg, unit)}
                        </span>
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
