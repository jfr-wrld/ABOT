"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import type { Equipment, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, primaryMusclesLabel } from "@/types/workout";
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

  const prTable = useMemo(() => buildPRTable(sessions, byId, { allGyms: true }), [sessions, byId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (e) =>
        (!muscle || e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle)) &&
        (!equipment || e.equipment === equipment) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [list, query, muscle, equipment]);

  const select = "h-11 min-w-0 flex-1 rounded-ctl border border-line-strong bg-surface-2 px-2 text-sm text-text";

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
          <select id="lib-muscle" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup | "")} className={select}>
            <option value="">All muscles</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_GROUP_LABELS[m]}
              </option>
            ))}
          </select>
          <label htmlFor="lib-equipment" className="sr-only">
            Equipment
          </label>
          <select
            id="lib-equipment"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment | "")}
            className={select}
          >
            <option value="">All equipment</option>
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>
                {EQUIPMENT_LABELS[eq]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CatalogSection />

      {filtered.length === 0 ? (
        <p className="mx-4 mt-4 rounded-card bg-surface px-4 py-8 text-center text-sm text-text-muted">
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
                  className="flex min-h-14 items-center justify-between gap-3 rounded-ctl px-2 hover:bg-surface active:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {e.name}
                      {e.isCustom && <span className="ml-2 text-xs font-normal text-text-muted">custom</span>}
                      {e.isCatalog && <span className="ml-2 text-xs font-normal text-text-muted">catalog</span>}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {primaryMusclesLabel(e)} · {EQUIPMENT_LABELS[e.equipment]}
                      {pr && ` · best ${pr.weightKg} kg × ${pr.reps}`}
                    </span>
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
