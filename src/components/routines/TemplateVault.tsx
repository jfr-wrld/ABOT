"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ListOrdered, Play, Timer } from "lucide-react";
import { MUSCLE_GROUP_LABELS, type MuscleGroup, type Routine } from "@/types/workout";
import { useRoutineStore } from "@/store/useRoutineStore";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";
import { ROUTINE_TEMPLATES, SPLITS, estimateMinutes, templateToRoutine, type RoutineTemplate, type Split } from "@/lib/seed-routines";
import { Button } from "@/components/ui/Button";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleIcon } from "@/components/icons/MuscleIcon";

/** Photos on a card; the sixth slot shows "+N" when there are more. */
const PREVIEW = 5;
/** Six photos and their gaps fit a 320 px phone at this size. */
const THUMB = 38;

/** Ready-made programs: filter by split, start one now, or save an editable copy. */
export function TemplateVault({ onStart }: { onStart: (r: Routine) => void }) {
  const [split, setSplit] = useState<Split | "all">("all");
  const [saved, setSaved] = useState<Record<string, string>>({});
  const shown = split === "all" ? ROUTINE_TEMPLATES : ROUTINE_TEMPLATES.filter((t) => t.split === split);

  function save(t: RoutineTemplate) {
    const copy = templateToRoutine(t);
    const { create, setExercises } = useRoutineStore.getState();
    const r = create(copy.name, copy.folder);
    setExercises(r.id, copy.exercises);
    setSaved((s) => ({ ...s, [t.id]: r.id }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto px-4" role="group" aria-label="Filter templates by split">
        <div className="flex w-max gap-1.5 pb-1">
          {[{ value: "all" as const, label: "All" }, ...SPLITS].map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={split === s.value}
              onClick={() => setSplit(s.value)}
              className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                split === s.value
                  ? "border-accent bg-accent text-on-accent"
                  : "border-white/[0.12] text-text-muted hover:border-white/25 hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-3" aria-label="Templates">
        {shown.map((t) => (
          <li key={t.id}>
            <TemplateCard template={t} savedId={saved[t.id]} onStart={() => onStart(templateToRoutine(t))} onSave={() => save(t)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Muscle groups a template works most, by planned sets. */
function topMuscles(t: RoutineTemplate, n = 3): MuscleGroup[] {
  const sets = new Map<MuscleGroup, number>();
  for (const e of t.exercises) {
    for (const m of SEED_EXERCISES_BY_ID[e.exerciseId]?.primaryMuscles ?? []) sets.set(m, (sets.get(m) ?? 0) + e.sets);
  }
  return [...sets.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => m);
}

/**
 * One template, read at a glance: split, time and size as icons with figures, the muscles as
 * lit figures, and the lifts as photos with their sets x reps underneath. Names stay available
 * to screen readers and as each photo's tooltip.
 */
function TemplateCard({
  template: t,
  savedId,
  onStart,
  onSave,
}: {
  template: RoutineTemplate;
  savedId?: string;
  onStart: () => void;
  onSave: () => void;
}) {
  const splitLabel = SPLITS.find((s) => s.value === t.split)?.label;
  const shown = t.exercises.slice(0, PREVIEW);
  const more = t.exercises.length - shown.length;
  const muscles = topMuscles(t);
  return (
    <article
      aria-labelledby={`${t.id}-title`}
      className="rounded-card border border-white/[0.07] bg-surface p-4 transition-colors hover:border-white/[0.15]"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 px-2 py-px text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {splitLabel}
            </span>
            <span className="num inline-flex items-center gap-1 text-xs text-text-muted" title="Estimated time">
              <Timer aria-hidden="true" size={13} />~{estimateMinutes(t)}
              <span aria-hidden="true">m</span>
              <span className="sr-only"> minutes</span>
            </span>
            <span className="num inline-flex items-center gap-1 text-xs text-text-muted" title="Exercises">
              <ListOrdered aria-hidden="true" size={13} />
              {t.exercises.length}
              <span className="sr-only"> exercises</span>
            </span>
          </div>
          <h3 id={`${t.id}-title`} className="num mt-2 line-clamp-2 text-sm font-bold tracking-tight text-text">
            {t.code}
          </h3>
        </div>
        <ul aria-label="Muscles worked" className="-mr-1 flex shrink-0">
          {muscles.map((m) => (
            <li key={m} title={MUSCLE_GROUP_LABELS[m]}>
              <MuscleIcon muscle={m} size={30} />
              <span className="sr-only">{MUSCLE_GROUP_LABELS[m]}</span>
            </li>
          ))}
        </ul>
      </header>

      <ol aria-label="Exercises" className="mt-3 grid grid-cols-6 justify-items-center gap-1 border-t border-line pt-3">
        {shown.map((e) => {
          const ex = SEED_EXERCISES_BY_ID[e.exerciseId];
          return (
            <li key={e.exerciseId} className="flex min-w-0 flex-col items-center gap-1" title={ex?.name}>
              {ex ? (
                <ExerciseThumb exercise={ex} size={THUMB} />
              ) : (
                <span style={{ width: THUMB, height: THUMB }} className="rounded-xl bg-surface-2" aria-hidden="true" />
              )}
              <span className="sr-only">{ex?.name ?? e.exerciseId}, </span>
              <span className="num text-[10px] leading-none text-text-muted">
                {e.sets}×{e.holdSec ? `${e.holdSec}s` : e.reps}
                {e.superset && <span className="ml-0.5 text-text">SS</span>}
              </span>
            </li>
          );
        })}
        {more > 0 && (
          <li className="flex flex-col items-center gap-1">
            <span style={{ width: THUMB, height: THUMB }} className="num flex items-center justify-center rounded-xl bg-surface-2 text-xs text-text-muted">
              +{more}
              <span className="sr-only"> more {more === 1 ? "exercise" : "exercises"}</span>
            </span>
          </li>
        )}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={onStart} aria-label={`Start workout: ${t.name}`} className="whitespace-nowrap">
          <Play aria-hidden="true" size={16} /> Start
        </Button>
        {savedId ? (
          <Link
            href={`/routines/${savedId}/edit`}
            aria-label="Saved, edit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent/40 text-sm font-semibold text-text transition-colors hover:border-accent"
          >
            <Check aria-hidden="true" size={16} className="text-accent" /> Saved
          </Link>
        ) : (
          <Button onClick={onSave} aria-label={`Save to My Routines: ${t.name}`} className="whitespace-nowrap !bg-transparent">
            <Copy aria-hidden="true" size={16} /> Save
          </Button>
        )}
      </div>
    </article>
  );
}
