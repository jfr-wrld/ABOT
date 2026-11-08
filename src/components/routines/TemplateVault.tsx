"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Play } from "lucide-react";
import type { Routine } from "@/types/workout";
import { useRoutineStore } from "@/store/useRoutineStore";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";
import { ROUTINE_TEMPLATES, SPLITS, estimateMinutes, templateMuscles, templateToRoutine, type RoutineTemplate, type Split } from "@/lib/seed-routines";
import { Button } from "@/components/ui/Button";

const PREVIEW = 4;

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
  const more = t.exercises.length - PREVIEW;
  return (
    <article
      aria-labelledby={`${t.id}-title`}
      className="rounded-card border border-white/[0.07] bg-surface p-4 transition-colors hover:border-white/[0.15]"
    >
      <header>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-2 py-px text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {splitLabel}
          </span>
          <span className="num text-[11px] text-text-muted">
            ~{estimateMinutes(t)} MIN · {t.exercises.length} EXERCISES
          </span>
        </div>
        <h3 id={`${t.id}-title`} className="num mt-2 text-sm font-bold tracking-tight text-text">
          {t.code}
        </h3>
        <p className="num mt-1 text-xs text-zinc-400">{templateMuscles(t).slice(0, 4).join(" / ")}</p>
      </header>

      <ol className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
        {t.exercises.slice(0, PREVIEW).map((e) => (
          <li key={e.exerciseId} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{SEED_EXERCISES_BY_ID[e.exerciseId]?.name ?? e.exerciseId}</span>
            <span className="num shrink-0 text-xs text-text-muted">
              {e.sets} × {e.holdSec ? `${e.holdSec}s` : e.reps}
              {e.superset && <span className="ml-1 text-text">SS</span>}
            </span>
          </li>
        ))}
        {more > 0 && (
          <li className="num text-xs text-text-muted">
            +{more} more {more === 1 ? "exercise" : "exercises"}
          </li>
        )}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={onStart} aria-label={`Start workout: ${t.name}`} className="whitespace-nowrap">
          <Play aria-hidden="true" size={16} /> Start Workout
        </Button>
        {savedId ? (
          <Link
            href={`/routines/${savedId}/edit`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent/40 text-sm font-semibold text-text transition-colors hover:border-accent"
          >
            <Check aria-hidden="true" size={16} className="text-accent" /> Saved, edit
          </Link>
        ) : (
          <Button onClick={onSave} aria-label={`Save to My Routines: ${t.name}`} className="whitespace-nowrap !bg-transparent">
            <Copy aria-hidden="true" size={16} /> Save copy
          </Button>
        )}
      </div>
    </article>
  );
}
