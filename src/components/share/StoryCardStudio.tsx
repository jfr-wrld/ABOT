"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Image as ImageIcon, ImagePlus, Share2, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import type { StoryData } from "@/lib/story-data";
import { useSettingsStore } from "@/store/useSettingsStore";
import { normalizeHandle } from "@/lib/profile";
import { PROFILE_LIMITS } from "@/types/workout";
import {
  OVERLAY_RANGE,
  STORY_HEIGHT,
  STORY_PRESETS,
  STORY_WIDTH,
  canShareStoryFiles,
  createStoryPhoto,
  downloadStoryPng,
  exportStoryPng,
  loadStoryFonts,
  renderStory,
  shareStoryPng,
  storyFileName,
  type StoryFonts,
  type StoryOptions,
  type StoryPhoto,
  type StoryPresetId,
} from "@/lib/story-exporter";
import { openSaved, type SaveResult } from "@/lib/native/files";
import { openPhotoInput } from "@/lib/native/photo-input";

const THUMB_W = 120;
const THUMB_H = (THUMB_W * STORY_HEIGHT) / STORY_WIDTH;

type Status =
  | { kind: "idle" }
  | { kind: "info"; text: string }
  | { kind: "error"; text: string };

/**
 * ABOT Story Studio: a 9:16 preview of the workout in one of eleven layouts, an optional
 * background photo from the device, and the two ways out (system share sheet, PNG download).
 */
export function StoryCardStudio({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: StoryData | null;
}) {
  const [png, setPng] = useState<PngState>({ blob: null, fileName: "", busy: true });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Mounted only after a tap, so navigator exists on the first render.
  const [shareable] = useState(canShareStoryFiles);

  return (
    <Sheet
      open={open}
      onClose={() => {
        setStatus({ kind: "idle" });
        onClose();
      }}
      title="Share to Instagram Story"
      footer={data ? <Actions png={png} shareable={shareable} /> : null}
    >
      {data && <Studio data={data} onPng={setPng} status={status} setStatus={setStatus} />}
    </Sheet>
  );
}

interface PngState {
  blob: Blob | null;
  fileName: string;
  busy: boolean;
}

interface ActionResult {
  /** The PNG the result is about; a new layout or photo makes a new PNG and hides it. */
  forBlob: Blob;
  kind: "info" | "error";
  text: string;
  saved?: Extract<SaveResult, { kind: "saved" }>;
}

