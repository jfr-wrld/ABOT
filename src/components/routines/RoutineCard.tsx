"use client";

import Link from "next/link";
import { Copy, ListOrdered, Pencil, Play, Timer, Trash2 } from "lucide-react";
import type { Exercise, Routine } from "@/types/workout";
import { routineSummary, type RoutineSummary } from "@/lib/routine-summary";
import { supersetLabels } from "@/lib/superset";
import { Button } from "@/components/ui/Button";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { muscleLabel } from "@/components/exercise/MuscleTags";
import { routineEditPath } from "@/lib/routes";
import { useT } from "@/i18n";

/** Photos on a card; the sixth slot shows "+N" when there are more. */
const PREVIEW = 5;
const THUMB = 38;

/**
 * A saved routine, read like a Template Vault card: focus, time and size up top, the muscles as
 * lit figures, each lift as a photo with sets x reps, then Start and the edit actions.
 */
export function RoutineCard({
  routine: r,
  byId,
  onStart,
  onDuplicate,
  onDelete,
}: {
  routine: Routine;
  byId: Record<string, Exercise>;
  onStart: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const sum = routineSummary(r, byId);
  const ssCount = new Set(Object.values(supersetLabels(r.exercises)).map((x) => x.letter)).size;
  const empty = r.exercises.length === 0;
  const icon = "flex size-11 shrink-0 items-center justify-center rounded-xl border border-ink/[0.08] text-text-muted hover:border-ink/20 hover:text-text";
  return (
    <article aria-labelledby={`routine-${r.id}`} className="rounded-card border border-ink/[0.07] bg-surface p-4 transition-colors hover:border-ink/[0.15]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SummaryMeta sum={sum} count={r.exercises.length} />
          <h3 id={`routine-${r.id}`} className="mt-2 truncate text-base font-bold tracking-tight">
            {r.name}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {empty
              ? t("No exercises yet")
              : [
                  t.n(r.exercises.length, "{n} exercise", "{n} exercises"),
                  t("{n} sets", { n: sum.sets }),
                  ...(ssCount ? [t.n(ssCount, "{n} superset", "{n} supersets")] : []),
                ].join(" · ")}
          </p>
        </div>
        <MusclesWorked sum={sum} />
      </header>

      {!empty && <LiftGrid sum={sum} byId={byId} />}

      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={onStart} disabled={empty} aria-label={t("Start {name}", { name: r.name })} className="min-w-0 flex-1 whitespace-nowrap">
          <Play aria-hidden="true" size={16} /> {t("Start")}
        </Button>
        <Link href={routineEditPath(r.id)} aria-label={t("Edit {name}", { name: r.name })} className={icon}>
          <Pencil aria-hidden="true" size={17} />
        </Link>
        <button type="button" onClick={onDuplicate} aria-label={t("Duplicate {name}", { name: r.name })} className={icon}>
          <Copy aria-hidden="true" size={17} />
        </button>
        <button type="button" onClick={onDelete} aria-label={t("Delete {name}", { name: r.name })} className={`${icon} hover:!border-failure/40 hover:!text-failure`}>
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </div>
      {empty && <p className="mt-1.5 text-center text-xs text-text-muted">{t("Add an exercise before starting.")}</p>}
    </article>
  );
}

/** Focus pill, rough minutes and exercise count, as on a template card. */
export function SummaryMeta({ sum, count }: { sum: RoutineSummary; count: number }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      {sum.focus && (
        <span className="rounded-full border border-ink/10 px-2 py-px text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {t(sum.focus.label)}
        </span>
      )}
      {sum.minutes > 0 && (
        <span className="num inline-flex items-center gap-1 text-xs text-text-muted" title={t("Estimated time")}>
          <Timer aria-hidden="true" size={13} />~{sum.minutes}
          <span aria-hidden="true">m</span>
          <span className="sr-only"> {t("minutes")}</span>
        </span>
      )}
      <span className="num inline-flex items-center gap-1 text-xs text-text-muted" title={t("Exercises")}>
        <ListOrdered aria-hidden="true" size={13} />
        {count}
        <span className="sr-only"> {t("exercises")}</span>
      </span>
    </div>
  );
}

export function MusclesWorked({ sum }: { sum: RoutineSummary }) {
  const t = useT();
  if (sum.muscles.length === 0) return null;
  return (
    <ul aria-label={t("Muscles worked")} className="-mr-1 flex shrink-0">
      {sum.muscles.map((m) => (
        <li key={m} title={muscleLabel(m, t)}>
          <MuscleIcon muscle={m} size={30} />
          <span className="sr-only">{muscleLabel(m, t)}</span>
        </li>
      ))}
    </ul>
  );
}

function LiftGrid({ sum, byId }: { sum: RoutineSummary; byId: Record<string, Exercise> }) {
  const t = useT();
  const shown = sum.lines.slice(0, PREVIEW);
  const more = sum.lines.length - shown.length;
  return (
    <ol aria-label={t("Exercises")} className="mt-3 grid grid-cols-6 justify-items-center gap-1 border-t border-line pt-3">
      {shown.map((l, i) => {
        const ex = byId[l.exerciseId];
        return (
          <li key={`${l.exerciseId}-${i}`} className="flex min-w-0 flex-col items-center gap-1" title={ex?.name}>
            {ex ? (
              <ExerciseThumb exercise={ex} size={THUMB} />
            ) : (
              <span style={{ width: THUMB, height: THUMB }} className="rounded-xl bg-surface-2" aria-hidden="true" />
            )}
            <span className="sr-only">{ex?.name ?? t("Removed exercise")}, </span>
            <span className="num text-[10px] leading-none text-text-muted">
              {l.reps ? `${l.sets}×${l.reps}` : t("{n} sets", { n: l.sets })}
              {l.superset && <span className="ml-0.5 text-text">SS</span>}
            </span>
          </li>
        );
      })}
      {more > 0 && (
        <li className="flex flex-col items-center gap-1">
          <span style={{ width: THUMB, height: THUMB }} className="num flex items-center justify-center rounded-xl bg-surface-2 text-xs text-text-muted">
            +{more}
            <span className="sr-only"> {t.n(more, "more exercise", "more exercises")}</span>
          </span>
        </li>
      )}
    </ol>
  );
}
