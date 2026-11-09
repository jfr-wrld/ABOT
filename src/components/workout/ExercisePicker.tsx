"use client";

import { useId, useMemo, useState } from "react";
import type { Exercise, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleTags } from "@/components/exercise/MuscleTags";
import { useT } from "@/i18n";
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
}: {
  title?: string;
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
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("Search by name or equipment")}
        autoComplete="off"
        className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
      />

      <div className="-mx-4 mt-3 overflow-x-auto px-4" role="group" aria-label={t("Filter by muscle")}>
        <div className="flex w-max gap-1.5 pb-1">
          <FilterChip pressed={muscle === null} onClick={() => setMuscle(null)}>
            {t("All")}
          </FilterChip>
          {MUSCLES.map((m) => (
            <FilterChip key={m} pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {muscleText(MUSCLE_GROUP_LABELS[m], t)}
            </FilterChip>
          ))}
        </div>
      </div>

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
        <ul className="mt-2 flex flex-col">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  useExerciseStore.getState().adopt(e);
                  onPick(e);
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1 text-left hover:bg-surface-2 active:bg-ink/[0.08]"
              >
                <ExerciseThumb exercise={e} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.name}</span>
                  <MuscleTags exercise={e} />
                </span>
                {inWorkout.has(e.id) && (
                  <span className="shrink-0 text-xs text-text-muted">{t("In workout")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
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
      className={`h-9 shrink-0 rounded-ctl border px-3 text-sm font-medium transition-colors ${
        pressed
          ? "border-accent bg-accent-tint text-text"
          : "border-line-strong bg-surface-2 text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
