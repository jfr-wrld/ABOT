"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Download, Image as ImageIcon, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { getActiveRepository } from "@/store/persistence";
import { useHydration } from "@/store/hydration";
import { fitJpeg } from "@/lib/photo";
import { newId } from "@/lib/id";
import { openPhotoInput } from "@/lib/native/photo-input";
import { isNativeApp, saveFile } from "@/lib/native/files";
import { useT } from "@/i18n";

/** Enough to tell a session's story without filling the phone. */
export const MAX_WORKOUT_PHOTOS = 6;

export interface ShownPhoto {
  id: string;
  url: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface WorkoutPhotosState {
  photos: ShownPhoto[];
  status: "loading" | "ready" | "error";
  add(file: File): Promise<void>;
  remove(id: string): Promise<void>;
  /** A message key for the last failed add or remove, or null. */
  error: string | null;
}

/**
 * The photos on one workout, read from this device's database. Object URLs are made here and
 * revoked when a photo goes or the page closes, so thumbnails never leak memory.
 */
export function useWorkoutPhotos(sessionId: string | undefined): WorkoutPhotosState {
  const hydrated = useHydration((s) => s.hydrated);
  const [photos, setPhotos] = useState<ShownPhoto[]>([]);
  const [status, setStatus] = useState<WorkoutPhotosState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const urls = useRef(new Map<string, string>());

  useEffect(() => {
    const repo = getActiveRepository();
    if (!hydrated || !repo || !sessionId) return;
    let live = true;
    const made = urls.current;
    repo.photos
      .list(sessionId)
      .then((rows) => {
        if (!live) return;
        setPhotos(
          rows.map((r) => {
            const url = URL.createObjectURL(r.blob);
            made.set(r.id, url);
            return { id: r.id, url, blob: r.blob, width: r.width, height: r.height };
          }),
        );
        setStatus("ready");
      })
      .catch(() => live && setStatus("error"));
    return () => {
      live = false;
      for (const url of made.values()) URL.revokeObjectURL(url);
      made.clear();
    };
  }, [hydrated, sessionId]);

  const add = useCallback(
    async (file: File) => {
      const repo = getActiveRepository();
      if (!repo || !sessionId) return;
      setError(null);
      if (photos.length >= MAX_WORKOUT_PHOTOS) return setError("This workout already has 6 photos. Delete one to add another.");
      try {
        const { blob, width, height } = await fitJpeg(file);
        const row = { id: newId(), sessionId, createdAt: Date.now(), blob, width, height };
        await repo.photos.add(row);
        const url = URL.createObjectURL(blob);
        urls.current.set(row.id, url);
        setPhotos((p) => [...p, { id: row.id, url, blob, width, height }]);
      } catch (e) {
        const full = e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "AbortError");
        setError(full ? "This phone has no room left for photos. Free up space and try again." : e instanceof Error ? e.message : "This photo could not be used.");
      }
    },
    [photos.length, sessionId],
  );

  const remove = useCallback(async (id: string) => {
    const repo = getActiveRepository();
    if (!repo) return;
    setError(null);
    try {
      await repo.photos.remove(id);
      const url = urls.current.get(id);
      if (url) URL.revokeObjectURL(url);
      urls.current.delete(id);
      setPhotos((p) => p.filter((x) => x.id !== id));
    } catch {
      setError("The photo could not be deleted. Try again.");
    }
  }, []);

  return { photos, status, add, remove, error };
}

/**
 * Photos from the session, on the summary and on the workout page: a grid of thumbnails, an add
 * tile while there is room, and a full-screen viewer to save one to the phone or delete it.
 */
