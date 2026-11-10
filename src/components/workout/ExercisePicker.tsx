"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Exercise, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleTags } from "@/components/exercise/MuscleTags";
import { useT } from "@/i18n";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { ViewToggle, useViewMode, type ViewMode } from "@/components/ui/ViewToggle";
import { muscleText } from "@/lib/home";

const MUSCLES: MuscleGroup[] = [
  "chest", "back", "lats", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "abs", "traps", "forearms", "lower_back",
];

export function ExercisePicker({
  open,
  onClose,
  onPick,
  inWorkout = new Set<string>(),
  title,
  suggestions = [],
  suggestionsTitle,
}: {
  title?: string;
  /**
   * Shown above the library while nothing is searched or filtered: similar exercises when
   * replacing one, the muscles still to train today when adding one. `note` says why.
   */
  suggestions?: { exercise: Exercise; note: string }[];
  suggestionsTitle?: string;
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  /** Exercise ids already in the current workout, so they can be marked. */
  inWorkout?: Set<string>;
}) {
  const t = useT();
  const { list } = useAllExercises();
  const searchId = `exercise-search-${useId()}`;
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [view, setView] = useViewMode("picker");
  const pick = (e: Exercise) => {
    useExerciseStore.getState().adopt(e);
    onPick(e);
  };
  // Each opening starts clean, so the suggestions show and an old search does not hide the list.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setQuery("");
      setMuscle(null);
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (e) =>
        (!muscle || e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle)) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          EQUIPMENT_LABELS[e.equipment].toLowerCase().includes(q) ||
          t(EQUIPMENT_LABELS[e.equipment]).toLowerCase().includes(q)),
    );
  }, [list, query, muscle, t]);

  return (
    <Sheet open={open} onClose={onClose} title={title ?? t("Add exercise")}>
      <label htmlFor={searchId} className="sr-only">
        {t("Search exercises")}
      </label>
      <div className="flex gap-2">
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Name or equipment")}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4" role="group" aria-label={t("Filter by muscle")}>
        <div className="flex w-max gap-1.5 pb-1">
          <FilterChip pressed={muscle === null} onClick={() => setMuscle(null)}>
            <MuscleIcon size={20} />
            {t("All")}
          </FilterChip>
          {MUSCLES.map((m) => (
            <FilterChip key={m} pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              <MuscleIcon muscle={m} size={20} />
              {muscleText(MUSCLE_GROUP_LABELS[m], t)}
            </FilterChip>
          ))}
        </div>
      </div>

      {suggestions.length > 0 && !query.trim() && !muscle && (
        <section aria-label={suggestionsTitle} className="mt-3">
          <h3 className="label-caps px-2">{suggestionsTitle}</h3>
          <ul className="mt-1 flex flex-col">
            {suggestions.map(({ exercise: e, note }) => (
              <li key={e.id}>
                <PickRow exercise={e} view="list" onPick={pick} note={note} accent />
              </li>
            ))}
          </ul>
          <h3 className="label-caps mt-3 px-2">{t("All exercises")}</h3>
        </section>
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">
          {muscle
            ? t("No exercise matches “{query}” in {muscle}. Try another name, or clear the filter.", {
                query,
                muscle: muscleText(MUSCLE_GROUP_LABELS[muscle], t),
              })
            : t("No exercise matches “{query}”. Try another name, or clear the filter.", { query })}
        </p>
      ) : (
        <ul className={view === "grid" ? "mt-2 grid grid-cols-2 gap-2" : "mt-2 flex flex-col"}>
          {filtered.map((e) => (
            <li key={e.id}>
              <PickRow exercise={e} view={view} onPick={pick} note={inWorkout.has(e.id) ? t("In workout") : undefined} />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/**
 * One exercise to pick. List: a 64 px photo beside the name. Grid: the photo fills a square tile,
 * for telling similar lifts apart by how they look.
 */
function PickRow({ exercise: e, view, onPick, note, accent = false }: { exercise: Exercise; view: ViewMode; onPick: (e: Exercise) => void; note?: string; accent?: boolean }) {
  if (view === "grid") {
    return (
      <button
        type="button"
        onClick={() => onPick(e)}
        className="tap flex h-full w-full flex-col gap-1.5 rounded-card border border-line bg-surface p-1.5 text-left hover:border-line-hover active:bg-surface-2"
      >
        <span className="block aspect-square overflow-hidden rounded-lg [&>span]:!size-full [&>span]:!rounded-none [&>span]:!border-0">
          <ExerciseThumb exercise={e} size={64} />
        </span>
        <span className="line-clamp-2 px-0.5 text-sm font-semibold leading-snug">{e.name}</span>
        {note && <span className="px-0.5 text-xs text-text-muted">{note}</span>}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onPick(e)}
      className="flex min-h-[76px] w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2 active:bg-ink/[0.08]"
    >
      <ExerciseThumb exercise={e} size={64} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{e.name}</span>
        {accent && note ? <span className="block truncate text-xs text-accent">{note}</span> : <MuscleTags exercise={e} />}
      </span>
      {!accent && note && <span className="shrink-0 text-xs text-text-muted">{note}</span>}
    </button>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-ctl border pl-2 pr-3 text-sm font-medium transition-colors ${
        pressed
          ? "border-accent bg-accent-tint text-text"
          : "border-line-strong bg-surface-2 text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
