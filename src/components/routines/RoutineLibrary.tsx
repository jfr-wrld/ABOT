"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { Routine } from "@/types/workout";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { TemplateVault } from "@/components/routines/TemplateVault";
import { RoutineCard } from "@/components/routines/RoutineCard";
import { routineEditPath } from "@/lib/routes";
import { useT } from "@/i18n";

/**
 * The Workout tab when no workout is running: an empty start, then My Routines and the Template
 * Vault. Routines used to be their own tab; training starts here now.
 */
export function RoutineLibrary() {
  const router = useRouter();
  const routines = useRoutineStore((s) => s.routines);
  const { create, remove, duplicate } = useRoutineStore();
  const active = useWorkoutStore((s) => s.active);
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  const startEmpty = useWorkoutStore((s) => s.startEmpty);
  const defaultRest = useSettingsStore((s) => s.defaultRestSeconds);
  const { byId } = useAllExercises();
  const t = useT();

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
      setNameError(t("Give the routine a name, like Push A or Leg day"));
      return;
    }
    const r = create(name, newFolder.trim() || undefined);
    setNewOpen(false);
    setNewName("");
    setNewFolder("");
    router.push(routineEditPath(r.id));
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={t("Workout")}
        action={
          <Button onClick={() => setNewOpen(true)}>
            <Plus aria-hidden="true" size={18} /> {t("New routine")}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-4 pt-3">
        <Button
          variant="primary"
          onClick={() => {
            startEmpty(defaultRest);
            router.push("/workout");
          }}
          className="min-h-12 w-full text-base"
        >
          {t("Start an empty workout")}
        </Button>
        <Tabs
          id="routines"
          label={t("Routines")}
          tabs={[
            { value: "mine", label: t("My Routines") },
            { value: "vault", label: t("Template Vault") },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "mine" ? (
        <div {...tabPanelProps("routines", "mine")} className="flex flex-col gap-6 outline-none">
          {routines.length === 0 && (
            <p className="panel px-4 py-8 text-center text-sm text-text-muted">
              {t(
                "No routines saved. Create one, add its exercises and target sets, and you can start the same workout in one tap next time.",
              )}
            </p>
          )}

          {folderNames.map((folder) => (
            <section key={folder || "__none"} aria-labelledby={`folder-${folder || "none"}`}>
              <h2 id={`folder-${folder || "none"}`} className="text-sm font-semibold uppercase text-text-muted">
                {folder || (folderNames.length > 1 ? t("No folder") : t("All routines"))}
              </h2>
              <ul className="mt-2 flex flex-col gap-3">
                {folders.get(folder)!.map((r) => (
                  <li key={r.id}>
                    <RoutineCard routine={r} byId={byId} onStart={() => start(r)} onDuplicate={() => duplicate(r.id)} onDelete={() => setToDelete(r)} />
                  </li>
                ))}
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
        title={t("New routine")}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setNewOpen(false)}>{t("Cancel")}</Button>
            <Button variant="primary" onClick={submitNew}>
              {t("Create and add exercises")}
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
              {t("Name")}
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
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
            />
            {nameError && (
              <p id="routine-name-error" role="alert" className="mt-1 text-xs text-failure">
                {nameError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="routine-folder" className="mb-1 block text-sm font-semibold">
              {t("Folder")} <span className="font-normal text-text-muted">{t("(optional, e.g. Push / Pull / Legs)")}</span>
            </label>
            <input
              id="routine-folder"
              list="routine-folders"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Push / Pull / Legs"
              className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
            />
            <datalist id="routine-folders">
              {existingFolders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <button type="submit" className="sr-only">
            {t("Create")}
          </button>
        </form>
      </Sheet>



      <Sheet
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t("Delete {name}?", { name: toDelete?.name ?? t("routine") })}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setToDelete(null)}>{t("Keep it")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (toDelete) remove(toDelete.id);
                setToDelete(null);
              }}
            >
              {t("Delete")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          {t("Workouts you already logged from it are kept. Only the template is deleted.")}
        </p>
      </Sheet>

      <Sheet
        open={startBlocked !== null}
        onClose={() => setStartBlocked(null)}
        title={t("A workout is already in progress")}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setStartBlocked(null)}>{t("Cancel")}</Button>
            <Button variant="primary" onClick={() => router.push("/workout")}>
              {t("Go to current workout")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          {t("Finish or discard the current workout before starting {name}.", { name: startBlocked?.name ?? "" })}
        </p>
      </Sheet>
    </main>
  );
}
