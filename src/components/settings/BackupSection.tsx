"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { backupFileName, backupFromSnapshot, importBackup, parseBackup, photosForBackup, type AbotBackup, type BackupCounts } from "@/data/backup";
import { getActivePersistence, getActiveRepository, hydrateStores, snapshotFromStores } from "@/store/persistence";
import { InfoTip } from "@/components/ui/InfoTip";
import { saveFile } from "@/lib/native/files";
import { useT } from "@/i18n";

type Pending = { backup: AbotBackup; counts: BackupCounts; fileName: string };

export function BackupSection() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const t = useT();
  // Workout photos on this device: how many, and roughly how much they add to the file.
  const [photoStats, setPhotoStats] = useState<{ count: number; bytes: number } | null>(null);
  const [withPhotos, setWithPhotos] = useState(true);

  useEffect(() => {
    const repo = getActiveRepository();
    if (!repo) return;
    let live = true;
    repo.photos
      .all()
      .then((rows) => live && setPhotoStats({ count: rows.length, bytes: rows.reduce((n, r) => n + r.blob.size, 0) }))
      .catch(() => live && setPhotoStats(null));
    return () => {
      live = false;
    };
  }, [status]);

  async function doExport() {
    setError(null);
    try {
      const repo = getActiveRepository();
      const base = backupFromSnapshot(snapshotFromStores());
      const photos = withPhotos && repo && photoStats?.count ? await photosForBackup(await repo.photos.all()) : undefined;
      const backup: AbotBackup = photos ? { ...base, photos } : base;
      const saved = await saveFile(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), backupFileName());
      const n = backup.data.sessions.length;
      setStatus(
        saved.kind === "saved"
          ? t.n(n, "Exported {n} workout to {folder}.", "Exported {n} workouts to {folder}.", { folder: saved.folder })
          : t.n(n, "Exported {n} workout.", "Exported {n} workouts."),
      );
    } catch (e) {
      setError(t("Export failed: {error}.", { error: e instanceof Error ? e.message : String(e) }));
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
      return setError(t("This file could not be read. Pick it again."));
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) return setError(parsed.error);
    setPending({ backup: parsed.backup, counts: parsed.counts, fileName: file.name });
  }

  async function doImport(mode: "merge" | "replace") {
    const repo = getActiveRepository();
    const persistence = getActivePersistence();
    if (!repo || !persistence || !pending) {
      setError(t("Saved data is not loaded, so nothing can be imported. Reload ABOT and try again."));
      return;
    }
    setBusy(true);
    const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
    try {
      // Runs after every queued write and before any new one, so nothing interleaves with it.
      await persistence.runExclusive(() => importBackup(repo, pending.backup, mode));
    } catch (e) {
      // Both import modes run in one transaction, so a failure leaves the data as it was.
      setError(t("Import failed: {error}. Your data was not changed.", { error: msg(e) }));
      setBusy(false);
      setConfirmReplace(false);
      return;
    }
    try {
      await persistence.runExclusive(() => hydrateStores(repo));
      setStatus(
        t.n(pending.counts.sessions, "Imported {n} workout ({how}).", "Imported {n} workouts ({how}).", {
          how: mode === "merge" ? t("merged") : t("replaced all data"),
        }),
      );
      setPending(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      setError(t("The backup was imported, but ABOT could not reload it ({error}). Reload the page to see it.", { error: msg(e) }));
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
            {t("Backup file")}
          </h2>
        }
        name={t("backup file")}
      >
        {t("A copy of every workout, routine, custom exercise, gym and setting on this device, and its workout photos if you include them.")}
      </InfoTip>

      {photoStats && photoStats.count > 0 && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} className="size-5 shrink-0 accent-[var(--color-accent)]" />
          <span>
            {t.n(photoStats.count, "Include {n} workout photo", "Include {n} workout photos")}{" "}
            <span className="num text-text-muted">({t("about {mb} MB", { mb: Math.max(0.1, Math.round((photoStats.bytes * 4) / 3 / 100_000) / 10) })})</span>
          </span>
        </label>
      )}

      <Button onClick={doExport}>{t("Export backup")}</Button>

      <div>
        <label htmlFor="import-file" className="mb-1 block text-sm font-semibold">
          {t("Import backup")}
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
          {t(error)}
        </p>
      )}

      {pending && (
        <div className="rounded-ctl border border-line-strong p-3">
          <p className="text-sm">
            <span className="font-semibold">{pending.fileName}</span>{" "}
            {t("contains {list}.", {
              list: [
                t.n(pending.counts.sessions, "{n} workout", "{n} workouts"),
                t.n(pending.counts.routines, "{n} routine", "{n} routines"),
                t.n(pending.counts.exercises, "{n} custom exercise", "{n} custom exercises"),
                ...(pending.counts.locations > 0 ? [t.n(pending.counts.locations, "{n} gym", "{n} gyms")] : []),
                ...(pending.counts.photos > 0 ? [t.n(pending.counts.photos, "{n} photo", "{n} photos")] : []),
              ].join(", "),
            })}
          </p>
          {pending.counts.dropped > 0 && (
            <p className="mt-1 text-xs text-text-muted">
              {t.n(pending.counts.dropped, "{n} damaged row will be skipped.", "{n} damaged rows will be skipped.")}
            </p>
          )}
          <div className="mt-3 grid gap-2">
            <Button variant="primary" onClick={() => doImport("merge")} disabled={busy}>
              {t("Merge into my data")}
            </Button>
            <Button variant="danger" onClick={() => setConfirmReplace(true)} disabled={busy}>
              {t("Replace all my data")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {t("Merge adds what is missing and keeps your workout in progress. Replace makes this device match the file.")}
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
        title={t("Replace all data on this device?")}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirmReplace(false)}>{t("Cancel")}</Button>
            <Button variant="danger" onClick={() => doImport("replace")} disabled={busy}>
              {t("Yes, replace everything")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          {t(
            "Every workout, routine and setting here is removed and replaced with the file. Export a backup first if you might need the current data.",
          )}
        </p>
      </Sheet>
    </section>
  );
}
