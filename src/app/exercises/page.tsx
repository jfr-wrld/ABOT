"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import Link from "next/link";
import { ChevronRight, PersonStanding, Plus } from "lucide-react";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleTags } from "@/components/exercise/MuscleTags";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { muscleForRegion, worksArea } from "@/components/anatomy/regions";
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
  const catalogCount = list.filter((e) => e.isCatalog).length;
  const addCustom = useExerciseStore((s) => s.addCustom);
  const sessions = useWorkoutStore((s) => s.sessions);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | "">("");
  const [equipment, setEquipment] = useState<Equipment | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const prTable = useMemo(() => buildPRTable(sessions, byId, { allGyms: true }), [sessions, byId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (e) =>
        (!muscle || worksArea([...e.primaryMuscles, ...e.secondaryMuscles], muscle)) &&
        (!equipment || e.equipment === equipment) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [list, query, muscle, equipment]);


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title="Exercises"
        subtitle={
          catalogCount > 0
            ? `${list.length - catalogCount} in your library, ${catalogCount} from the catalog`
            : `${list.length} in your library`
        }
        action={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden="true" size={18} /> New
          </Button>
        }
      />

      <div className="px-4 pt-4">
        <label htmlFor="lib-search" className="sr-only">
          Search exercises
        </label>
        <input
          id="lib-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          autoComplete="off"
          className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted/70"
        />
        <div className="mt-2 flex gap-2">
          <label htmlFor="lib-muscle" className="sr-only">
            Muscle group
          </label>
          <Select
            id="lib-muscle"
            value={muscle}
            onChange={setMuscle}
            options={[{ value: "", label: "All muscles" }, ...MUSCLES.map((m) => ({ value: m, label: MUSCLE_GROUP_LABELS[m] }))]}
            className="flex-1"
          />
          <label htmlFor="lib-equipment" className="sr-only">
            Equipment
          </label>
          <Select
            id="lib-equipment"
            value={equipment}
            onChange={setEquipment}
            options={[{ value: "", label: "All equipment" }, ...EQUIPMENT.map((eq) => ({ value: eq, label: EQUIPMENT_LABELS[eq] }))]}
            className="flex-1"
          />
        </div>
        <button
          type="button"
          aria-expanded={mapOpen}
          aria-controls="lib-bodymap"
          onClick={() => setMapOpen((o) => !o)}
          className={`mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-ctl border text-sm font-semibold transition-colors ${
            mapOpen ? "border-accent/50 bg-accent-tint text-text" : "border-white/[0.12] text-text-muted hover:border-white/25 hover:text-text"
          }`}
        >
          <PersonStanding aria-hidden="true" size={16} />
          Body map
        </button>
        {mapOpen && (
          <div id="lib-bodymap" className="panel mt-2 p-3">
            <p className="mb-2 text-center text-xs text-text-muted">Tap a muscle to see the exercises that train it. Tap it again to clear.</p>
            <MuscleMap
              primary={muscle ? [muscle] : []}
              width={300}
              onSelectRegion={(r) => {
                const m = muscleForRegion(r);
                setMuscle((cur) => (cur === m ? "" : m));
              }}
            />
          </div>
        )}
      </div>

      <CatalogSection />

      {filtered.length === 0 ? (
        <p className="mx-4 mt-4 panel px-4 py-8 text-center text-sm text-text-muted">
          No exercise matches these filters. Clear a filter, or add it as a new exercise with the button above.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col px-2">
          {filtered.map((e) => {
            const pr = prTable[e.id]?.heaviest_weight;
            return (
              <li key={e.id}>
                <Link
                  href={`/exercises/${e.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-1 hover:bg-surface active:bg-surface-2"
                >
                  <ExerciseThumb exercise={e} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {e.name}
                      {e.isCustom && <span className="ml-2 text-xs font-normal text-text-muted">custom</span>}
                      {e.isCatalog && <span className="ml-2 text-xs font-normal text-text-muted">catalog</span>}
                    </span>
                    <MuscleTags exercise={e} />
                    {pr && (
                      <span className="num mt-0.5 block text-[11px] text-text-muted">
                        Best {pr.weightKg} kg × {pr.reps}
                      </span>
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
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
