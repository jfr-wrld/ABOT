"use client";

import { founderLabel } from "@/lib/entitlements";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Film, Gem, Image as ImageIcon, ImagePlus, LayoutTemplate, Lock, Share2, TextSquare, Trash2, X } from "@/components/icons";
import { useReducedMotionConfig } from "framer-motion";
import { useStoryVideo } from "./useStoryVideo";
import { FormatSwitch, VideoActions } from "./VideoActions";
import { STILL_TIME, STORY_SECONDS } from "@/lib/story-motion";
import { canShareFiles } from "@/lib/native/files";
import { useEntitlements } from "@/store/useEntitlements";
import { ProBadge } from "@/components/paywall/ProBadge";
import { tunables } from "@/lib/tunables";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import type { StoryData } from "@/lib/story-data";
import { useSettingsStore } from "@/store/useSettingsStore";
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
  workoutShareText,
  storyFileName,
  type StoryFonts,
  type StoryOptions,
  type StoryPhoto,
  type StoryPresetId,
  SIZE_RANGE,
  type TextPosition,
  CLEAN_EXTRAS,
  type CleanExtra,
} from "@/lib/story-exporter";
import { openSaved, type SaveResult } from "@/lib/native/files";
import { openPhotoInput } from "@/lib/native/photo-input";
import { useT } from "@/i18n";
import { feedback } from "@/lib/feedback";

const THUMB_W = 120;
const THUMB_H = (THUMB_W * STORY_HEIGHT) / STORY_WIDTH;

type Status =
  | { kind: "idle" }
  | { kind: "info"; text: string }
  | { kind: "error"; text: string };

/**
 * ABOT Story Studio, full screen with no vertical scroll: the 9:16 preview takes the free
 * height, and under it one panel at a time (layouts or background photo) picked by tabs, then
 * Share. The @username comes from the profile. Download sits in the top bar. Opened as a modal
 * <dialog>, so Escape and Android's back close it.
 */
/** A workout photo and an object URL for it that its owner keeps alive while the studio is open. */
export interface StudioPhoto {
  blob: Blob;
  url: string;
}

