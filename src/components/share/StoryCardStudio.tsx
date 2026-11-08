"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Share2, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import type { StoryData } from "@/lib/story-data";
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
      footer={data ? <Actions png={png} shareable={shareable} setStatus={setStatus} /> : null}
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

function Actions({ png, shareable, setStatus }: { png: PngState; shareable: boolean; setStatus: (s: Status) => void }) {
  const { blob, fileName, busy } = png;
  const ready = blob !== null && !busy;

  async function share() {
    if (!blob) return;
    try {
      const result = await shareStoryPng(blob, fileName);
      if (result === "shared") setStatus({ kind: "info", text: "Sent to the share sheet." });
      else if (result === "cancelled") setStatus({ kind: "idle" });
      else setStatus({ kind: "error", text: "This browser cannot share images. Download the PNG and post it from your gallery." });
    } catch {
      setStatus({ kind: "error", text: "Sharing failed. Download the PNG and post it from your gallery." });
    }
  }

  function download() {
    if (!blob) return;
    downloadStoryPng(blob, fileName);
    setStatus({ kind: "info", text: `Saved ${fileName} (1080 × 1920).` });
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
      {!shareable && (
        <p className="text-xs text-text-muted">
          This browser cannot hand images to other apps. Download the PNG, then add it to your story from the gallery.
        </p>
      )}
    </div>
  );
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
        renderStory(ctx, data, opts, fonts);
      } catch {
        setStatus({ kind: "error", text: "The card could not be drawn. Close this and try again." });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [data, opts, fonts, setStatus]);

  // Thumbnails show each layout with the same data and photo, so the choice is made on the real thing.
  useEffect(() => {
    if (!fonts) return;
    const raf = requestAnimationFrame(() => {
      for (const p of STORY_PRESETS) {
        const c = thumbs.current[p.id];
        const ctx = c?.getContext("2d");
        if (!c || !ctx) continue;
        ctx.setTransform(c.width / STORY_WIDTH, 0, 0, c.width / STORY_WIDTH, 0, 0);
        renderStory(ctx, data, { ...opts, preset: p.id }, fonts);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    });
    return () => cancelAnimationFrame(raf);
    // The preset itself does not change any thumbnail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, photo, overlay, grayscale, fonts]);

  // The PNG is made ahead of the tap: Safari only opens the share sheet inside the tap itself.
  useEffect(() => {
    if (!fonts) return;
    onPng({ blob: null, fileName: "", busy: true });
    let alive = true;
    const t = setTimeout(() => {
      exportStoryPng(data, opts, fonts)
        .then((blob) => alive && onPng({ blob, fileName: storyFileName(data, opts.preset), busy: false }))
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
  }, [data, opts, fonts, onPng, setStatus]);

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
          <Button onClick={() => fileInput.current?.click()} disabled={photoBusy} className="flex-1">
            <ImagePlus aria-hidden="true" size={18} />
            {photoBusy ? "Reading photo" : photo ? "Change photo" : "Upload Background Photo"}
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