export function WorkoutPhotos({ state, sessionName }: { state: WorkoutPhotosState; sessionName: string }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<ShownPhoto | null>(null);
  const { photos, status } = state;
  const room = photos.length < MAX_WORKOUT_PHOTOS;

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    await state.add(file);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  // The app's WebView offers no camera in its file picker, so there the button asks first.
  const choose = (source: "gallery" | "camera") => {
    setChoosing(false);
    openPhotoInput(input.current, source, "environment");
  };
  const startAdd = () => (isNativeApp() ? setChoosing(true) : input.current?.click());

  return (
    <section aria-labelledby="photos-heading" className="panel p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="photos-heading" className="label-caps">
          {t("Photos")}
        </h2>
        {photos.length > 0 && (
          <span className="num text-xs text-text-muted">
            {photos.length}/{MAX_WORKOUT_PHOTOS}
          </span>
        )}
      </div>

      {status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-failure">
          {t("The photos on this workout could not be read.")}
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-3 gap-2" aria-busy={status === "loading"}>
          {status === "loading" && <li aria-hidden="true" className="aspect-square rounded-ctl bg-surface-2" />}
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(p)}
                aria-label={t("Open photo {n} of {total}", { n: i + 1, total: photos.length })}
                className="block aspect-square w-full overflow-hidden rounded-ctl border border-line hover:border-line-hover"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL, nothing for next/image to optimise */}
                <img src={p.url} alt="" width={p.width} height={p.height} className="size-full object-cover" />
              </button>
            </li>
          ))}
          {status === "ready" && room && (
            <li>
              <button
                type="button"
                onClick={startAdd}
                disabled={busy}
                aria-busy={busy}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-ctl border border-dashed border-ink/25 text-xs font-semibold text-text-muted hover:border-accent hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Camera aria-hidden="true" size={20} />
                {busy ? t("Adding...") : t("Add photo")}
              </button>
            </li>
          )}
        </ul>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-sm text-failure">
          {t(state.error)}
        </p>
      )}
      <p className="mt-2 text-xs text-text-muted">{t("Photos stay on this phone. They are not in backups or sync.")}</p>

      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label={t("Workout photo file")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Sheet open={choosing} onClose={() => setChoosing(false)} title={t("Add photo")}>
        <div className="grid grid-cols-2 gap-2 pb-2">
          <Button onClick={() => choose("camera")} className="min-h-14">
            <Camera aria-hidden="true" size={18} />
            {t("Take photo")}
          </Button>
          <Button onClick={() => choose("gallery")} className="min-h-14">
            <ImageIcon aria-hidden="true" size={18} />
            {t("Choose photo")}
          </Button>
        </div>
      </Sheet>

      {open && (
        <PhotoViewer
          photo={open}
          fileName={`${sessionName.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "workout"}-${open.id.slice(0, 6)}.jpg`}
          onClose={() => setOpen(null)}
          onDelete={async () => {
            await state.remove(open.id);
            setOpen(null);
          }}
        />
      )}
    </section>
  );
}

/** One photo over the whole screen; Escape or Close returns to the workout. */
function PhotoViewer({ photo, fileName, onClose, onDelete }: { photo: ShownPhoto; fileName: string; onClose: () => void; onDelete: () => Promise<void> }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function save() {
    setNote(null);
    try {
      const r = await saveFile(photo.blob, fileName);
      setNote({ text: r.kind === "saved" ? t("Saved to your gallery, album ABOT.") : t("Photo downloaded."), error: false });
    } catch {
      setNote({ text: t("The photo could not be saved. Try again."), error: true });
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={t("Workout photo")}
      onClose={onClose}
      className="force-dark m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-text backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex justify-end px-2 pt-[calc(8px+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={t("Close")}
            className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
          <img src={photo.url} alt={t("Workout photo")} width={photo.width} height={photo.height} className="max-h-full max-w-full object-contain" />
        </div>
        <div className="flex flex-col gap-2 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
          {note && (
            <p role={note.error ? "alert" : "status"} className={`text-center text-sm ${note.error ? "text-failure" : "text-text-muted"}`}>
              {note.text}
            </p>
          )}
          {confirm ? (
            <>
              <p className="text-center text-sm font-semibold">{t("Delete this photo? It cannot be undone.")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setConfirm(false)}>{t("Keep it")}</Button>
                <Button variant="danger" onClick={() => void onDelete()}>
                  {t("Delete")}
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void save()}>
                <Download aria-hidden="true" size={18} />
                {t("Save to phone")}
              </Button>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                <Trash2 aria-hidden="true" size={18} />
                {t("Delete")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
