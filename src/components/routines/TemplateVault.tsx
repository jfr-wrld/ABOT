"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ListOrdered, Play, Timer, Zap } from "@/components/icons";
import type { MuscleGroup, Routine } from "@/types/workout";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PHASE_LABEL, templateFitsPhase } from "@/lib/phase-engine";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";
import { ROUTINE_TEMPLATES, SPLITS, estimateMinutes, templateToRoutine, type RoutineTemplate, type Split } from "@/lib/seed-routines";
import { Button } from "@/components/ui/Button";
import { LiftList } from "@/components/routines/RoutineCard";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { routineEditPath } from "@/lib/routes";
import { useT } from "@/i18n";
import { muscleLabel } from "@/components/exercise/MuscleTags";
import { feedback } from "@/lib/feedback";


/** Ready-made programs: filter by split, start one now, or save an editable copy. */
export function TemplateVault({ onStart, grid = false }: { onStart: (r: Routine) => void; grid?: boolean }) {
  const [split, setSplit] = useState<Split | "all">("all");
  const [saved, setSaved] = useState<Record<string, string>>({});
  const t = useT();
  const shown = split === "all" ? ROUTINE_TEMPLATES : ROUTINE_TEMPLATES.filter((tpl) => tpl.split === split);

  function save(tpl: RoutineTemplate) {
    const copy = templateToRoutine(tpl);
    const { create, setExercises } = useRoutineStore.getState();
    const r = create(copy.name, copy.folder);
    setExercises(r.id, copy.exercises);
    setSaved((s) => ({ ...s, [tpl.id]: r.id }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto px-4" role="group" aria-label={t("Filter templates by split")}>
        <div className="flex w-max gap-1.5 pb-1">
          {[{ value: "all" as const, label: t("All") }, ...SPLITS].map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={split === s.value}
              onClick={() => {
                if (split !== s.value) feedback.tick();
                setSplit(s.value);
              }}
              className={`chip tap h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold ${
                split === s.value
                  ? "border-accent bg-accent text-on-accent"
                  : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
              }`}
            >
              {s.value === "all" ? s.label : t(s.label)}
            </button>
          ))}
        </div>
      </div>

      <ul className={grid ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"} aria-label={t("Templates")}>
        {shown.map((tpl) => (
          <li key={tpl.id}>
            <TemplateCard grid={grid} template={tpl} savedId={saved[tpl.id]} onStart={() => onStart(templateToRoutine(tpl))} onSave={() => save(tpl)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Muscle groups a template works most, by planned sets. */
function topMuscles(tpl: RoutineTemplate, n = 3): MuscleGroup[] {
  const sets = new Map<MuscleGroup, number>();
  for (const e of tpl.exercises) {
    for (const m of SEED_EXERCISES_BY_ID[e.exerciseId]?.primaryMuscles ?? []) sets.set(m, (sets.get(m) ?? 0) + e.sets);
  }
  return [...sets.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => m);
}

/**
 * One template, read at a glance: split, time and size as icons with figures, the muscles as
 * lit figures, and the lifts folded under "See exercises".
 */
function TemplateCard({
  template: tpl,
  savedId,
  onStart,
  onSave,
  grid = false,
}: {
  grid?: boolean;
  template: RoutineTemplate;
  savedId?: string;
  onStart: () => void;
  onSave: () => void;
}) {
  const t = useT();
  const phase = useSettingsStore((s) => (s.bodyPhase?.isActive ? s.bodyPhase.phaseType : null));
  const splitLabel = SPLITS.find((s) => s.value === tpl.split)?.label;
  const muscles = topMuscles(tpl);
  if (grid) {
    return (
      <article aria-labelledby={`${tpl.id}-title`} className="flex h-full flex-col rounded-card border bg-surface p-3">
        <ul aria-label={t("Muscles worked")} className="-ml-1 flex">
          {muscles.map((m) => (
            <li key={m} title={muscleLabel(m, t)}>
              <MuscleIcon muscle={m} size={28} />
              <span className="sr-only">{muscleLabel(m, t)}</span>
            </li>
          ))}
        </ul>
        <h3 id={`${tpl.id}-title`} className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-text">
          {tpl.name}
        </h3>
        <p className="num mt-0.5 text-xs text-text-muted">
          {[splitLabel ? t(splitLabel) : "", `~${t("{n} min", { n: estimateMinutes(tpl) })}`].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex gap-2 pt-3">
          <Button variant="primary" onClick={onStart} aria-label={t("Start workout: {name}", { name: tpl.name })} className="min-h-10 min-w-0 flex-1 whitespace-nowrap">
            <Play aria-hidden="true" size={16} /> {t("Start")}
          </Button>
          {savedId ? (
            <Link href={routineEditPath(savedId)} aria-label={t("Saved, edit")} className="tap flex size-10 shrink-0 items-center justify-center rounded-lg raised text-accent">
              <Check aria-hidden="true" size={16} />
            </Link>
          ) : (
            <button type="button" onClick={onSave} aria-label={t("Save to My Routines: {name}", { name: tpl.name })} className="tap flex size-10 shrink-0 items-center justify-center rounded-lg raised text-text-muted hover:text-text">
              <Copy aria-hidden="true" size={16} />
            </button>
          )}
        </div>
      </article>
    );
  }
  return (
    <article
      aria-labelledby={`${tpl.id}-title`}
      className="rounded-card border bg-surface p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-ink/10 px-2 py-px text-[10px] font-semibold text-text-muted">
              {splitLabel && t(splitLabel)}
            </span>
            <span className="num inline-flex items-center gap-1 text-xs text-text-muted" title={t("Estimated time")}>
              <Timer aria-hidden="true" size={13} />~{estimateMinutes(tpl)}
              <span aria-hidden="true">m</span>
              <span className="sr-only"> {t("minutes")}</span>
            </span>
            <span className="num inline-flex items-center gap-1 text-xs text-text-muted" title={t("Exercises")}>
              <ListOrdered aria-hidden="true" size={13} />
              {tpl.exercises.length}
              <span className="sr-only"> {t("exercises")}</span>
            </span>
          </div>
          <h3 id={`${tpl.id}-title`} className="mt-2 line-clamp-2 text-base font-bold leading-tight text-text">
            {tpl.name}
          </h3>
          {phase && templateFitsPhase(tpl, phase) && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-bold text-accent">
              <Zap aria-hidden="true" size={11} />
              {t("Fits your {phase}", { phase: t(PHASE_LABEL[phase]).toLowerCase() })}
            </p>
          )}
        </div>
        <ul aria-label={t("Muscles worked")} className="-mr-1 flex shrink-0">
          {muscles.map((m) => (
            <li key={m} title={muscleLabel(m, t)}>
              <MuscleIcon muscle={m} size={30} />
              <span className="sr-only">{muscleLabel(m, t)}</span>
            </li>
          ))}
        </ul>
      </header>

      <LiftList
        items={tpl.exercises.map((e) => ({
          name: SEED_EXERCISES_BY_ID[e.exerciseId]?.name ?? e.exerciseId,
          detail: `${e.sets}×${e.holdSec ? `${e.holdSec}s` : e.reps}`,
          superset: !!e.superset,
        }))}
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={onStart} aria-label={t("Start workout: {name}", { name: tpl.name })} className="whitespace-nowrap">
          <Play aria-hidden="true" size={16} /> {t("Start")}
        </Button>
        {savedId ? (
          <Link
            href={routineEditPath(savedId)}
            aria-label={t("Saved, edit")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent/40 text-sm font-semibold text-text transition-colors hover:border-accent"
          >
            <Check aria-hidden="true" size={16} className="text-accent" /> {t("Saved")}
          </Link>
        ) : (
          <Button onClick={onSave} aria-label={t("Save to My Routines: {name}", { name: tpl.name })} className="whitespace-nowrap !bg-transparent">
            <Copy aria-hidden="true" size={16} /> {t("Save")}
          </Button>
        )}
      </div>
    </article>
  );
}
