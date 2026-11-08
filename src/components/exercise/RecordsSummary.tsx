"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import type { Exercise, PersonalRecord, PRKind } from "@/types/workout";
import { buildPRTable, variantKey } from "@/lib/calc";
import { formatWeight } from "@/lib/units";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useT } from "@/i18n";

/**
 * Heaviest weight, best estimated 1RM and best set volume for one exercise. With `locationId`
 * and a machine-dependent exercise it shows that gym's records, with the all-gyms best noted.
 */
export function RecordsSummary({ exercise, locationId }: { exercise: Exercise; locationId?: string }) {
  const sessions = useWorkoutStore((s) => s.sessions);
  const { byId } = useAllExercises();
  const { weightUnit } = useSettingsStore();
  const gymName = useLocationStore((s) => s.locations.find((l) => l.id === locationId)?.name);
  const perGym = Boolean(locationId && exercise.isMachineDependent);
  const t = useT();

  const { mine, all } = useMemo(() => {
    const allTable = buildPRTable(sessions, byId, { allGyms: true });
    const gymTable = perGym ? buildPRTable(sessions, byId) : allTable;
    return {
      mine: gymTable[perGym ? variantKey(exercise.id, exercise, locationId) : exercise.id],
      all: allTable[exercise.id],
    };
  }, [sessions, byId, perGym, exercise, locationId]);

  const tile = (kind: PRKind, label: string, value: (r: PersonalRecord) => string, sub: (r: PersonalRecord) => string) => {
    const r = mine?.[kind];
    if (!r) return null;
    return (
      <div key={kind} className="rounded-ctl bg-bg px-2 py-2">
        <dt className="label-caps">{label}</dt>
        <dd className="text-base font-bold num">{value(r)}</dd>
        <dd className="text-xs text-text-muted">
          {sub(r)} · {new Date(r.achievedAt).toLocaleDateString(t.locale, { day: "numeric", month: "short" })}
        </dd>
      </div>
    );
  };

  return (
    <section aria-labelledby={`pr-${exercise.id}`} className="panel p-3">
      <h2 id={`pr-${exercise.id}`} className="flex items-center gap-2 text-sm font-semibold">
        <Trophy aria-hidden="true" size={16} className="text-pr" />
        {t("Personal records")}
        {perGym && gymName && <span className="font-normal text-text-muted">{t("at {gym}", { gym: gymName })}</span>}
      </h2>
      {!mine ? (
        <p className="mt-2 text-sm text-text-muted">
          {t("No completed working sets yet. Records appear after you log this exercise in a finished workout.")}
        </p>
      ) : (
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {tile(
            "heaviest_weight",
            t("Heaviest weight"),
            (r) => (exercise.isBodyweight ? t("{n} reps", { n: r.reps }) : formatWeight(r.weightKg, weightUnit)),
            (r) => `× ${r.reps}`,
          )}
          {tile("best_1rm", t("Best 1RM (est.)"), (r) => formatWeight(r.value, weightUnit), (r) => `${formatWeight(r.weightKg, weightUnit, false)} × ${r.reps}`)}
          {tile("best_set_volume", t("Best set volume"), (r) => formatWeight(r.value, weightUnit), (r) => `${formatWeight(r.weightKg, weightUnit, false)} × ${r.reps}`)}
        </dl>
      )}
      {perGym && all?.heaviest_weight && all.heaviest_weight.value !== mine?.heaviest_weight?.value && (
        <p className="mt-2 text-xs text-text-muted">
          {t("Heaviest across all gyms: {weight} × {reps}", {
            weight: formatWeight(all.heaviest_weight.weightKg, weightUnit),
            reps: all.heaviest_weight.reps,
          })}
        </p>
      )}
    </section>
  );
}
