"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Gem, Image as ImageIcon, ImagePlus, LayoutTemplate, Lock, Share2, Trash2, X } from "lucide-react";
import { useEntitlements } from "@/store/useEntitlements";
import { ProBadge } from "@/components/paywall/ProBadge";
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
  storyFileName,
  type StoryFonts,
  type StoryOptions,
  type StoryPhoto,
  type StoryPresetId,
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
export function StoryCardStudio({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: StoryData | null;
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
      {open && data && <Studio data={data} status={status} setStatus={setStatus} shareable={shareable} onClose={() => ref.current?.close()} />}
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
  status,
  setStatus,
  shareable,
  onClose,
}: {
  data: StoryData;
  status: Status;
  setStatus: (s: Status) => void;
  shareable: boolean;
  onClose: () => void;
}) {
  // The PNG remembers which card it was made from; any other card means it is being remade.
  const [made, setMade] = useState<{ from: object | null; blob: Blob | null; fileName: string }>({ from: null, blob: null, fileName: "" });
  const [tab, setTab] = useState<Tab>("layout");
  const [preset, setPreset] = useState<StoryPresetId>("obsidian-raw");
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

  // Layouts 1 and 2 are free; from the third on, and a card without the ABOT mark, are PRO.
  const presetLocked = !proActive && isProPreset(preset);
  const founderBadge = founderBadgeOn && isFounder ? founderUnitCode : null;
  const opts = useMemo<StoryOptions>(
    () => ({ preset, photo, overlay, grayscale, hideWatermark: hideWatermark && proActive, founderBadge }),
    [preset, photo, overlay, grayscale, hideWatermark, proActive, founderBadge],
  );
  const exportKey = useMemo(() => ({ card, opts }), [card, opts]);
  const png: PngState = made.from === exportKey ? { blob: made.blob, fileName: made.fileName, busy: false } : { blob: null, fileName: "", busy: true };
  const actions = usePngActions(png);

  // Preview: redraw on the next frame, so dragging the slider never queues stale frames.
  useEffect(() => {
    if (!fonts) return;
    const raf = requestAnimationFrame(() => {
      const ctx = preview.current?.getContext("2d");
      if (!ctx) return;
      try {
        renderStory(ctx, card, opts, fonts);
      } catch {
        setStatus({ kind: "error", text: t("The card could not be drawn. Close this and try again.") });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [card, opts, fonts, setStatus, t]);

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

  const current = STORY_PRESETS.find((p) => p.id === preset) ?? STORY_PRESETS[0];
  const forcedGray = preset === "monochrome-steel";
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

  const message =
    status.kind !== "idle"
      ? { kind: status.kind, text: status.text }
      : actions.shown
        ? { kind: actions.shown.kind, text: actions.shown.text }
        : null;

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
          onClick={() => (presetLocked ? openPaywall("story_studio_pro_presets") : void actions.download())}
          disabled={!actions.ready}
          aria-label={t("Download High-Res PNG")}
          className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:opacity-40"
        >
          <Download aria-hidden="true" size={20} />
        </button>
      </header>

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
              {t("Unlock with ABOT // BLACK")}
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
            {status.kind === "idle" && actions.shown?.saved && (
              <Button variant="ghost" onClick={() => void actions.openInGallery(actions.shown!.saved!)} className="min-h-9 shrink-0 px-2 text-xs">
                <ImageIcon aria-hidden="true" size={14} />
                {t("Open")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* One panel at a time, fixed height, so nothing below the preview scrolls. */}
      <div className="h-[136px] shrink-0 px-4 pt-2">
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
                badge={<span className="font-mono text-[10px] tabular-nums text-text-muted">{founderUnitCode}</span>}
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
            <div className="flex gap-2">
              <Button onClick={() => openPhotoInput(fileInput.current, "camera")} disabled={photoBusy} className="flex-1">
                <Camera aria-hidden="true" size={18} />
                {t("Camera")}
              </Button>
              <Button onClick={() => openPhotoInput(fileInput.current, "gallery")} disabled={photoBusy} className="flex-1">
                <ImagePlus aria-hidden="true" size={18} />
                {photoBusy ? t("Reading…") : t("Gallery")}
              </Button>
              {photo && (
                <Button variant="ghost" onClick={() => setPhoto(null)} aria-label={t("Remove background photo")} className="px-3">
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
          void pickPhoto(e.target.files?.[0]);
        }}
      />

      <div role="tablist" aria-label={t("Edit")} className="mx-4 mt-2 grid shrink-0 grid-cols-3 gap-1 rounded-ctl bg-surface-2 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
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
      </div>
    </div>
  );
}

type Tab = "layout" | "photo" | "pro";
const TABS: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: "layout", label: "Layout", icon: LayoutTemplate },
  { id: "photo", label: "Photo", icon: ImagePlus },
  { id: "pro", label: "Pro", icon: Gem },
];

/** Layouts after the first two are part of ABOT // BLACK PRO. */
function isProPreset(id: StoryPresetId): boolean {
  return STORY_PRESETS.findIndex((p) => p.id === id) >= 2;
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
