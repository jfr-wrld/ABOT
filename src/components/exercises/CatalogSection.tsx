"use client";

import { useState } from "react";
import { Download, Library } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { loadCatalog } from "@/data/catalog";
import { useExerciseStore } from "@/store/useExerciseStore";
import { getActiveRepository } from "@/store/persistence";
import { useT } from "@/i18n";

type Phase = { kind: "idle" } | { kind: "loading" } | { kind: "done"; count: number } | { kind: "error"; message: string };

/**
 * Downloads the free-exercise-db catalog on request (about 1 MB) into IndexedDB. Logged catalog
 * exercises are copied into the user's own list, so removing the catalog never breaks history.
 * Lives as a button in the page header; the explanation and the load or remove action open in a sheet.
 */
export function CatalogSection() {
  const catalogCount = useExerciseStore((s) => s.catalog.length);
  const setCatalog = useExerciseStore((s) => s.setCatalog);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const t = useT();

  async function load() {
    const repo = getActiveRepository();
    if (!repo) return setPhase({ kind: "error", message: t("Saved data is not loaded yet. Reload ABOT and try again.") });
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
      setPhase({ kind: "error", message: t("Could not remove the catalog ({error}).", { error: e instanceof Error ? e.message : String(e) }) });
    }
  }

  const loading = phase.kind === "loading";
  const close = () => {
    setOpen(false);
    setConfirmRemove(false);
  };

  // A header button, not a card: the catalog is a one-time choice, the exercise list is the page.
  return (
    <>
      <Button onClick={() => setOpen(true)} className="shrink-0 !px-3">
        {catalogCount > 0 ? <Library aria-hidden="true" size={18} /> : <Download aria-hidden="true" size={18} />}
        <span className="text-sm">{t("Catalog")}</span>
      </Button>

      <Sheet
        open={open}
        onClose={close}
        title={confirmRemove ? t("Remove the catalog?") : t("Full exercise catalog")}
        footer={
          confirmRemove ? (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setConfirmRemove(false)}>{t("Keep it")}</Button>
              <Button variant="danger" onClick={remove}>
                {t("Remove")}
              </Button>
            </div>
          ) : catalogCount === 0 ? (
            <Button variant="primary" onClick={load} disabled={loading} className="w-full">
              <Download aria-hidden="true" size={18} />
              {loading ? t("Downloading catalog") : t("Load full exercise catalog")}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmRemove(true)} className="w-full">
              {t("Remove catalog")}
            </Button>
          )
        }
      >
        {confirmRemove ? (
          <p className="text-sm text-text-muted">
            {t(
              "Frees about 1 MB. Catalog exercises you have already logged stay in your library and history. You can load the catalog again later.",
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">
              {catalogCount === 0
                ? t(
                    "Hundreds more exercises from the public domain free-exercise-db, on top of the library ABOT ships with. Downloads about 1 MB once and then works offline; ones ABOT already has are skipped.",
                  )
                : t("{n} catalog exercises stored on this device.", { n: catalogCount })}
            </p>
            {phase.kind === "done" && (
              <p role="status" className="text-sm font-semibold text-accent">
                {t("Added {n} exercises from the catalog.", { n: phase.count })}
              </p>
            )}
            {phase.kind === "error" && (
              <p role="alert" className="text-sm text-failure">
                {t(phase.message)}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
