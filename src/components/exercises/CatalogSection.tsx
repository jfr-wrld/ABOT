"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { loadCatalog } from "@/data/catalog";
import { useExerciseStore } from "@/store/useExerciseStore";
import { getActiveRepository } from "@/store/persistence";

type Phase = { kind: "idle" } | { kind: "loading" } | { kind: "done"; count: number } | { kind: "error"; message: string };

/**
 * Downloads the free-exercise-db catalog on request (about 1 MB) into IndexedDB. Logged catalog
 * exercises are copied into the user's own list, so removing the catalog never breaks history.
 */
export function CatalogSection() {
  const catalogCount = useExerciseStore((s) => s.catalog.length);
  const setCatalog = useExerciseStore((s) => s.setCatalog);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function load() {
    const repo = getActiveRepository();
    if (!repo) return setPhase({ kind: "error", message: "Saved data is not loaded yet. Reload ABOT and try again." });
    setPhase({ kind: "loading" });
    try {
      const rows = await loadCatalog((url) => fetch(url), repo);
      setCatalog(rows);
      setPhase({ kind: "done", count: rows.length });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function remove() {
    const repo = getActiveRepository();
    setConfirmRemove(false);
    if (!repo) return;
    try {
      await repo.catalog.clear();
      setCatalog([]);
      setPhase({ kind: "idle" });
    } catch (e) {
      setPhase({ kind: "error", message: `Could not remove the catalog (${e instanceof Error ? e.message : String(e)}).` });
    }
  }

  return (
    <section aria-labelledby="catalog-heading" className="mx-4 mt-4 rounded-card bg-surface p-3">
      <h2 id="catalog-heading" className="text-sm font-semibold">
        Full exercise catalog
      </h2>
      {catalogCount === 0 ? (
        <>
          <p className="mt-1 text-xs text-text-muted">
            About 800 more exercises with images and steps from the public domain free-exercise-db. Downloads about 1 MB
            once and then works offline.
          </p>
          <Button onClick={load} disabled={phase.kind === "loading"} className="mt-3 w-full">
            <Download aria-hidden="true" size={18} />
            {phase.kind === "loading" ? "Downloading catalog" : "Load full exercise catalog"}
          </Button>
        </>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-xs text-text-muted">{catalogCount} catalog exercises stored on this device.</p>
          <Button variant="ghost" onClick={() => setConfirmRemove(true)} className="shrink-0">
            Remove catalog
          </Button>
        </div>
      )}
      {phase.kind === "done" && (
        <p role="status" className="mt-2 text-xs text-text-muted">
          Added {phase.count} exercises from the catalog.
        </p>
      )}
      {phase.kind === "error" && (
        <p role="alert" className="mt-2 text-xs text-failure">
          {phase.message}
        </p>
      )}

      <Sheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remove the catalog?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirmRemove(false)}>Keep it</Button>
            <Button variant="danger" onClick={remove}>
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Frees about 1 MB. Catalog exercises you have already logged stay in your library and history. You can load the
          catalog again later.
        </p>
      </Sheet>
    </section>
  );
}
