"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import Link from "next/link";
import { Plus, Star, X } from "lucide-react";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import type { Equipment, Exercise, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { filterExercises } from "@/lib/exercise-search";
import { exerciseUsage } from "@/lib/exercise-usage";
import { formatWeight } from "@/lib/units";
import { FavoriteButton, useFavorites } from "@/components/exercise/FavoriteButton";
import { SORT_LABEL, type LibrarySort } from "@/components/exercises/labels";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { CatalogSection } from "@/components/exercises/CatalogSection";
import { buildPRTable } from "@/lib/calc";
import { exercisePath } from "@/lib/routes";
import { isAtlas } from "@/data/atlas";
import { useT } from "@/i18n";
import { muscleLabel, muscleNames } from "@/components/exercise/MuscleTags";
import { ViewToggle, useViewMode } from "@/components/ui/ViewToggle";

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
  // The extended library is part of ABOT; only the optional download counts separately.
  const downloaded = list.filter((e) => e.isCatalog && !isAtlas(e)).length;
  const addCustom = useExerciseStore((s) => s.addCustom);
  const sessions = useWorkoutStore((s) => s.sessions);
  const unit = useSettingsStore((s) => s.weightUnit);
  const { favorites } = useFavorites();
  const [query, setQuery] = useState("");
  // The field follows every key; the list of about 1,000 rows filters a beat behind it.
  const search = useDeferredValue(query);
  const [muscle, setMuscle] = useState<MuscleGroup | "">("");
  const [equipment, setEquipment] = useState<Equipment | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const [sort, setSort] = useLibrarySort();
  const [view, setView] = useViewMode("exercises");
  const t = useT();

  const prTable = useMemo(() => buildPRTable(sessions, byId, { allGyms: true }), [sessions, byId]);
  const usage = useMemo(() => exerciseUsage(sessions), [sessions]);
  const filtered = useMemo(
    () => filterExercises(list, { query: search, muscle, equipment }, { favorites, uses: usage.uses }),
    [list, search, muscle, equipment, favorites, usage],
  );
  const searching = search.trim().length > 0;
  const filtering = searching || muscle !== "" || equipment !== "";
  const clear = () => {
    setQuery("");
    setMuscle("");
    setEquipment("");
  };

  // A search shows one ranked list. Otherwise: favourites first, then the chosen order.
  const sections = useMemo((): { key: string; title: string; muscle?: MuscleGroup; items: Exercise[] }[] => {
    if (searching) return [{ key: "results", title: t("Results"), items: filtered }];
    const favs = filtered.filter((e) => favorites.has(e.id));
    const out: { key: string; title: string; muscle?: MuscleGroup; items: Exercise[] }[] = favs.length ? [{ key: "favorites", title: t("Favorites"), items: favs }] : [];
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
  }, [filtered, favorites, searching, sort, usage, t]);

  const best = (e: Exercise) => prTable[e.id]?.heaviest_weight;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={t("Exercises")}
        subtitle={downloaded > 0 ? t("{n} exercises, {k} downloaded", { n: list.length, k: downloaded }) : t("{n} exercises", { n: list.length })}
        action={
          <div className="flex shrink-0 gap-2">
            <CatalogSection />
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden="true" size={18} /> {t("New")}
            </Button>
          </div>
        }
      />

      <div className="px-4 pt-4">
        <label htmlFor="lib-search" className="sr-only">
          {t("Search exercises")}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="lib-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Name, muscle or equipment")}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
          />
          <ViewToggle value={view} onChange={setView} />
        </div>
        <div className="mt-2 flex gap-2">
          <label htmlFor="lib-muscle" className="sr-only">
            {t("Muscle group")}
          </label>
          <Select
            id="lib-muscle"
            value={muscle}
            onChange={setMuscle}
            options={[
              { value: "", label: t("All muscles"), icon: <MuscleIcon /> },
              ...MUSCLES.map((m) => ({ value: m, label: muscleLabel(m, t), icon: <MuscleIcon muscle={m} /> })),
            ]}
            className="flex-1"
          />
          <label htmlFor="lib-equipment" className="sr-only">
            {t("Equipment")}
          </label>
          <Select
            id="lib-equipment"
            value={equipment}
            onChange={setEquipment}
            options={[
              { value: "", label: t("All equipment"), icon: <EquipmentIcon /> },
              ...EQUIPMENT.map((eq) => ({ value: eq, label: t(EQUIPMENT_LABELS[eq]), icon: <EquipmentIcon equipment={eq} /> })),
            ]}
            className="flex-1"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {!searching ? (
            <div className="flex items-center gap-2">
              <label htmlFor="lib-sort" className="text-xs text-text-muted">
                {t("Order")}
              </label>
              <Select id="lib-sort" value={sort} onChange={setSort} options={SORTS.map((v) => ({ value: v, label: t(SORT_LABEL[v]) }))} />
            </div>
          ) : (
            <p className="text-xs text-text-muted" role="status">
              {t.n(filtered.length, "{n} match", "{n} matches")}
            </p>
          )}
          {filtering && (
            <Button variant="ghost" onClick={clear} className="shrink-0">
              <X aria-hidden="true" size={16} />
              {t("Clear filters")}
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mx-4 mt-4 panel flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm text-text-muted">{t("No exercise matches these filters.")}</p>
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
                            <ExerciseThumb exercise={e} size={128} />
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

/** "Custom" for the lifter's own, "Downloaded" for the optional catalog: bordered, so they read. */
function Badges({ exercise: e }: { exercise: Exercise }) {
  const t = useT();
  const label = e.isCustom ? t("Custom") : e.isCatalog && !isAtlas(e) ? t("Downloaded") : null;
  if (!label) return null;
  return <span className="shrink-0 rounded-full border border-line-strong px-1.5 py-px text-[11px] font-semibold text-text-muted">{label}</span>;
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
