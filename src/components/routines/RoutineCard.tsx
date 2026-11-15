"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, ListOrdered, MoreHorizontal, Pencil, Play, Timer, Trash2 } from "@/components/icons";
import type { Exercise, Routine } from "@/types/workout";
import { routineSummary, type RoutineSummary } from "@/lib/routine-summary";
import { supersetLabels } from "@/lib/superset";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { muscleLabel } from "@/components/exercise/MuscleTags";
import { routineEditPath } from "@/lib/routes";
import { useT } from "@/i18n";


/**
 * A saved routine, read like a Templates card: focus, time and size up top, the muscles as
 * lit figures, the lifts folded under "See exercises", then Start and the edit actions.
 */
export function RoutineCard({
  routine: r,
  byId,
  onStart,
  onDuplicate,
  onDelete,
  lastDone,
  grid = false,
}: {
  /** When it was last trained, for "Last done 3 days ago". */
  lastDone?: string;
  /** A compact tile for the two-column grid view. */
  grid?: boolean;
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
  if (grid) {
    return (
      <article aria-labelledby={`routine-${r.id}`} className="flex h-full flex-col rounded-card border bg-surface p-3">
        <MusclesWorked sum={sum} />
        <h3 id={`routine-${r.id}`} className="mt-2 line-clamp-2 text-sm font-bold leading-snug tracking-tight">
          {r.name}
        </h3>
        <p className="num mt-0.5 text-xs text-text-muted">
          {empty ? t("No exercises yet") : [t.n(r.exercises.length, "{n} exercise", "{n} exercises"), sum.minutes > 0 ? `~${t("{n} min", { n: sum.minutes })}` : ""].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex gap-2 pt-3">
          <Button variant="primary" onClick={onStart} disabled={empty} aria-label={t("Start {name}", { name: r.name })} className="min-h-10 min-w-0 flex-1 whitespace-nowrap">
            <Play aria-hidden="true" size={16} /> {t("Start")}
          </Button>
          <RoutineMenu routine={r} onDuplicate={onDuplicate} onDelete={onDelete} small />
        </div>
      </article>
    );
  }
  return (
    <article aria-labelledby={`routine-${r.id}`} className="rounded-card border bg-surface p-4">
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
          {lastDone && !empty && <p className="mt-0.5 text-xs font-semibold text-text-muted">{lastDone}</p>}
        </div>
        <MusclesWorked sum={sum} />
      </header>

      {!empty && <LiftGrid sum={sum} byId={byId} />}

      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={onStart} disabled={empty} aria-label={t("Start {name}", { name: r.name })} className="min-w-0 flex-1 whitespace-nowrap">
          <Play aria-hidden="true" size={16} /> {t("Start")}
        </Button>
        <RoutineMenu routine={r} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
      {empty && <p className="mt-1.5 text-center text-xs text-text-muted">{t("Add an exercise before starting.")}</p>}
    </article>
  );
}

/**
 * Edit, duplicate and delete behind one "···" (owner, 2026-11-15), so a card leads with Start.
 * The menu is a sheet: big targets, and the same pattern as the workout's own options.
 */
function RoutineMenu({ routine: r, onDuplicate, onDelete, small = false }: { routine: Routine; onDuplicate: () => void; onDelete: () => void; small?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("More for {name}", { name: r.name })}
        className={`glass-icon flex shrink-0 items-center justify-center rounded-full text-text ${small ? "size-10" : "size-11"}`}
      >
        <MoreHorizontal aria-hidden="true" size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={r.name}>
        <div className="flex flex-col gap-2">
          <Link
            href={routineEditPath(r.id)}
            aria-label={t("Edit {name}", { name: r.name })}
            className="raised flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold"
          >
            <Pencil aria-hidden="true" size={18} /> {t("Edit")}
          </Link>
          <Button
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
            aria-label={t("Duplicate {name}", { name: r.name })}
            className="min-h-12 !justify-start gap-3 px-4"
          >
            <Copy aria-hidden="true" size={18} /> {t("Duplicate")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            aria-label={t("Delete {name}", { name: r.name })}
            className="min-h-12 !justify-start gap-3 px-4"
          >
            <Trash2 aria-hidden="true" size={18} /> {t("Delete")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** Focus pill, rough minutes and exercise count, as on a template card. */
export function SummaryMeta({ sum, count }: { sum: RoutineSummary; count: number }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      {sum.focus && (
        <span className="rounded-full border border-ink/10 px-2 py-px text-[10px] font-semibold text-text-muted">
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
  return (
    <LiftList
      items={sum.lines.map((l) => ({
        name: byId[l.exerciseId]?.name ?? t("Removed exercise"),
        detail: l.reps ? `${l.sets}×${l.reps}` : t("{n} sets", { n: l.sets }),
        superset: !!l.superset,
      }))}
    />
  );
}

/**
 * The lifts folded away under one quiet row (owner, 2026-11-15: a simpler card). Opened, each
 * lift is a line: its name, and sets × reps on the right (SS for a superset). A native
 * <details>, so it opens by tap, keyboard or screen reader without any script.
 */
export function LiftList({ items, open }: { items: { name: string; detail: string; superset?: boolean }[]; open?: boolean }) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <details open={open} className="group mt-3 border-t border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 pt-1 text-sm font-semibold text-text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        {t("See exercises")}
        <ChevronDown aria-hidden="true" size={18} className="transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <ol aria-label={t("Exercises")} className="flex flex-col divide-y divide-line pb-1 text-sm">
        {items.map((l, i) => (
          <li key={i} className="flex min-h-9 items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate">{l.name}</span>
            <span className="num shrink-0 text-text-muted">
              {l.superset && <span className="mr-1.5 rounded-full bg-accent-tint px-1.5 py-px text-[11px] font-bold text-text">SS</span>}
              {l.detail}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
