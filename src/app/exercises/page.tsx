"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { worksArea } from "@/components/anatomy/regions";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import type { Equipment, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
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
  // The extended library is part of ABOT; only the optional download counts as "catalog".
  const catalogCount = list.filter((e) => e.isCatalog && !isAtlas(e)).length;
  const addCustom = useExerciseStore((s) => s.addCustom);
  const sessions = useWorkoutStore((s) => s.sessions);
  const [query, setQuery] = useState("");
  // The field follows every key; the list of about 1,000 rows filters a beat behind it.
  const search = useDeferredValue(query);
  const [muscle, setMuscle] = useState<MuscleGroup | "">("");
  const [equipment, setEquipment] = useState<Equipment | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const t = useT();

  const prTable = useMemo(() => buildPRTable(sessions, byId, { allGyms: true }), [sessions, byId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        (!muscle || worksArea([...e.primaryMuscles, ...e.secondaryMuscles], muscle)) &&
        (!equipment || e.equipment === equipment) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [list, search, muscle, equipment]);

  // One section per muscle, in the dropdown's order; an exercise sits under its first primary muscle.
  const [view, setView] = useViewMode("exercises");
  const groups = useMemo(() => {
    const by = new Map<MuscleGroup, typeof filtered>();
    for (const e of filtered) {
      const m = e.primaryMuscles[0] ?? "full_body";
      by.set(m, [...(by.get(m) ?? []), e]);
    }
    return MUSCLES.filter((m) => by.has(m)).map((m) => ({ muscle: m, items: by.get(m)! }));
  }, [filtered]);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={t("Exercises")}
        subtitle={
          catalogCount > 0
            ? t("{mine} in your library, {catalog} from the catalog", { mine: list.length - catalogCount, catalog: catalogCount })
            : t("{n} in your library", { n: list.length })
        }
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
            placeholder={t("Search by name")}
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
      </div>

      {filtered.length === 0 ? (
        <p className="mx-4 mt-4 panel px-4 py-8 text-center text-sm text-text-muted">
          {t("No exercise matches these filters. Clear a filter, or add it as a new exercise with the button above.")}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {groups.map(({ muscle: m, items }) => (
            <section key={m} aria-labelledby={`group-${m}`}>
              {/* Sticky so the muscle stays named while its list scrolls. */}
              <h2
                id={`group-${m}`}
                className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center justify-between bg-bg/95 px-4 py-2 backdrop-blur-sm"
              >
                <span className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface">
                    <MuscleIcon muscle={m} size={28} />
                  </span>
                  <span className="text-sm font-bold">{muscleLabel(m, t)}</span>
                </span>
                <span className="num text-xs text-text-muted">{items.length}</span>
              </h2>
              <ul className={view === "grid" ? "grid grid-cols-2 gap-2 px-4 sm:grid-cols-3" : "flex flex-col px-2"}>
                {items.map((e) => {
                  const pr = prTable[e.id]?.heaviest_weight;
                  if (view === "grid") {
                    return (
                      <li key={e.id}>
                        <Link
                          href={exercisePath(e.id)}
                          className="tap flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-2 hover:border-line-hover active:bg-surface-2"
                        >
                          {/* The photo fills the card's width. */}
                          <span className="block aspect-square overflow-hidden rounded-lg [&>span]:!size-full [&>span]:!rounded-none [&>span]:!border-0">
                            <ExerciseThumb exercise={e} size={44} />
                          </span>
                          <span className="line-clamp-2 px-0.5 text-sm font-semibold leading-snug">{e.name}</span>
                          <span className="mt-auto px-0.5 text-xs text-text-muted">
                            {t(EQUIPMENT_LABELS[e.equipment])}
                            {pr && ` · ${pr.weightKg} kg`}
                          </span>
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={e.id}>
                      <Link
                        href={exercisePath(e.id)}
                        className="tap flex min-h-16 items-center gap-3 rounded-xl px-2 py-1 hover:bg-surface active:bg-surface-2"
                      >
                        <ExerciseThumb exercise={e} size={52} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {e.name}
                            {e.isCustom && <span className="ml-2 text-xs font-normal text-text-muted">{t("custom")}</span>}
                            {e.isCatalog && !isAtlas(e) && <span className="ml-2 text-xs font-normal text-text-muted">{t("catalog")}</span>}
                          </span>
                          <span className="block text-xs text-text-muted">
                            {muscleNames(e.primaryMuscles, t)} · {t(EQUIPMENT_LABELS[e.equipment])}
                            {pr && ` · ${t("best {weight} kg × {reps}", { weight: pr.weightKg, reps: pr.reps })}`}
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
                      </Link>
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
