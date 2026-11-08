"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { Routine } from "@/types/workout";
import { SUPERSET_COLORS, supersetLabels } from "@/lib/superset";

/** Exercises listed on a routine card before "+N more". */
const CARD_PREVIEW = 5;
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { TemplateVault } from "@/components/routines/TemplateVault";

export default function RoutinesPage() {
  return (
    <HydrationGate>
      <RoutinesScreen />
    </HydrationGate>
  );
}

function RoutinesScreen() {
  const router = useRouter();
  const routines = useRoutineStore((s) => s.routines);
  const { create, remove, duplicate } = useRoutineStore();
  const active = useWorkoutStore((s) => s.active);
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  const { byId } = useAllExercises();

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Routine | null>(null);
  const [startBlocked, setStartBlocked] = useState<Routine | null>(null);
  // Someone with no routines yet lands on the templates.
  const [tab, setTab] = useState<"mine" | "vault">(() => (routines.length > 0 ? "mine" : "vault"));

  const folders = new Map<string, Routine[]>();
  for (const r of [...routines].sort((a, b) => a.name.localeCompare(b.name))) {
    const key = r.folder?.trim() || "";
    folders.set(key, [...(folders.get(key) ?? []), r]);
  }
  const folderNames = [...folders.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const existingFolders = folderNames.filter(Boolean);

  function start(r: Routine) {
    if (active) {
      setStartBlocked(r);
      return;
    }
    startFromRoutine(r);
    router.push("/workout");
  }

  function submitNew() {
    const name = newName.trim();
    if (!name) {
      setNameError("Give the routine a name, like Push A or Leg day");
      return;
    }
    const r = create(name, newFolder.trim() || undefined);
    setNewOpen(false);
    setNewName("");
    setNewFolder("");
    router.push(`/routines/${r.id}/edit`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title="Routines"
        action={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Plus aria-hidden="true" size={18} /> New routine
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-4 pt-3">
        <Tabs
          id="routines"
          label="Routines"
          tabs={[
            { value: "mine", label: "My Routines" },
            { value: "vault", label: "Template Vault" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "mine" ? (
        <div {...tabPanelProps("routines", "mine")} className="flex flex-col gap-6 outline-none">
          {routines.length === 0 && (
            <p className="panel px-4 py-8 text-center text-sm text-text-muted">
              No routines saved. Create one, add its exercises and target sets, and you can start the same
              workout in one tap next time.
            </p>
          )}

          {folderNames.map((folder) => (
            <section key={folder || "__none"} aria-labelledby={`folder-${folder || "none"}`}>
              <h2 id={`folder-${folder || "none"}`} className="text-sm font-semibold uppercase text-text-muted">
                {folder || (folderNames.length > 1 ? "No folder" : "All routines")}
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {folders.get(folder)!.map((r) => {
                  const setCount = r.exercises.reduce((n, e) => n + e.sets.length, 0);
                  const ss = supersetLabels(r.exercises);
                  const ssCount = new Set(Object.values(ss).map((x) => x.letter)).size;
                  const shown = r.exercises.slice(0, CARD_PREVIEW);
                  const more = r.exercises.length - shown.length;
                  return (
                    <li key={r.id} className="panel p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold">{r.name}</h3>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {r.exercises.length === 0
                              ? "No exercises yet"
                              : `${r.exercises.length} ${r.exercises.length === 1 ? "exercise" : "exercises"} · ${setCount} sets${
                                  ssCount ? ` · ${ssCount} ${ssCount === 1 ? "superset" : "supersets"}` : ""
                                }`}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <Link
                            href={`/routines/${r.id}/edit`}
                            aria-label={`Edit ${r.name}`}
                            className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
                          >
                            <Pencil aria-hidden="true" size={18} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => duplicate(r.id)}
                            aria-label={`Duplicate ${r.name}`}
                            className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
                          >
                            <Copy aria-hidden="true" size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(r)}
                            aria-label={`Delete ${r.name}`}
                            className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-failure/10 hover:text-failure"
                          >
                            <Trash2 aria-hidden="true" size={18} />
                          </button>
                        </div>
                      </div>
                      {shown.length > 0 && (
                        <ol aria-label={`Exercises in ${r.name}`} className="mt-2 flex flex-col gap-0.5">
                          {shown.map((e) => {
                            const label = ss[e.id];
                            const color = label ? SUPERSET_COLORS[label.color] : undefined;
                            return (
                              <li
                                key={e.id}
                                // Superset members carry the same coloured edge and letter as in the workout.
                                style={color ? { borderLeftColor: color } : undefined}
                                className={`flex items-center gap-2 text-sm text-text-muted ${label ? "border-l-2 pl-2" : ""}`}
                              >
                                <span className="min-w-0 truncate">{byId[e.exerciseId]?.name ?? "Removed exercise"}</span>
                                {label && (
                                  <span className="num shrink-0 text-[10px] font-semibold" style={{ color }}>
                                    Superset {label.letter}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                          {more > 0 && (
                            <li className="num text-xs text-text-muted">
                              +{more} more {more === 1 ? "exercise" : "exercises"}
                            </li>
                          )}
                        </ol>
                      )}
                      <Button
                        variant="primary"
                        onClick={() => start(r)}
                        disabled={r.exercises.length === 0}
                        className="mt-3 w-full"
                      >
                        Start {r.name}
                      </Button>
                      {r.exercises.length === 0 && (
                        <p className="mt-1 text-center text-xs text-text-muted">Add an exercise before starting.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        ) : (
          <div {...tabPanelProps("routines", "vault")} className="outline-none">
            <TemplateVault onStart={start} />
          </div>
        )}
      </div>

      <Sheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New routine"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitNew}>
              Create and add exercises
            </Button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitNew();
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="routine-name" className="mb-1 block text-sm font-semibold">
              Name
            </label>
            <input
              id="routine-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "routine-name-error" : undefined}
              placeholder="Push A"
              autoFocus
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted/70"
            />
            {nameError && (
              <p id="routine-name-error" role="alert" className="mt-1 text-xs text-failure">
                {nameError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="routine-folder" className="mb-1 block text-sm font-semibold">
              Folder <span className="font-normal text-text-muted">(optional, e.g. Push / Pull / Legs)</span>
            </label>
            <input
              id="routine-folder"
              list="routine-folders"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Push / Pull / Legs"
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted/70"
            />
            <datalist id="routine-folders">
              {existingFolders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <button type="submit" className="sr-only">
            Create
          </button>
        </form>
      </Sheet>

      <Sheet
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "routine"}?`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setToDelete(null)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (toDelete) remove(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Workouts you already logged from it are kept. Only the template is deleted.
        </p>
      </Sheet>

      <Sheet
        open={startBlocked !== null}
        onClose={() => setStartBlocked(null)}
        title="A workout is already in progress"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setStartBlocked(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => router.push("/workout")}>
              Go to current workout
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Finish or discard the current workout before starting {startBlocked?.name}.
        </p>
      </Sheet>
    </main>
  );
}
