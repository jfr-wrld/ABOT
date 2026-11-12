"use client";

import { setNumbers } from "@/lib/sets";
import { Select } from "@/components/ui/Select";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Link2, Link2Off, Plus, Trash2 } from "lucide-react";
import { SUPERSET_COLORS, linkSupersetIn, removeFromList, supersetLabels, unlinkSupersetIn } from "@/lib/superset";
import { newId } from "@/lib/id";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { newRoutineExercise, newRoutineSet, useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { RepRangeField } from "@/components/ui/RepRangeField";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { SetTypeChip, setTypeA11yName } from "@/components/workout/SetTypeChip";
import { SetTypeMenu } from "@/components/workout/SetTypeMenu";
import { formatClock } from "@/lib/calc";
import { fromDisplay, toDisplay } from "@/lib/units";
import type { RoutineExercise, RoutineSet } from "@/types/workout";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import { EQUIPMENT_LABELS } from "@/types/workout";
import { useT } from "@/i18n";
import { muscleNames } from "@/components/exercise/MuscleTags";
import { SPLITS } from "@/lib/seed-routines";
import { routineSummary } from "@/lib/routine-summary";
import { MusclesWorked, SummaryMeta } from "@/components/routines/RoutineCard";
import type { Exercise, Routine } from "@/types/workout";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export default function EditRoutinePage() {
  return (
    <HydrationGate>
      <Editor />
    </HydrationGate>
  );
}

function Editor() {
  const id = useSearchParams().get("id") ?? "";
  const routine = useRoutineStore((s) => s.routines.find((r) => r.id === id));
  const { update, setExercises } = useRoutineStore();
  const { weightUnit, defaultRestSeconds } = useSettingsStore();
  const { byId } = useAllExercises();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menu, setMenu] = useState<{ exId: string; setId: string } | null>(null);
  const [supersetFor, setSupersetFor] = useState<string | null>(null);
  const t = useT();

  if (!routine) {
    return (
      <main className="px-4 pt-4">
        <PageHeader title={t("Routine not found")} back={{ href: "/workout", label: t("Workout") }} />
        <p className="mt-4 text-sm text-text-muted">
          {t("This routine does not exist on this device. It may have been deleted.")}
        </p>
      </main>
    );
  }

  const supersets = supersetLabels(routine.exercises);
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
      <PageHeader title={t("Edit routine")} back={{ href: "/workout", label: t("Workout") }} />

      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="r-name" className="mb-1 block text-sm font-semibold">
              {t("Name")}
            </label>
            <input
              id="r-name"
              value={routine.name}
              onChange={(e) => update(routine.id, { name: e.target.value })}
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="r-folder" className="mb-1 block text-sm font-semibold">
              {t("Folder")} <span className="font-normal text-text-muted">{t("(optional)")}</span>
            </label>
            <input
              id="r-folder"
              value={routine.folder ?? ""}
              onChange={(e) => update(routine.id, { folder: e.target.value })}
              placeholder="Push / Pull / Legs"
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
            />
            {/* The Template Vault's splits, one tap each, so saved routines group the same way. */}
            <div role="group" aria-label={t("Folder by split")} className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
              {SPLITS.map((sp) => (
                <button
                  key={sp.value}
                  type="button"
                  aria-pressed={routine.folder === sp.folder}
                  onClick={() => update(routine.id, { folder: routine.folder === sp.folder ? "" : sp.folder })}
                  className={`tap h-8 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                    routine.folder === sp.folder ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
                  }`}
                >
                  {t(sp.label)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {routine.exercises.length > 0 && <RoutineOverview routine={routine} byId={byId} />}

        {routine.exercises.length === 0 && (
          <p className="panel px-4 py-6 text-center text-sm text-text-muted">
            {t("No exercises in this routine yet. Add the first one below; each starts with three planned sets.")}
          </p>
        )}

        {routine.exercises.map((ex, i) => {
          const def = byId[ex.exerciseId];
          const nums = setNumbers(ex.sets);
          const ss = supersets[ex.id];
          const exName = def?.name ?? t("exercise");
          return (
            <section
              key={ex.id}
              aria-labelledby={`rex-${ex.id}`}
              // The coloured left edge marks exercises done back to back, as in the workout.
              style={ss ? { borderLeftColor: SUPERSET_COLORS[ss.color] } : undefined}
              className={`panel p-3 ${ss ? "border-l-[3px]" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  {def && <ExerciseThumb exercise={def} size={44} />}
                  <div className="min-w-0">
                    <h2 id={`rex-${ex.id}`} className="line-clamp-2 text-base leading-snug font-semibold text-accent">
                      {def?.name ?? t("Removed exercise")}
                    </h2>
                    {def && (
                      <p className="flex items-center gap-1.5 text-xs text-text-muted">
                        <EquipmentIcon equipment={def.equipment} size={14} />
                        {t(EQUIPMENT_LABELS[def.equipment])} · {muscleNames(def.primaryMuscles, t)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={() => move(ex.id, -1)}
                    disabled={i === 0}
                    aria-label={t("Move {name} up", { name: exName })}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(ex.id, 1)}
                    disabled={i === routine.exercises.length - 1}
                    aria-label={t("Move {name} down", { name: exName })}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExercises(routine.id, removeFromList(routine.exercises, ex.id))}
                    aria-label={t("Remove {name} from routine", { name: exName })}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-failure/10 hover:text-failure"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </div>
              </div>

              {ss ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="label-caps ss-text" style={{ "--ss": SUPERSET_COLORS[ss.color] } as React.CSSProperties}>
                    {ss.size > 2 ? t("Giant set") : t("Superset")} {"//"} <span className="num">{`${ss.letter}${ss.order}`}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setExercises(routine.id, unlinkSupersetIn(routine.exercises, ex.id))}
                    aria-label={t("Remove {name} from superset", { name: exName })}
                    className="flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-xs font-semibold text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <Link2Off aria-hidden="true" size={14} /> {t("Remove from superset")}
                  </button>
                </div>
              ) : (
                routine.exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSupersetFor(ex.id)}
                    aria-haspopup="dialog"
                    aria-label={t("Superset {name} with", { name: exName })}
                    className="mt-1 flex min-h-11 items-center gap-1.5 rounded-ctl px-2 -ml-2 text-xs font-semibold text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <Link2 aria-hidden="true" size={14} /> {t("Superset with…")}
                  </button>
                )
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                <label htmlFor={`rest-${ex.id}`}>{t("Rest")}</label>
                <Select
                  id={`rest-${ex.id}`}
                  value={ex.restSeconds}
                  onChange={(restSeconds) => patchExercise(ex.id, (x) => ({ ...x, restSeconds }))}
                  options={REST_OPTIONS.map((s) => ({ value: s, label: s === 0 ? t("Off") : formatClock(s) }))}
                />
              </div>

              <div
                className="mt-3 grid gap-1.5 px-1 label-caps"
                style={{ gridTemplateColumns: "44px minmax(0,1fr) 72px 64px" }}
                aria-hidden="true"
              >
                <span className="text-center">{t("Set")}</span>
                <span />
                <span className="text-center">{def?.isBodyweight ? "" : weightUnit}</span>
                <span className="text-center">{t("Reps")}</span>
              </div>
              <ol className="mt-1 flex flex-col gap-1" aria-label={t("Planned sets for {name}", { name: exName })}>
                {ex.sets.map((s, i) => {
                  const num = nums[i] ?? null;
                  const name = setTypeA11yName(s.type, num, t);
                  return (
                    <li
                      key={s.id}
                      className="grid items-center gap-1.5 px-1"
                      style={{ gridTemplateColumns: "44px minmax(0,1fr) 72px 64px" }}
                    >
                      <button
                        type="button"
                        onClick={() => setMenu({ exId: ex.id, setId: s.id })}
                        aria-label={t("{name}: change type or remove", { name })}
                        aria-haspopup="dialog"
                        className="flex h-11 w-11 items-center justify-center rounded-ctl hover:bg-surface-2"
                      >
                        <SetTypeChip type={s.type} number={num} />
                      </button>
                      <span className="text-xs text-text-muted">{t("target")}</span>
                      {def?.isBodyweight ? (
                        <span className="text-center text-xs text-text-muted">{t("BW")}</span>
                      ) : (
                        <NumberField
                          aria-label={t("{name} target weight in {unit}", { name, unit: weightUnit })}
                          placeholder="0"
                          value={s.targetWeightKg === null ? null : toDisplay(s.targetWeightKg, weightUnit)}
                          onCommit={(v) =>
                            patchSet(ex.id, s.id, { targetWeightKg: v === null ? null : fromDisplay(v, weightUnit) })
                          }
                          max={2000}
                        />
                      )}
                      <RepRangeField
                        aria-label={t("{name} target reps, a number or a range like 8-12", { name })}
                        placeholder="8-12"
                        min={s.targetReps}
                        max={s.targetRepsMax}
                        onCommit={(v) => patchSet(ex.id, s.id, { targetReps: v.min, targetRepsMax: v.max })}
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
                        newRoutineSet({
                          targetWeightKg: last?.targetWeightKg ?? null,
                          targetReps: last?.targetReps ?? null,
                          ...(last?.targetRepsMax ? { targetRepsMax: last.targetRepsMax } : {}),
                        }),
                      ],
                    };
                  })
                }
                className="mt-2 w-full"
              >
                <Plus aria-hidden="true" size={18} /> {t("Add set")}
              </Button>
            </section>
          );
        })}

        <Button onClick={() => setPickerOpen(true)} className="w-full">
          <Plus aria-hidden="true" size={18} /> {t("Add exercise")}
        </Button>

        <p className="text-center text-xs text-text-muted">
          {t("Changes save as you type.")}{" "}
          <Link href="/workout" className="text-accent underline-offset-2 hover:underline">
            {t("Back to routines")}
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
        onPickMany={(list) => {
          setExercises(routine.id, [...routine.exercises, ...list.map((e) => newRoutineExercise(e.id, defaultRestSeconds))]);
          setPickerOpen(false);
        }}
      />

      {supersetFor && (() => {
        const from = routine.exercises.find((e) => e.id === supersetFor);
        const fromName = (from && byId[from.exerciseId]?.name) ?? t("exercise");
        return (
          <Sheet open onClose={() => setSupersetFor(null)} title={t("Superset {name} with", { name: fromName })}>
            <p className="mb-3 text-sm text-text-muted">
              {t("Do one set of each back to back. Rest starts after the last exercise of the superset.")}
            </p>
            <ul className="flex flex-col gap-1">
              {routine.exercises
                .filter((e) => e.id !== supersetFor)
                .map((e) => {
                  const d = byId[e.exerciseId];
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setExercises(routine.id, linkSupersetIn(routine.exercises, supersetFor, e.id, newId));
                          setSupersetFor(null);
                        }}
                        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2 active:bg-ink/[0.08]"
                      >
                        {d && <ExerciseThumb exercise={d} size={40} />}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{d?.name ?? t("Removed exercise")}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </Sheet>
        );
      })()}

      <SetTypeMenu
        open={menu !== null && menuSet !== undefined}
        current={menuSet?.type ?? "normal"}
        onSelect={(type) => menu && patchSet(menu.exId, menu.setId, { type })}
        onRemove={() =>
          menu && patchExercise(menu.exId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== menu.setId) }))
        }
        onClose={() => setMenu(null)}
      />
    </main>
  );
}

/** What the routine adds up to as it is built: the numbers a Template Vault card shows. */
function RoutineOverview({ routine, byId }: { routine: Routine; byId: Record<string, Exercise> }) {
  const t = useT();
  const sum = routineSummary(routine, byId);
  return (
    <section aria-label={t("Routine overview")} className="flex items-center justify-between gap-3 rounded-card border border-ink/[0.07] bg-surface p-3">
      <div className="min-w-0">
        <SummaryMeta sum={sum} count={routine.exercises.length} />
        <p className="num mt-1.5 text-xs text-text-muted">{t("{n} sets", { n: sum.sets })}</p>
      </div>
      <MusclesWorked sum={sum} />
    </section>
  );
}
