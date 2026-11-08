"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { backupFileName, backupFromSnapshot, importBackup, parseBackup, type AbotBackup, type BackupCounts } from "@/data/backup";
import { getActivePersistence, getActiveRepository, hydrateStores, snapshotFromStores } from "@/store/persistence";
import { InfoTip } from "@/components/ui/InfoTip";
import { saveFile } from "@/lib/native/files";

type Pending = { backup: AbotBackup; counts: BackupCounts; fileName: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function BackupSection() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function doExport() {
    setError(null);
    try {
      const backup = backupFromSnapshot(snapshotFromStores());
      const saved = await saveFile(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), backupFileName());
      const where = saved.kind === "saved" ? ` to ${saved.folder}` : "";
      setStatus(`Exported ${plural(backup.data.sessions.length, "workout", "workouts")}${where}.`);
    } catch (e) {
      setError(`Export failed: ${e instanceof Error ? e.message : String(e)}.`);
    }
  }

  async function onFile(file: File | undefined) {
    setError(null);
    setStatus(null);
    setPending(null);
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      return setError("This file could not be read. Pick it again.");
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) return setError(parsed.error);
    setPending({ backup: parsed.backup, counts: parsed.counts, fileName: file.name });
  }

  async function doImport(mode: "merge" | "replace") {
    const repo = getActiveRepository();
    const persistence = getActivePersistence();
    if (!repo || !persistence || !pending) {
      setError("Saved data is not loaded, so nothing can be imported. Reload ABOT and try again.");
      return;
    }
    setBusy(true);
    const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
    try {
      // Runs after every queued write and before any new one, so nothing interleaves with it.
      await persistence.runExclusive(() => importBackup(repo, pending.backup, mode));
    } catch (e) {
      // Both import modes run in one transaction, so a failure leaves the data as it was.
      setError(`Import failed: ${msg(e)}. Your data was not changed.`);
      setBusy(false);
      setConfirmReplace(false);
      return;
    }
    try {
      await persistence.runExclusive(() => hydrateStores(repo));
      setStatus(
        `Imported ${plural(pending.counts.sessions, "workout", "workouts")} (${mode === "merge" ? "merged" : "replaced all data"}).`,
      );
      setPending(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      setError(`The backup was imported, but ABOT could not reload it (${msg(e)}). Reload the page to see it.`);
    } finally {
      setBusy(false);
      setConfirmReplace(false);
    }
  }

  return (
    <section aria-labelledby="backup-heading" className="flex flex-col gap-3">
      <InfoTip
        title={
          <h2 id="backup-heading" className="text-sm font-semibold">
            Backup file
          </h2>
        }
        name="backup file"
      >
        A copy of every workout, routine, custom exercise, gym and setting on this device.
      </InfoTip>

      <Button onClick={doExport}>Export backup</Button>

      <div>
        <label htmlFor="import-file" className="mb-1 block text-sm font-semibold">
          Import backup
        </label>
        <input
          ref={fileInput}
          id="import-file"
          type="file"
          accept=".json,application/json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm text-text-muted file:mr-3 file:min-h-11 file:rounded-ctl file:border file:border-line-strong file:bg-surface-2 file:px-4 file:text-sm file:font-semibold file:text-text hover:file:bg-[var(--color-press-strong)]"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-ctl border border-failure/60 px-3 py-2 text-sm text-failure">
          {error}
        </p>
      )}

      {pending && (
        <div className="rounded-ctl border border-line-strong p-3">
          <p className="text-sm">
            <span className="font-semibold">{pending.fileName}</span> contains{" "}
            {plural(pending.counts.sessions, "workout", "workouts")}, {plural(pending.counts.routines, "routine", "routines")},{" "}
            {plural(pending.counts.exercises, "custom exercise", "custom exercises")}
            {pending.counts.locations > 0 && `, ${plural(pending.counts.locations, "gym", "gyms")}`}.
          </p>
          {pending.counts.dropped > 0 && (
            <p className="mt-1 text-xs text-text-muted">
              {plural(pending.counts.dropped, "damaged row", "damaged rows")} will be skipped.
            </p>
          )}
          <div className="mt-3 grid gap-2">
            <Button variant="primary" onClick={() => doImport("merge")} disabled={busy}>
              Merge into my data
            </Button>
            <Button variant="danger" onClick={() => setConfirmReplace(true)} disabled={busy}>
              Replace all my data
            </Button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Merge adds what is missing and keeps your workout in progress. Replace makes this device match the file.
          </p>
        </div>
      )}

      {status && (
        <p role="status" className="text-sm text-text-muted">
          {status}
        </p>
      )}

      <Sheet
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="Replace all data on this device?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirmReplace(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => doImport("replace")} disabled={busy}>
              Yes, replace everything
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Every workout, routine and setting here is removed and replaced with the file. Export a backup first if you
          might need the current data.
        </p>
      </Sheet>
    </section>
  );
}
