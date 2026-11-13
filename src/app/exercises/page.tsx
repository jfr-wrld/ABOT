"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { feedback } from "@/lib/feedback";
import { useActionBarSpace } from "@/components/layout/useActionBarSpace";
import { useHideOnScroll } from "@/lib/useHideOnScroll";
import { useSessionState } from "@/lib/useSessionState";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import type { Equipment, Exercise, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { filterExercises, shownWithoutSearch } from "@/lib/exercise-search";
import { hasPhoto } from "@/lib/exercise-photo";
import { exerciseUsage } from "@/lib/exercise-usage";
import { formatWeight } from "@/lib/units";
import { FavoriteButton, useFavorites } from "@/components/exercise/FavoriteButton";
import { SORT_LABEL, type LibrarySort } from "@/components/exercises/labels";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { buildPRTable } from "@/lib/calc";
import { exercisePath } from "@/lib/routes";
import { useT } from "@/i18n";
import { muscleLabel, muscleNames } from "@/components/exercise/MuscleTags";
import { useViewMode, type ViewMode } from "@/components/ui/ViewToggle";

const MUSCLES = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export default function ExercisesPage() {
  return (
    <HydrationGate>
      <LibraryScreen />
    </HydrationGate>
  );
}

function LibraryScreen() {
  const { list, byId } = useAllExercises();
  const addCustom = useExerciseStore((s) => s.addCustom);
  const sessions = useWorkoutStore((s) => s.sessions);
  const unit = useSettingsStore((s) => s.weightUnit);
  const { favorites } = useFavorites();
  // Search and filters last the session: Back from an exercise returns to the same list, so the
  // scroll offset ScrollMemory puts back lands on the same rows.
  const [query, setQuery] = useSessionState("abot.lib.query", "");
  // The field follows every key; the list of about 1,000 rows filters a beat behind it.
  const search = useDeferredValue(query);
  const [muscle, setMuscle] = useSessionState<MuscleGroup | "">("abot.lib.muscle", "");
  const [favoritesOnly, setFavoritesOnly] = useSessionState("abot.lib.favorites", false);
  const [equipment, setEquipment] = useSessionState<Equipment | "">("abot.lib.equipment", "");
  const [formOpen, setFormOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useLibrarySort();
  const [view, setView] = useViewMode("exercises");
  const t = useT();
  // The workout capsule, when one is running, rises above the floating button instead of covering it.
  useActionBarSpace(60);
  const scrollingDown = useHideOnScroll();
  const buttonHidden = scrollingDown && !sheetOpen;

  const prTable = useMemo(() => buildPRTable(sessions, byId, { allGyms: true }), [sessions, byId]);
  const usage = useMemo(() => exerciseUsage(sessions), [sessions]);
  // Browsing lists exercises with a real photo; favourites and anything already done stay listed.
  const keep = useMemo(() => new Set([...favorites, ...Object.keys(usage.uses)]), [favorites, usage]);
  const filtered = useMemo(() => {
    const rows = filterExercises(list, { query: search, muscle, equipment, photos: { keep } }, { favorites, uses: usage.uses });
    return favoritesOnly ? rows.filter((e) => favorites.has(e.id)) : rows;
  }, [list, search, muscle, equipment, favorites, usage, keep, favoritesOnly]);
  const browsable = useMemo(() => list.filter((e) => shownWithoutSearch(e, keep)).length, [list, keep]);
  const searching = search.trim().length > 0;
  const filtering = searching || muscle !== "" || equipment !== "" || favoritesOnly;
  // What the floating button counts: the choices that live in the sheet.
  const sheetChoices = (equipment !== "" ? 1 : 0) + (sort !== "muscle" ? 1 : 0);
  const clear = () => {
    setQuery("");
    setMuscle("");
    setFavoritesOnly(false);
    setEquipment("");
  };

  // A search shows one ranked list. Otherwise: favourites first, then the chosen order.
  const sections = useMemo((): { key: string; title: string; muscle?: MuscleGroup; items: Exercise[] }[] => {
    if (searching) return [{ key: "results", title: t("Results"), items: filtered }];
    const favs = filtered.filter((e) => favorites.has(e.id));
    const out: { key: string; title: string; muscle?: MuscleGroup; items: Exercise[] }[] = favs.length ? [{ key: "favorites", title: t("Favorites"), items: favs }] : [];
    // The Favorites pill: that one list, in the chosen order.
    if (favoritesOnly) {
      if (sort === "used") favs.sort((a, b) => (usage.uses[b.id] ?? 0) - (usage.uses[a.id] ?? 0) || a.name.localeCompare(b.name));
      else if (sort === "recent") favs.sort((a, b) => (usage.lastDone[b.id] ?? 0) - (usage.lastDone[a.id] ?? 0) || a.name.localeCompare(b.name));
      return out;
    }
    if (sort === "muscle") {
      const by = new Map<MuscleGroup, Exercise[]>();
      for (const e of filtered) {
        const m = e.primaryMuscles[0] ?? "full_body";
        by.set(m, [...(by.get(m) ?? []), e]);
      }
      for (const m of MUSCLES) if (by.has(m)) out.push({ key: m, title: muscleLabel(m, t), muscle: m, items: by.get(m)! });
      return out;
    }
    const sorted = [...filtered];
    if (sort === "used") sorted.sort((a, b) => (usage.uses[b.id] ?? 0) - (usage.uses[a.id] ?? 0) || a.name.localeCompare(b.name));
    else if (sort === "recent") sorted.sort((a, b) => (usage.lastDone[b.id] ?? 0) - (usage.lastDone[a.id] ?? 0) || a.name.localeCompare(b.name));
    out.push({ key: "all", title: t("All exercises"), items: sorted });
    return out;
  }, [filtered, favorites, favoritesOnly, searching, sort, usage, t]);

  const best = (e: Exercise) => prTable[e.id]?.heaviest_weight;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={t("Exercises")}
        subtitle={t("{n} exercises", { n: browsable.toLocaleString(t.locale) })}
        action={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden="true" size={18} /> {t("New")}
          </Button>
        }
      />

      <div className="px-4 pt-4">
        <label htmlFor="lib-search" className="sr-only">
          {t("Search exercises")}
        </label>
        <div className="relative">
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id="lib-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Name, muscle or equipment")}
            autoComplete="off"
            className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 pl-9 pr-3 text-base placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* What to show, one tap each: everything, the favourites, or one muscle. */}
      <div role="group" aria-label={t("Show")} className="mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Pill pressed={!favoritesOnly && muscle === ""} onClick={() => { setFavoritesOnly(false); setMuscle(""); }}>
          {t("All")}
        </Pill>
        <Pill pressed={favoritesOnly} onClick={() => { setFavoritesOnly(!favoritesOnly); setMuscle(""); }}>
          <Star aria-hidden="true" size={15} className="text-accent" fill={favoritesOnly ? "currentColor" : "none"} />
          {t("My favorites")}
        </Pill>
        {MUSCLES.map((m) => (
          <Pill key={m} pressed={muscle === m} onClick={() => { setMuscle(muscle === m ? "" : m); setFavoritesOnly(false); }}>
            <MuscleIcon muscle={m} size={20} />
            {muscleLabel(m, t)}
          </Pill>
        ))}
      </div>

      {(searching || filtering) && (
        <div className="flex min-h-11 items-center justify-between gap-2 px-4">
          <p className="text-xs text-text-muted" role="status">
            {t.n(filtered.length, "{n} match", "{n} matches")}
          </p>
          <Button variant="ghost" onClick={clear} className="shrink-0">
            <X aria-hidden="true" size={16} />
            {t("Clear filters")}
          </Button>
        </div>
      )}

      {/* Floats above the dock in the dock's own glass, and steps aside while the list scrolls
          down, coming back on any scroll up. Kept while its sheet is open, for focus to return. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        aria-label={sheetChoices ? t("Sort and filter, {n} set", { n: sheetChoices }) : t("Sort and filter")}
        aria-hidden={buttonHidden || undefined}
        tabIndex={buttonHidden ? -1 : undefined}
        data-hidden={buttonHidden}
        className={`liquid-glass fixed left-1/2 z-20 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full px-4 text-sm font-semibold text-text transition-[translate,opacity,scale] duration-200 ease-out active:scale-95 ${
          buttonHidden ? "pointer-events-none translate-y-[72px] opacity-0 motion-reduce:translate-y-0" : ""
        }`}
        style={{ bottom: "calc(var(--dock-h, 96px) - 4px + env(safe-area-inset-bottom))" }}
      >
        <SlidersHorizontal aria-hidden="true" size={16} className="text-accent" />
        {t("Sort & filter")}
        {sheetChoices > 0 && (
          <span aria-hidden="true" className="num flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
            {sheetChoices}
          </span>
        )}
      </button>
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        equipment={equipment}
        setEquipment={setEquipment}
        sort={sort}
        setSort={setSort}
        view={view}
        setView={setView}
        count={filtered.length}
        onReset={() => {
          setEquipment("");
          setSort("muscle");
        }}
      />

      {filtered.length === 0 ? (
        <div className="mx-4 mt-4 panel flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm text-text-muted">
            {favoritesOnly && favorites.size === 0 ? t("No favorites yet. Tap the star on an exercise to keep it here.") : t("No exercise matches these filters.")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={clear}>{t("Clear filters")}</Button>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" size={18} />
              {searching ? t("Create “{name}”", { name: search.trim() }) : t("New exercise")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {sections.map((sec) => (
            <section key={sec.key} aria-labelledby={`group-${sec.key}`}>
              {/* Sticky so the section stays named while its list scrolls. */}
              <h2
                id={`group-${sec.key}`}
                className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center justify-between bg-bg/95 px-4 py-2 backdrop-blur-sm"
              >
                <span className="flex items-center gap-2.5">
                  {sec.muscle && (
                    <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface">
                      <MuscleIcon muscle={sec.muscle} size={28} />
                    </span>
                  )}
                  {sec.key === "favorites" && <Star aria-hidden="true" size={16} className="text-accent" fill="currentColor" />}
                  <span className="text-sm font-bold">{sec.title}</span>
                </span>
                <span className="num text-xs text-text-muted">{sec.items.length}</span>
              </h2>
              <ul className={view === "grid" ? "grid grid-cols-2 gap-2 px-4 sm:grid-cols-3" : "flex flex-col px-2"}>
                {sec.items.map((e) => {
                  const pr = best(e);
                  if (view === "grid") {
                    return (
                      <li key={e.id} className="relative">
                        <Link
                          href={exercisePath(e.id)}
                          className="tap flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-2 hover:border-line-hover active:bg-surface-2"
                        >
                          {/* The photo fills the card's width, so it asks for a picture that size. */}
                          <span className="block aspect-square overflow-hidden rounded-lg [&>span]:!size-full [&>span]:!rounded-none [&>span]:!border-0">
                            {/* A fixed small badge: one in proportion would cover a third of the photo. */}
                            <ExerciseThumb exercise={e} size={128} badge={26} />
                          </span>
                          <span className="line-clamp-2 px-0.5 text-sm font-semibold leading-snug">{e.name}</span>
                          <span className="mt-auto flex flex-wrap items-center gap-1 px-0.5 text-xs text-text-muted">
                            <Badges exercise={e} />
                            {t(EQUIPMENT_LABELS[e.equipment])}
                            {pr && ` · ${formatWeight(pr.weightKg, unit)}`}
                          </span>
                        </Link>
                        <span className="absolute right-1 top-1">
                          <FavoriteButton id={e.id} name={e.name} tone="overlay" />
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={e.id} className="flex items-center">
                      <Link
                        href={exercisePath(e.id)}
                        className="tap flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 hover:bg-surface active:bg-surface-2"
                      >
                        <ExerciseThumb exercise={e} size={52} />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold">{e.name}</span>
                            <Badges exercise={e} />
                          </span>
                          <span className="block truncate text-xs text-text-muted">
                            {muscleNames(e.primaryMuscles, t)} · {t(EQUIPMENT_LABELS[e.equipment])}
                            {pr && ` · ${t("best {weight} × {reps}", { weight: formatWeight(pr.weightKg, unit), reps: pr.reps })}`}
                          </span>
                        </span>
                      </Link>
                      <FavoriteButton id={e.id} name={e.name} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {/* Room for the floating Sort & filter button, so the last row scrolls clear of it. */}
      <div aria-hidden="true" className="h-20" />

      {formOpen && (
        <ExerciseForm
          open={formOpen}
          initialName={searching ? search.trim() : undefined}
          onClose={() => setFormOpen(false)}
          onSave={(data) => {
            addCustom(data);
            setFormOpen(false);
          }}
        />
      )}
    </main>
  );
}

/** One choice in the Show row: All, My favorites, or a muscle. */
function Pill({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => {
        if (!pressed) feedback.tick();
        onClick();
      }}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
        pressed ? "border-text bg-text text-bg" : "border-line-strong bg-surface text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The choices made now and then, kept out of the way: equipment, order and list or grid. The
 * footer shows how many exercises the choices leave.
 */
function FilterSheet({
  open,
  onClose,
  equipment,
  setEquipment,
  sort,
  setSort,
  view,
  setView,
  count,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  equipment: Equipment | "";
  setEquipment: (e: Equipment | "") => void;
  sort: LibrarySort;
  setSort: (s: LibrarySort) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  count: number;
  onReset: () => void;
}) {
  const t = useT();
  const chip = (on: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-ctl border px-3 text-sm font-semibold transition-colors ${
      on ? "border-accent bg-accent-tint text-text" : "border-line-strong bg-surface-2 text-text-muted hover:text-text"
    }`;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Sort & filter")}
      footer={
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <Button variant="ghost" onClick={onReset}>
            {t("Reset")}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t.n(count, "Show {n} exercise", "Show {n} exercises")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section role="radiogroup" aria-label={t("Order")}>
          <h3 className="label-caps mb-2">{t("Order")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {SORTS.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={sort === v} onClick={() => setSort(v)} className={chip(sort === v)}>
                {t(SORT_LABEL[v])}
              </button>
            ))}
          </div>
        </section>
        <section role="radiogroup" aria-label={t("Equipment")}>
          <h3 className="label-caps mb-2">{t("Equipment")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {(["", ...EQUIPMENT] as (Equipment | "")[]).map((eq) => (
              <button key={eq || "all"} type="button" role="radio" aria-checked={equipment === eq} onClick={() => setEquipment(eq)} className={chip(equipment === eq)}>
                <EquipmentIcon equipment={eq || undefined} size={20} />
                {eq ? t(EQUIPMENT_LABELS[eq]) : t("All equipment")}
              </button>
            ))}
          </div>
        </section>
        <section role="radiogroup" aria-label={t("View")}>
          <h3 className="label-caps mb-2">{t("View")}</h3>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" role="radio" aria-checked={view === "list"} onClick={() => setView("list")} className={chip(view === "list")}>
              <List aria-hidden="true" size={18} />
              {t("List")}
            </button>
            <button type="button" role="radio" aria-checked={view === "grid"} onClick={() => setView("grid")} className={chip(view === "grid")}>
              <LayoutGrid aria-hidden="true" size={18} />
              {t("Grid")}
            </button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

const PILL = "shrink-0 rounded-full border border-line-strong px-1.5 py-px text-[11px] font-semibold text-text-muted";

/**
 * "Custom" on the lifter's own exercises; "No photo" on the few found only by searching, so the
 * missing picture reads as known, not broken. Bordered, so they read at a glance.
 */
function Badges({ exercise: e }: { exercise: Exercise }) {
  const t = useT();
  if (e.isCustom) return <span className={PILL}>{t("Custom")}</span>;
  if (!hasPhoto(e)) return <span className={PILL}>{t("No photo")}</span>;
  return null;
}

const SORTS: LibrarySort[] = ["muscle", "az", "used", "recent"];
const SORT_KEY = "abot.sort.exercises";

/** The library's order, remembered per device (a convenience, not training data). */
function useLibrarySort(): [LibrarySort, (v: LibrarySort) => void] {
  const [sort, setSort] = useState<LibrarySort>(() => {
    try {
      const v = localStorage.getItem(SORT_KEY);
      return SORTS.includes(v as LibrarySort) ? (v as LibrarySort) : "muscle";
    } catch {
      return "muscle";
    }
  });
  return [
    sort,
    (v) => {
      setSort(v);
      try {
        localStorage.setItem(SORT_KEY, v);
      } catch {
        // Without storage the order lasts until the page closes.
      }
    },
  ];
}
