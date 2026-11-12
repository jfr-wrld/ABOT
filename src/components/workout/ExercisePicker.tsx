"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import type { Equipment, Exercise, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleTags } from "@/components/exercise/MuscleTags";
import { useT } from "@/i18n";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { ViewToggle, useViewMode, type ViewMode } from "@/components/ui/ViewToggle";
import { muscleText } from "@/lib/home";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { useFavorites } from "@/components/exercise/FavoriteButton";
import { filterExercises } from "@/lib/exercise-search";
import { exerciseUsage, recentExercises } from "@/lib/exercise-usage";
import { useWorkoutStore } from "@/store/useWorkoutStore";

const MUSCLES = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
/** How many recent exercises lead the list. */
const RECENT = 8;

export function ExercisePicker({
  open,
  onClose,
  onPick,
  onPickMany,
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
  /**
   * Given, the picker also takes several at once: a check circle on each row selects it, and
   * the footer adds them all, in the order they were checked. A plain tap still adds one.
   */
  onPickMany?: (exercises: Exercise[]) => void;
  /** Exercise ids already in the current workout, so they can be marked. */
  inWorkout?: Set<string>;
}) {
  const t = useT();
  const { list, byId } = useAllExercises();
  const sessions = useWorkoutStore((s) => s.sessions);
  const { favorites } = useFavorites();
  const addCustom = useExerciseStore((s) => s.addCustom);
  const searchId = `exercise-search-${useId()}`;
  const [query, setQuery] = useState("");
  // The field follows every key; the long list filters a beat behind it.
  const search = useDeferredValue(query);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useViewMode("picker");
  const pick = (e: Exercise) => {
    useExerciseStore.getState().adopt(e);
    onPick(e);
  };
  const selecting = selected.length > 0;
  const isSelected = (e: Exercise) => selected.some((x) => x.id === e.id);
  const toggle = (e: Exercise) => setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]));
  // While some are checked, a tap on a row checks or unchecks it instead of adding it alone.
  const tap = (e: Exercise) => (onPickMany && selecting ? toggle(e) : pick(e));
  const addSelected = () => {
    for (const e of selected) useExerciseStore.getState().adopt(e);
    onPickMany?.(selected);
    setSelected([]);
  };
  const clear = () => {
    setQuery("");
    setMuscle(null);
    setEquipment(null);
  };
  // Each opening starts clean, so the suggestions show and an old search does not hide the list.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      clear();
      setSelected([]);
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  const usage = useMemo(() => exerciseUsage(sessions), [sessions]);
  const filtered = useMemo(
    () => filterExercises(list, { query: search, muscle, equipment }, { favorites, uses: usage.uses }),
    [list, search, muscle, equipment, favorites, usage],
  );
  const filtering = query.trim() !== "" || muscle !== null || equipment !== null;
  const favs = useMemo(() => list.filter((e) => favorites.has(e.id)), [list, favorites]);
  const recent = useMemo(() => recentExercises(sessions, RECENT).map((id) => byId[id]).filter((e): e is Exercise => !!e), [sessions, byId]);
  const rowProps = (e: Exercise) => ({
    exercise: e,
    onPick: tap,
    onToggle: onPickMany ? toggle : undefined,
    checked: isSelected(e),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? t("Add exercise")}
      footer={
        onPickMany && selecting ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => setSelected([])} className="shrink-0">
              {t("Clear")}
            </Button>
            <Button variant="primary" onClick={addSelected} className="flex-1">
              {t.n(selected.length, "Add {n} exercise", "Add {n} exercises")}
            </Button>
          </div>
        ) : undefined
      }
    >
      <label htmlFor={searchId} className="sr-only">
        {t("Search exercises")}
      </label>
      <div className="flex gap-2">
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Name, muscle or equipment")}
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
      <div className="-mx-4 mt-1.5 overflow-x-auto px-4" role="group" aria-label={t("Filter by equipment")}>
        <div className="flex w-max gap-1.5 pb-1">
          <FilterChip pressed={equipment === null} onClick={() => setEquipment(null)}>
            <EquipmentIcon size={18} />
            {t("All equipment")}
          </FilterChip>
          {EQUIPMENT.map((eq) => (
            <FilterChip key={eq} pressed={equipment === eq} onClick={() => setEquipment(equipment === eq ? null : eq)}>
              <EquipmentIcon equipment={eq} size={18} />
              {t(EQUIPMENT_LABELS[eq])}
            </FilterChip>
          ))}
        </div>
      </div>

      {!filtering && (
        <>
          {favs.length > 0 && <Shortlist title={t("Favorites")} items={favs} rowProps={rowProps} />}
          {recent.length > 0 && <Shortlist title={t("Recent")} items={recent} rowProps={rowProps} />}
          {suggestions.length > 0 && (
            <section aria-label={suggestionsTitle} className="mt-3">
              <h3 className="label-caps px-2">{suggestionsTitle}</h3>
              <ul className="mt-1 flex flex-col">
                {suggestions.map(({ exercise: e, note }) => (
                  <li key={e.id}>
                    <PickRow {...rowProps(e)} view="list" note={note} accent />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(favs.length > 0 || recent.length > 0 || suggestions.length > 0) && <h3 className="label-caps mt-3 px-2">{t("All exercises")}</h3>}
        </>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-text-muted">
            {query.trim() ? t("No exercise matches “{query}”.", { query: query.trim() }) : t("No exercise matches these filters.")}
          </p>
          <Button onClick={clear}>{t("Clear filters")}</Button>
        </div>
      ) : (
        <ul className={view === "grid" ? "mt-2 grid grid-cols-2 gap-2" : "mt-2 flex flex-col"}>
          {filtered.map((e) => (
            <li key={e.id}>
              <PickRow {...rowProps(e)} view={view} note={inWorkout.has(e.id) ? t("In workout") : undefined} />
            </li>
          ))}
        </ul>
      )}

      {query.trim() && (
        <Button onClick={() => setCreating(true)} className="mt-3 w-full">
          <Plus aria-hidden="true" size={18} />
          {t("Create “{name}”", { name: query.trim() })}
        </Button>
      )}

      {creating && (
        <ExerciseForm
          open
          initialName={query.trim()}
          onClose={() => setCreating(false)}
          onSave={(data) => {
            const made = addCustom(data);
            setCreating(false);
            pick(made);
          }}
        />
      )}
    </Sheet>
  );
}

type RowProps = { exercise: Exercise; onPick: (e: Exercise) => void; onToggle?: (e: Exercise) => void; checked: boolean };

/** Favourites or recent exercises above the full list, always as a list. */
function Shortlist({ title, items, rowProps }: { title: string; items: Exercise[]; rowProps: (e: Exercise) => RowProps }) {
  return (
    <section aria-label={title} className="mt-3">
      <h3 className="label-caps px-2">{title}</h3>
      <ul className="mt-1 flex flex-col">
        {items.map((e) => (
          <li key={e.id}>
            <PickRow {...rowProps(e)} view="list" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One exercise to pick. List: a 64 px photo beside the name. Grid: the photo fills a square tile,
 * for telling similar lifts apart by how they look. With `onToggle`, a 44 px check circle selects
 * the exercise for adding several at once.
 */
function PickRow({
  exercise: e,
  view,
  onPick,
  onToggle,
  checked,
  note,
  accent = false,
}: RowProps & { view: ViewMode; note?: string; accent?: boolean }) {
  const t = useT();
  const check = onToggle && (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={t("Select {name}", { name: e.name })}
      onClick={() => onToggle(e)}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${view === "grid" ? "absolute right-1 top-1" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
          checked ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-bg/70"
        }`}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
  if (view === "grid") {
    return (
      <div className="relative h-full">
        <button
          type="button"
          onClick={() => onPick(e)}
          className={`tap flex h-full w-full flex-col gap-1.5 rounded-card border bg-surface p-1.5 text-left hover:border-line-hover active:bg-surface-2 ${checked ? "border-accent" : "border-line"}`}
        >
          <span className="block aspect-square overflow-hidden rounded-lg [&>span]:!size-full [&>span]:!rounded-none [&>span]:!border-0">
            <ExerciseThumb exercise={e} size={128} />
          </span>
          <span className="line-clamp-2 px-0.5 text-sm font-semibold leading-snug">{e.name}</span>
          {note && <span className="px-0.5 text-xs text-text-muted">{note}</span>}
        </button>
        {check}
      </div>
    );
  }
  return (
    <div className={`flex items-center rounded-xl ${checked ? "bg-accent-tint" : ""}`}>
      <button
        type="button"
        onClick={() => onPick(e)}
        className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2 active:bg-ink/[0.08]"
      >
        <ExerciseThumb exercise={e} size={64} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{e.name}</span>
          {accent && note ? <span className="block truncate text-xs text-accent">{note}</span> : <MuscleTags exercise={e} />}
        </span>
        {!accent && note && <span className="shrink-0 text-xs text-text-muted">{note}</span>}
      </button>
      {check}
    </div>
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