/** Share and download, with what happened right under the buttons. */
function Actions({ png, shareable }: { png: PngState; shareable: boolean }) {
  const { blob, fileName, busy } = png;
  const ready = blob !== null && !busy;
  const [result, setResult] = useState<ActionResult | null>(null);
  const shown = result && result.forBlob === blob ? result : null;

  async function share() {
    if (!blob) return;
    try {
      const r = await shareStoryPng(blob, fileName);
      if (r === "shared") setResult({ forBlob: blob, kind: "info", text: "Sent to the share sheet." });
      else if (r === "cancelled") setResult(null);
      else setResult({ forBlob: blob, kind: "error", text: "This browser cannot share images. Download the PNG and post it from your gallery." });
    } catch (err) {
      setResult({ forBlob: blob, kind: "error", text: `Sharing failed${reason(err)}. Download the PNG and post it from your gallery.` });
    }
  }

  async function download() {
    if (!blob) return;
    setResult({ forBlob: blob, kind: "info", text: "Saving PNG…" });
    try {
      const saved = await downloadStoryPng(blob, fileName);
      setResult(
        saved.kind === "saved"
          ? { forBlob: blob, kind: "info", text: `Saved to your gallery, album ABOT (${saved.folder}).`, saved }
          : { forBlob: blob, kind: "info", text: `Saved ${fileName} (1080 × 1920).` },
      );
    } catch (err) {
      const denied = err instanceof Error && /permission/i.test(err.message);
      setResult({
        forBlob: blob,
        kind: "error",
        text: denied ? "ABOT needs storage access to save the PNG. Allow it in Android settings." : `The PNG could not be saved${reason(err)}.`,
      });
    }
  }

  async function openInGallery(saved: Extract<SaveResult, { kind: "saved" }>) {
    try {
      await openSaved(saved);
    } catch (err) {
      if (blob) setResult({ forBlob: blob, kind: "error", text: `The gallery could not open it${reason(err)}.` });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" onClick={share} disabled={!ready || !shareable} className="w-full">
        <Share2 aria-hidden="true" size={18} />
        Share to Instagram / System Share
      </Button>
      <Button onClick={download} disabled={!ready} className="w-full">
        <Download aria-hidden="true" size={18} />
        Download High-Res PNG
      </Button>
      {shown && (
        <div className="flex items-center justify-between gap-3">
          <p role={shown.kind === "error" ? "alert" : "status"} className={`text-xs ${shown.kind === "error" ? "text-failure" : "text-text-muted"}`}>
            {shown.text}
          </p>
          {shown.saved && (
            <Button variant="ghost" onClick={() => void openInGallery(shown.saved!)} className="shrink-0">
              <ImageIcon aria-hidden="true" size={16} />
              Open
            </Button>
          )}
        </div>
      )}
      {!shareable && (
        <p className="text-xs text-text-muted">
          This browser cannot hand images to other apps. Download the PNG, then add it to your story from the gallery.
        </p>
      )}
    </div>
  );
}

/** ": <reason>" from a thrown error, so a failure on a phone says what went wrong. */
function reason(err: unknown): string {
  return err instanceof Error && err.message ? `: ${err.message.replace(/\.$/, "")}` : "";
}

function Studio({
  data,
  onPng,
  status,
  setStatus,
}: {
  data: StoryData;
  onPng: (p: PngState) => void;
  status: Status;
  setStatus: (s: Status) => void;
}) {
  const [preset, setPreset] = useState<StoryPresetId>("obsidian-raw");
  const [fonts, setFonts] = useState<StoryFonts | null>(null);
  const [fontsFailed, setFontsFailed] = useState(false);
  const [photo, setPhoto] = useState<StoryPhoto | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [overlay, setOverlay] = useState<number>(OVERLAY_RANGE.initial);
  const [grayscale, setGrayscale] = useState(false);
  const handle = useSettingsStore((st) => st.profileHandle);
  const setHandle = (v: string) => useSettingsStore.getState().update({ profileHandle: normalizeHandle(v) });
  // The card carries the lifter's @handle; editing it here saves it to the profile.
  const card = useMemo<StoryData>(() => ({ ...data, handle: handle || null }), [data, handle]);

  const preview = useRef<HTMLCanvasElement>(null);
  const thumbs = useRef<Partial<Record<StoryPresetId, HTMLCanvasElement | null>>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadStoryFonts()
      .then((f) => alive && setFonts(f))
      .catch(() => alive && setFontsFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const opts = useMemo<StoryOptions>(() => ({ preset, photo, overlay, grayscale }), [preset, photo, overlay, grayscale]);

  // Preview: redraw on the next frame, so dragging the slider never queues stale frames.
  useEffect(() => {
    if (!fonts) return;
    const raf = requestAnimationFrame(() => {
      const ctx = preview.current?.getContext("2d");
      if (!ctx) return;
      try {
        renderStory(ctx, card, opts, fonts);
      } catch {
        setStatus({ kind: "error", text: "The card could not be drawn. Close this and try again." });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [card, opts, fonts, setStatus]);

  // Thumbnails show each layout with the same data and photo, so the choice is made on the real thing.
  useEffect(() => {
    if (!fonts) return;
    const raf = requestAnimationFrame(() => {
      for (const p of STORY_PRESETS) {
        const c = thumbs.current[p.id];
        const ctx = c?.getContext("2d");
        if (!c || !ctx) continue;
        ctx.setTransform(c.width / STORY_WIDTH, 0, 0, c.width / STORY_WIDTH, 0, 0);
        renderStory(ctx, card, { ...opts, preset: p.id }, fonts);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    });
    return () => cancelAnimationFrame(raf);
    // The preset itself does not change any thumbnail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, photo, overlay, grayscale, fonts]);

  // The PNG is made ahead of the tap: Safari only opens the share sheet inside the tap itself.
  useEffect(() => {
    if (!fonts) return;
    onPng({ blob: null, fileName: "", busy: true });
    let alive = true;
    const t = setTimeout(() => {
      exportStoryPng(card, opts, fonts)
        .then((blob) => alive && onPng({ blob, fileName: storyFileName(card, opts.preset), busy: false }))
        .catch(() => {
          if (!alive) return;
          onPng({ blob: null, fileName: "", busy: false });
          setStatus({ kind: "error", text: "The PNG could not be made on this device." });
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [card, opts, fonts, onPng, setStatus]);

  const pickPhoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setStatus({ kind: "idle" });
    try {
      setPhoto(await createStoryPhoto(file));
      setPhotoName(file.name);
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "This photo could not be read." });
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }, [setStatus]);

  const current = STORY_PRESETS.find((p) => p.id === preset) ?? STORY_PRESETS[0];
  const forcedGray = preset === "monochrome-steel";
  const description = `${current.name} story card: ${data.title}, ${formatVolume(data.volumeKg, data.unit)}, ${formatDuration(
    data.durationSec,
  )}, ${data.setsDone} sets${data.prs.length ? `, ${data.prs.length} new records` : ""}.`;

  if (fontsFailed) {
    return (
      <p role="alert" className="py-6 text-sm text-failure">
        The card fonts could not be loaded. Close this and try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto w-full" style={{ maxWidth: "min(100%, calc(52dvh * 9 / 16))" }}>
        <canvas
          ref={preview}
          width={STORY_WIDTH}
          height={STORY_HEIGHT}
          role="img"
          aria-label={description}
          className="block h-auto w-full rounded-ctl border border-line bg-bg"
          style={{ aspectRatio: `${STORY_WIDTH} / ${STORY_HEIGHT}` }}
        />
        {!fonts && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            Preparing the card
          </p>
        )}
      </div>

      <section aria-labelledby="story-layouts">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="story-layouts" className="text-sm font-semibold">
            Layout
          </h3>
          <p className="truncate text-xs text-text-muted">{current.blurb}</p>
        </div>
        <ul className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
          {STORY_PRESETS.map((p) => {
            const selected = p.id === preset;
            return (
              <li key={p.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPreset(p.id)}
                  className={`flex w-[104px] flex-col gap-1.5 rounded-ctl border-2 p-1 text-left transition-colors ${
                    selected ? "border-accent" : "border-transparent hover:border-line-hover"
                  }`}
                >
                  <canvas
                    ref={(el) => {
                      thumbs.current[p.id] = el;
                    }}
                    width={THUMB_W}
                    height={THUMB_H}
                    aria-hidden="true"
                    className="block h-auto w-full rounded-md bg-bg"
                    style={{ aspectRatio: `${STORY_WIDTH} / ${STORY_HEIGHT}` }}
                  />
                  <span className={`px-0.5 text-xs leading-tight ${selected ? "font-semibold text-text" : "text-text-muted"}`}>
                    {p.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="story-handle-label" className="panel flex flex-col gap-2 p-3">
        <label id="story-handle-label" htmlFor="story-handle" className="text-sm font-semibold">
          Username on the story
        </label>
        <div className="flex h-11 items-center rounded-ctl border border-zinc-800 bg-well focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <span aria-hidden="true" className="num pl-3 text-base text-text-muted">
            @
          </span>
          <input
            id="story-handle"
            value={handle}
            maxLength={PROFILE_LIMITS.handleMax}
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="yourname"
            className="h-full min-w-0 flex-1 bg-transparent pl-0.5 pr-3 text-base text-text placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <p className="text-xs text-text-muted">Shown on every layout. Leave it empty to share without it.</p>
      </section>

      <section aria-labelledby="story-photo" className="panel flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="story-photo" className="text-sm font-semibold">
            Background photo
          </h3>
          {photo && <span className="truncate text-xs text-text-muted">{photoName}</span>}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />
        <div className="flex gap-2">
          <Button onClick={() => openPhotoInput(fileInput.current, "gallery")} disabled={photoBusy} className="flex-1">
            <ImagePlus aria-hidden="true" size={18} />
            {photoBusy ? "Reading photo" : photo ? "Change photo" : "Upload Background Photo"}
          </Button>
          <Button onClick={() => openPhotoInput(fileInput.current, "camera")} disabled={photoBusy} aria-label="Take a background photo" className="px-3">
            <Camera aria-hidden="true" size={18} />
          </Button>
          {photo && (
            <Button variant="ghost" onClick={() => setPhoto(null)} aria-label="Remove background photo" className="px-3">
              <Trash2 aria-hidden="true" size={18} />
            </Button>
          )}
        </div>
        {!photo && (
          <p className="text-xs text-text-muted">
            A mirror selfie or the gym floor works best. The photo stays on this phone and is only drawn into the PNG.
          </p>
        )}

        {photo && (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label htmlFor="story-overlay" className="text-sm">
                  Overlay opacity
                </label>
                <span className="num text-sm text-text-muted">{Math.round(overlay * 100)}%</span>
              </div>
              <input
                id="story-overlay"
                type="range"
                min={OVERLAY_RANGE.min}
                max={OVERLAY_RANGE.max}
                step={OVERLAY_RANGE.step}
                value={overlay}
                onChange={(e) => setOverlay(Number(e.target.value))}
                className="h-11 w-full cursor-pointer accent-[#ccff00]"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span id="story-gray-label" className="text-sm">
                Grayscale photo
                {forcedGray && <span className="block text-xs text-text-muted">Monochrome Steel is always black and white.</span>}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={forcedGray || grayscale}
                aria-labelledby="story-gray-label"
                disabled={forcedGray}
                onClick={() => setGrayscale((g) => !g)}
                className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                  forcedGray || grayscale ? "border-accent bg-accent" : "border-line-strong bg-surface-2 hover:border-text-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-1 size-[22px] rounded-full transition-transform ${
                    forcedGray || grayscale ? "translate-x-[26px] bg-black" : "translate-x-1 bg-text"
                  }`}
                />
              </button>
            </div>
          </>
        )}
      </section>

      {status.kind !== "idle" && (
        <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm ${status.kind === "error" ? "text-failure" : "text-text-muted"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