export function StoryCardStudio({
  open,
  onClose,
  data,
  photos,
}: {
  open: boolean;
  onClose: () => void;
  data: StoryData | null;
  /** The workout's own photos: offered as backgrounds, and the first one is used to start with. */
  photos?: StudioPhoto[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Mounted only after a tap, so navigator exists on the first render.
  const [shareable] = useState(canShareStoryFiles);
  const t = useT();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={t("Share to Instagram Story")}
      onClose={() => {
        setStatus({ kind: "idle" });
        onClose();
      }}
      className="force-dark m-0 h-dvh max-h-dvh w-full max-w-none bg-bg p-0 text-text backdrop:bg-black/80"
    >
      {open && data && <Studio data={data} workoutPhotos={photos} status={status} setStatus={setStatus} shareable={shareable} onClose={() => ref.current?.close()} />}
    </dialog>
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

/** Share and download, and what happened, shown over the bottom of the preview. */
function usePngActions(png: PngState) {
  const { blob, fileName, busy } = png;
  const ready = blob !== null && !busy;
  const [result, setResult] = useState<ActionResult | null>(null);
  const shown = result && result.forBlob === blob ? result : null;
  const t = useT();

  async function share() {
    if (!blob) return;
    try {
      const r = await shareStoryPng(blob, fileName);
      if (r === "shared") setResult({ forBlob: blob, kind: "info", text: t("Sent to the share sheet.") });
      else if (r === "cancelled") setResult(null);
      else setResult({ forBlob: blob, kind: "error", text: t("This browser cannot share images. Download the PNG and post it from your gallery.") });
    } catch (err) {
      setResult({ forBlob: blob, kind: "error", text: t("Sharing failed{reason}. Download the PNG and post it from your gallery.", { reason: reason(err) }) });
    }
  }

  async function download() {
    if (!blob) return;
    setResult({ forBlob: blob, kind: "info", text: t("Saving PNG…") });
    try {
      const saved = await downloadStoryPng(blob, fileName);
      setResult(
        saved.kind === "saved"
          ? { forBlob: blob, kind: "info", text: t("Saved to your gallery, album ABOT."), saved }
          : { forBlob: blob, kind: "info", text: t("Saved {file} (1080 × 1920).", { file: fileName }) },
      );
    } catch (err) {
      const denied = err instanceof Error && /permission/i.test(err.message);
      setResult({
        forBlob: blob,
        kind: "error",
        text: denied
          ? t("ABOT needs storage access to save the PNG. Allow it in Android settings.")
          : t("The PNG could not be saved{reason}.", { reason: reason(err) }),
      });
    }
  }

  async function openInGallery(saved: Extract<SaveResult, { kind: "saved" }>) {
    try {
      await openSaved(saved);
    } catch (err) {
      if (blob) setResult({ forBlob: blob, kind: "error", text: t("The gallery could not open it{reason}.", { reason: reason(err) }) });
    }
  }

  return { ready, share, download, openInGallery, shown, dismiss: () => setResult(null) };
}

/** ": <reason>" from a thrown error, so a failure on a phone says what went wrong. */
function reason(err: unknown): string {
  return err instanceof Error && err.message ? `: ${err.message.replace(/\.$/, "")}` : "";
}

function Studio({
  data,
  workoutPhotos = [],
  status,
  setStatus,
  shareable,
  onClose,
}: {
  data: StoryData;
  workoutPhotos?: StudioPhoto[];
  status: Status;
  setStatus: (s: Status) => void;
  shareable: boolean;
  onClose: () => void;
}) {
  // The PNG remembers which card it was made from; any other card means it is being remade.
  const [made, setMade] = useState<{ from: object | null; blob: Blob | null; fileName: string }>({ from: null, blob: null, fileName: "" });
  const [tab, setTab] = useState<Tab>("layout");
  const [preset, setPreset] = useState<StoryPresetId>("clean");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom-left");
  const [cleanExtra, setCleanExtra] = useState<CleanExtra>("none");
  const [textScale, setTextScale] = useState<number>(SIZE_RANGE.initial);
  const [extraScale, setExtraScale] = useState<number>(SIZE_RANGE.initial);
  const [fonts, setFonts] = useState<StoryFonts | null>(null);
  const [fontsFailed, setFontsFailed] = useState(false);
  const [photo, setPhoto] = useState<StoryPhoto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [overlay, setOverlay] = useState<number>(OVERLAY_RANGE.initial);
  const [grayscale, setGrayscale] = useState(false);
  const [hideWatermark, setHideWatermark] = useState(false);
  const [founderBadgeOn, setFounderBadgeOn] = useState(false);
  const { proActive, isFounder, founderUnitCode, openPaywall } = useEntitlements();
  const t = useT();
  // The card carries the lifter's @handle from the profile (Profile > About).
  const handle = useSettingsStore((st) => st.profileHandle);
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

  // Clean and the next two layouts are free; the rest, and a card without the ABOT mark, are PRO.
  const presetLocked = !proActive && isProPreset(preset);
  const founderBadge = founderBadgeOn && isFounder ? founderUnitCode : null;
  const opts = useMemo<StoryOptions>(
    () => ({ preset, photo, overlay, grayscale, hideWatermark: hideWatermark && proActive, founderBadge, textPosition, cleanExtra, textScale, extraScale }),
    [preset, photo, overlay, grayscale, hideWatermark, proActive, founderBadge, textPosition, cleanExtra, textScale, extraScale],
  );
  const exportKey = useMemo(() => ({ card, opts }), [card, opts]);
  // Image (the PNG, as before) or Video (the same card in motion, PRO for a workout).
  const [format, setFormat] = useState<"image" | "video">("image");
  const reduceMotion = useReducedMotionConfig();
  const drawFrame = useMemo(
    () => (fonts ? (ctx: CanvasRenderingContext2D, time: number) => renderStory(ctx, card, opts, fonts, time) : null),
    [card, opts, fonts],
  );
  const videoFile = storyFileName(card, opts.preset).replace(/\.png$/, "");
  const clip = useStoryVideo({
    key: exportKey,
    draw: drawFrame,
    fileName: videoFile,
    shareText: workoutShareText(t),
  });
  const [videoShareable] = useState(() => canShareFiles(new File([new Uint8Array(1)], "abot.mp4", { type: "video/mp4" })));
  const png: PngState = made.from === exportKey ? { blob: made.blob, fileName: made.fileName, busy: false } : { blob: null, fileName: "", busy: true };
  const actions = usePngActions(png);

  // Video preview: the card plays in a loop, with a short hold on the last frame. With reduced
  // motion it stays on the finished card.
  useEffect(() => {
    if (!fonts || format !== "video" || reduceMotion) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = ((now - start) / 1000) % (STORY_SECONDS + 0.8);
      const ctx = preview.current?.getContext("2d");
      if (ctx) renderStory(ctx, card, opts, fonts, Math.min(t, STORY_SECONDS));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [card, opts, fonts, format, reduceMotion]);

  // Preview: redraw on the next frame, so dragging the slider never queues stale frames.
  useEffect(() => {
    if (!fonts || (format === "video" && !reduceMotion)) return;
    const raf = requestAnimationFrame(() => {
      const ctx = preview.current?.getContext("2d");
      if (!ctx) return;
      try {
        renderStory(ctx, card, opts, fonts, STILL_TIME);
      } catch {
        setStatus({ kind: "error", text: t("The card could not be drawn. Close this and try again.") });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [card, opts, fonts, setStatus, t, format, reduceMotion]);

  // Thumbnails show each layout with the same data and photo, so the choice is made on the real thing.
  // The Layout panel unmounts on the other tabs, so its fresh canvases are drawn again on return.
  useEffect(() => {
    if (!fonts || tab !== "layout") return;
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
  }, [card, photo, overlay, grayscale, fonts, tab, textPosition, cleanExtra, textScale, extraScale]);

  // The PNG is made ahead of the tap: Safari only opens the share sheet inside the tap itself.
  useEffect(() => {
    if (!fonts) return;
    const from = exportKey;
    let alive = true;
    const timer = setTimeout(() => {
      exportStoryPng(card, opts, fonts)
        .then((blob) => alive && setMade({ from, blob, fileName: storyFileName(card, opts.preset) }))
        .catch(() => {
          if (!alive) return;
          setMade({ from, blob: null, fileName: "" });
          setStatus({ kind: "error", text: t("The PNG could not be made on this device.") });
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [exportKey, card, opts, fonts, setStatus, t]);

  const pickPhoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setStatus({ kind: "idle" });
    try {
      setPhoto(await createStoryPhoto(file));
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? t(err.message) : t("This photo could not be read.") });
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }, [setStatus, t]);

  // The workout's own photos as background choices; the first is used on opening, so a photo
  // layout shows it without picking again. `chosen` is null once the photo comes from elsewhere.
  const [chosen, setChosen] = useState<number | null>(null);
  // The page that opened the studio owns these object URLs (useWorkoutPhotos) and keeps them alive.
  const photoThumbs = workoutPhotos.map((p) => p.url);
  const pickWorkoutPhoto = useCallback(
    (i: number) => {
      const blob = workoutPhotos[i]?.blob;
      if (!blob) return;
      setChosen(i);
      void pickPhoto(new File([blob], "workout.jpg", { type: blob.type || "image/jpeg" }));
    },
    [workoutPhotos, pickPhoto],
  );
  const usedInitial = useRef(false);
  useEffect(() => {
    if (workoutPhotos.length === 0 || usedInitial.current) return;
    usedInitial.current = true;
    pickWorkoutPhoto(0);
  }, [workoutPhotos, pickWorkoutPhoto]);

  const current = STORY_PRESETS.find((p) => p.id === preset) ?? STORY_PRESETS[0];
  // The Editorial cover is always black and white.
  const forcedGray = preset === "editorial";
  const description =
    t("{layout} story card: {title}, {volume}, {duration}, {sets} sets", {
      layout: current.name,
      title: data.title,
      volume: formatVolume(data.volumeKg, data.unit),
      duration: formatDuration(data.durationSec),
      sets: data.setsDone,
    }) +
    (data.prs.length ? t(", {n} new records", { n: data.prs.length }) : "") +
    (handle ? `, @${handle}` : "") +
    ".";

  if (fontsFailed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p role="alert" className="text-sm text-failure">
          {t("The card fonts could not be loaded. Close this and try again.")}
        </p>
        <Button onClick={onClose}>{t("Close")}</Button>
      </div>
    );
  }

  const video = format === "video";
  const message =
    status.kind !== "idle"
      ? { kind: status.kind, text: status.text }
      : video
        ? clip.video.kind === "error"
          ? { kind: "error" as const, text: clip.video.text }
          : clip.note
            ? { kind: clip.note.kind, text: clip.note.text }
            : null
        : actions.shown
          ? { kind: actions.shown.kind, text: actions.shown.text }
          : null;
  // Gates, in order: a PRO layout, then the video itself (PRO for a workout).
  const gate = presetLocked ? "story_studio_pro_presets" : video && !proActive ? "story_video" : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-[520px] flex-col pt-[env(safe-area-inset-top)] pb-[calc(12px+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-2">
        <button type="button" onClick={onClose} aria-label={t("Close")} className="flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text">
          <X aria-hidden="true" size={22} />
        </button>
        <div className="min-w-0 text-center">
          <h2 className="text-sm font-semibold">{t("Share story")}</h2>
          <p className="truncate text-xs text-text-muted">
            {current.name}
            {handle ? ` · @${handle}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (gate ? openPaywall(gate) : video ? void clip.download() : void actions.download())}
          disabled={video ? clip.video.kind !== "ready" && !gate : !actions.ready}
          aria-label={video ? t("Save video") : t("Download High-Res PNG")}
          className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:opacity-40"
        >
          <Download aria-hidden="true" size={20} />
        </button>
      </header>

      {/* Image or video: the same card, still or in motion. */}
      <FormatSwitch value={format} onChange={setFormat} videoPro={!proActive} />

      {/* The preview takes whatever height is left, at 9:16. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-2">
        <canvas
          ref={preview}
          width={STORY_WIDTH}
          height={STORY_HEIGHT}
          role="img"
          aria-label={description}
          className="block h-full max-h-full w-auto max-w-full rounded-card border border-line bg-surface shadow-2xl"
          style={{ aspectRatio: `${STORY_WIDTH} / ${STORY_HEIGHT}` }}
        />
        {presetLocked && (
          <div className="force-dark absolute inset-x-8 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-card border border-[#ccff00]/50 bg-black/85 p-4 text-center backdrop-blur">
            <p className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#ccff00]">
              <Lock aria-hidden="true" size={12} /> {t("PRO layout preview")}
            </p>
            <button
              type="button"
              onClick={() => openPaywall("story_studio_pro_presets")}
              className="min-h-11 rounded-ctl bg-[#ccff00] px-4 font-mono text-xs font-black uppercase tracking-[0.1em] text-black"
            >
              {t("Unlock with ABOT Pro")}
            </button>
          </div>
        )}
        {!fonts && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            {t("Preparing the card")}
          </p>
        )}
        {message && (
          <div className="absolute inset-x-6 bottom-4 flex items-center gap-2 rounded-ctl border border-line bg-black/85 px-3 py-2 backdrop-blur">
            <p role={message.kind === "error" ? "alert" : "status"} className={`min-w-0 flex-1 text-xs ${message.kind === "error" ? "text-failure" : "text-text"}`}>
              {message.text}
            </p>
            {status.kind === "idle" && video && clip.note?.saved && (
              <Button variant="ghost" onClick={() => clip.openSaved(clip.note!.saved!)} className="min-h-9 shrink-0 px-2 text-xs">
                <Film aria-hidden="true" size={14} />
                {t("Open")}
              </Button>
            )}
            {status.kind === "idle" && !video && actions.shown?.saved && (
              <Button variant="ghost" onClick={() => void actions.openInGallery(actions.shown!.saved!)} className="min-h-9 shrink-0 px-2 text-xs">
                <ImageIcon aria-hidden="true" size={14} />
                {t("Open")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* One panel at a time, fixed height, so nothing below the preview scrolls. */}
      <div className="h-[152px] shrink-0 px-4 pt-2">
        {tab === "layout" && (
          <ul aria-label={t("Layouts")} className="-mx-4 flex h-full snap-x gap-2 overflow-x-auto px-4 pb-1">
            {STORY_PRESETS.map((p) => {
              const selected = p.id === preset;
              const pro = isProPreset(p.id);
              return (
                <li key={p.id} className="relative h-full shrink-0 snap-start">
                  {pro && <ProBadge className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 -translate-x-1/2 scale-90" />}
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={p.name}
                    title={t(p.blurb)}
                    onClick={() => {
                      if (p.id !== preset) feedback.tick();
                      setPreset(p.id);
                    }}
                    className={`h-full rounded-ctl border-2 p-0.5 transition-colors ${selected ? "border-accent" : "border-transparent hover:border-line-hover"}`}
                  >
                    <canvas
                      ref={(el) => {
                        thumbs.current[p.id] = el;
                      }}
                      width={THUMB_W}
                      height={THUMB_H}
                      aria-hidden="true"
                      className="block h-full w-auto rounded-md bg-surface"
                      style={{ aspectRatio: `${STORY_WIDTH} / ${STORY_HEIGHT}` }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "text" && preset === "clean" && (
          <CleanTextControls
            position={textPosition}
            onPosition={setTextPosition}
            extra={cleanExtra}
            onExtra={setCleanExtra}
            textScale={textScale}
            onTextScale={setTextScale}
            extraScale={extraScale}
            onExtraScale={setExtraScale}
          />
        )}

        {tab === "pro" && (
          <div className="flex h-full flex-col justify-center gap-2">
            <ProRow
              label={t("Hide ABOT watermark")}
              badge={<ProBadge />}
              checked={hideWatermark && proActive}
              onChange={(v) => (proActive ? setHideWatermark(v) : openPaywall("remove_story_watermark"))}
            />
            {isFounder ? (
              <ProRow
                label={t("Show founder badge")}
                badge={<span className="font-mono text-[10px] tabular-nums text-text-muted">{founderLabel(founderUnitCode)}</span>}
                checked={founderBadgeOn}
                onChange={setFounderBadgeOn}
              />
            ) : (
              <p className="text-xs text-text-muted">{t("The founder badge is for Founder pass holders.")}</p>
            )}
          </div>
        )}

        {tab === "photo" && (
          <div className="flex h-full flex-col justify-center gap-2">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
              {photoThumbs.length > 0 && (
                <div role="radiogroup" aria-label={t("Photos from this workout")} className="flex shrink-0 gap-2">
                  {photoThumbs.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      role="radio"
                      aria-checked={chosen === i}
                      aria-label={t("Workout photo {n}", { n: i + 1 })}
                      onClick={() => pickWorkoutPhoto(i)}
                      disabled={photoBusy}
                      className={`size-11 shrink-0 overflow-hidden rounded-ctl border-2 disabled:cursor-not-allowed ${
                        chosen === i ? "border-accent" : "border-transparent hover:border-line-hover"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
                      <img src={url} alt="" width={44} height={44} className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <Button
                onClick={() => openPhotoInput(fileInput.current, "camera")}
                disabled={photoBusy}
                className={photoThumbs.length > 0 ? "shrink-0 px-3" : "flex-1"}
              >
                <Camera aria-hidden="true" size={18} />
                {t("Camera")}
              </Button>
              <Button
                onClick={() => openPhotoInput(fileInput.current, "gallery")}
                disabled={photoBusy}
                className={photoThumbs.length > 0 ? "shrink-0 px-3" : "flex-1"}
              >
                <ImagePlus aria-hidden="true" size={18} />
                {photoBusy ? t("Reading…") : t("Gallery")}
              </Button>
              {photo && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPhoto(null);
                    setChosen(null);
                  }}
                  aria-label={t("Remove background photo")}
                  className="shrink-0 px-3"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </Button>
              )}
            </div>
            {photo ? (
              <div className="flex items-center gap-3">
                <label htmlFor="story-overlay" className="shrink-0 text-xs text-text-muted">
                  {t("Overlay opacity")}
                </label>
                <input
                  id="story-overlay"
                  type="range"
                  min={OVERLAY_RANGE.min}
                  max={OVERLAY_RANGE.max}
                  step={OVERLAY_RANGE.step}
                  value={overlay}
                  onChange={(e) => setOverlay(Number(e.target.value))}
                  className="h-11 min-w-0 flex-1 cursor-pointer accent-[#ccff00]"
                />
                <span className="num w-9 shrink-0 text-right text-xs text-text-muted">{Math.round(overlay * 100)}%</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={forcedGray || grayscale}
                  aria-label={forcedGray ? t("Grayscale photo (always on for Monochrome Steel)") : t("Grayscale photo")}
                  disabled={forcedGray}
                  onClick={() => setGrayscale((g) => !g)}
                  className={`h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    forcedGray || grayscale ? "border-accent bg-accent text-black" : "border-line-strong bg-surface-2 text-text"
                  }`}
                >
                  B&amp;W
                </button>
              </div>
            ) : (
              <p className="text-xs text-text-muted">{t("A mirror selfie or the gym floor works best. It stays on this phone.")}</p>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          setTab("photo");
          if (e.target.files?.[0]) setChosen(null);
          void pickPhoto(e.target.files?.[0]);
        }}
      />

      <div role="tablist" aria-label={t("Edit")} className={`mx-4 mt-2 grid shrink-0 gap-1 rounded-ctl bg-surface-2 p-1 ${preset === "clean" ? "grid-cols-4" : "grid-cols-3"}`}>
        {TABS.filter(({ id }) => id !== "text" || preset === "clean").map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-[10px] text-xs font-semibold transition-colors ${
              tab === id ? "bg-surface text-text" : "text-text-muted hover:text-text"
            }`}
          >
            <Icon aria-hidden="true" size={15} />
            {t(label)}
            {id === "photo" && photo && <span aria-label={t("(added)")} className="size-1.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div className="shrink-0 px-4 pt-3">
        {video ? (
          <VideoActions clip={clip} gate={gate} onGate={() => gate && openPaywall(gate)} shareable={videoShareable} ready={drawFrame !== null} />
        ) : (
          <>
            <Button
              variant="primary"
              onClick={() => (presetLocked ? openPaywall("story_studio_pro_presets") : void actions.share())}
              disabled={!actions.ready || !shareable}
              aria-label={t("Share to Instagram / System Share")}
              className="min-h-12 w-full text-base"
            >
              <Share2 aria-hidden="true" size={18} />
              {t("Share to Instagram")}
            </Button>
            {!shareable && <p className="mt-1.5 text-center text-xs text-text-muted">{t("This browser cannot hand images to other apps. Download the PNG instead.")}</p>}
          </>
        )}
      </div>
    </div>
  );
}

type Tab = "layout" | "text" | "photo" | "pro";
const TABS: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: "layout", label: "Layout", icon: LayoutTemplate },
  // Only while Clean is chosen: the other layouts place their own text.
  { id: "text", label: "Text", icon: TextSquare },
  { id: "photo", label: "Photo", icon: ImagePlus },
  { id: "pro", label: "Pro", icon: Gem },
];

/**
 * Clean is always free. Of the other layouts, those after the free ones (two by default; Mission
 * Control sets it) are ABOT Pro. Counting Clean apart keeps Matchday and Thermal Matrix free.
 */
function isProPreset(id: StoryPresetId): boolean {
  if (id === "clean") return false;
  return STORY_PRESETS.filter((p) => p.id !== "clean").findIndex((p) => p.id === id) >= tunables().story.freePresets;
}

type Row = "top" | "middle" | "bottom";
type Col = "left" | "center" | "right";
const ROWS: { id: Row; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "bottom", label: "Bottom" },
];
const COLS: { id: Col; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
];

function splitPosition(p: TextPosition): [Row, Col] {
  const row: Row = p.startsWith("top") ? "top" : p.startsWith("bottom") ? "bottom" : "middle";
  const col: Col = p.endsWith("left") ? "left" : p.endsWith("right") ? "right" : "center";
  return [row, col];
}

function joinPosition(row: Row, col: Col): TextPosition {
  if (row === "middle") return col;
  return (col === "center" ? row : `${row}-${col}`) as TextPosition;
}

/** Three small buttons in one pill; arrow keys move between them, as in any radio group. */
function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
  glyph,
}: {
  label: string;
  options: { id: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  glyph?: (v: V, on: boolean) => React.ReactNode;
}) {
  const t = useT();
  const group = useRef<HTMLDivElement>(null);
  const pick = (v: V, focus = false) => {
    if (v !== value) feedback.tick();
    onChange(v);
    if (focus) group.current?.querySelector<HTMLButtonElement>(`[data-v="${v}"]`)?.focus();
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const i = options.findIndex((o) => o.id === value);
        pick(options[Math.min(options.length - 1, Math.max(0, i + step))]!.id, true);
      }}
      className="flex min-w-0 flex-1 gap-0.5 rounded-ctl bg-surface-2 p-0.5"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            data-v={o.id}
            aria-checked={on}
            aria-label={glyph ? t(o.label) : undefined}
            title={glyph ? t(o.label) : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => pick(o.id)}
            className={`flex h-10 min-w-0 flex-1 items-center justify-center rounded-[10px] px-1 text-xs font-semibold transition-colors ${
              on ? "bg-surface text-text" : "text-text-muted hover:text-text"
            }`}
          >
            {glyph ? glyph(o.id, on) : <span className="truncate">{t(o.label)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A tiny story frame with a bar where the text would sit. */
function SpotGlyph({ row, col, on }: { row?: Row; col?: Col; on: boolean }) {
  const bar = on ? "bg-accent" : "bg-text-muted";
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-4 flex-col rounded-[3px] border p-[2px] ${on ? "border-text" : "border-text-muted/60"} ${
        row === "top" ? "justify-start" : row === "bottom" ? "justify-end" : "justify-center"
      } ${col === "left" ? "items-start" : col === "right" ? "items-end" : "items-center"}`}
    >
      <span className={`block h-[3px] rounded-full ${bar} ${row ? "w-full" : "w-[6px]"}`} />
    </span>
  );
}

function SizeSlider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-xs text-text-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={SIZE_RANGE.min}
        max={SIZE_RANGE.max}
        step={SIZE_RANGE.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 min-w-0 flex-1 cursor-pointer accent-[#ccff00]"
      />
      <span className="num w-9 shrink-0 text-right text-xs text-text-muted">{Math.round(value * 100)}%</span>
    </div>
  );
}

/**
 * Clean's text controls in three slim rows: what sits above the text, where the block goes
 * (row and column, so nine spots in six buttons), and how big the text and the picture are.
 */
function CleanTextControls({
  position,
  onPosition,
  extra,
  onExtra,
  textScale,
  onTextScale,
  extraScale,
  onExtraScale,
}: {
  position: TextPosition;
  onPosition: (p: TextPosition) => void;
  extra: CleanExtra;
  onExtra: (e: CleanExtra) => void;
  textScale: number;
  onTextScale: (v: number) => void;
  extraScale: number;
  onExtraScale: (v: number) => void;
}) {
  const t = useT();
  const [row, col] = splitPosition(position);
  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      <Segmented label={t("Above the text")} options={CLEAN_EXTRAS} value={extra} onChange={onExtra} />
      <div className="flex gap-2">
        <Segmented
          label={t("Vertical position")}
          options={ROWS}
          value={row}
          onChange={(r) => onPosition(joinPosition(r, col))}
          glyph={(r, on) => <SpotGlyph row={r} on={on} />}
        />
        <Segmented
          label={t("Horizontal position")}
          options={COLS}
          value={col}
          onChange={(c) => onPosition(joinPosition(row, c))}
          glyph={(c, on) => <SpotGlyph col={c} on={on} />}
        />
      </div>
      <div className="flex gap-3">
        <SizeSlider id="clean-text-size" label={t("Text")} value={textScale} onChange={onTextScale} />
        {extra !== "none" && (
          <SizeSlider id="clean-extra-size" label={extra === "muscles" ? t("Map") : t("Picture")} value={extraScale} onChange={onExtraScale} />
        )}
      </div>
    </div>
  );
}

/** One switch row in the Pro tab: label, its badge, and the switch. */
function ProRow({ label, badge, checked, onChange }: { label: string; badge: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <span className="truncate">{label}</span>
        {badge}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${checked ? "border-accent bg-accent" : "border-line-strong bg-surface-2"}`}
      >
        <span aria-hidden="true" className={`absolute top-0.5 size-6 rounded-full transition-[left] ${checked ? "left-7 bg-on-accent" : "left-0.5 bg-text"}`} />
      </button>
    </label>
  );
}

