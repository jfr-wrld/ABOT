"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useNow } from "@/lib/useNow";
import { streakCardData } from "@/lib/streak-moment";
import { STREAK_THEMES, exportStreakPng, renderStreakCard, streakFileName, type StreakThemeId } from "@/lib/streak-card";
import { useReducedMotionConfig } from "framer-motion";
import { FormatSwitch, VideoActions } from "@/components/share/VideoActions";
import { useStoryVideo } from "@/components/share/useStoryVideo";
import { canShareFiles } from "@/lib/native/files";
import { STORY_SECONDS } from "@/lib/story-motion";
import { STORY_HEIGHT, STORY_WIDTH, downloadStoryPng, loadStoryFonts, shareStoryPng, type StoryFonts } from "@/lib/story-exporter";
import { openSaved, type SaveResult } from "@/lib/native/files";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

const THUMB_W = 108;
/** What the share sheet says with a streak, image or video. */
const STREAK_SHARE = { title: "ABOT Streak", text: "My week streak with ABOT 🔥" };
const THUMB_H = (THUMB_W * STORY_HEIGHT) / STORY_WIDTH;

type Message = { kind: "info" | "error"; text: string; saved?: Extract<SaveResult, { kind: "saved" }> };

/**
 * Share the week streak as a 1080 x 1920 story: the card in the theme picked from twelve (all
 * free), then
 * Share (the system sheet, Instagram included) or Download. Full screen, opened as a modal
 * <dialog> so Escape and Android's back close it.
 */
export function StreakStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
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
      aria-label={t("Share your streak")}
      onClose={onClose}
      className="force-dark m-0 h-dvh max-h-dvh w-full max-w-none bg-bg p-0 text-text backdrop:bg-black/80"
    >
      {open && <Studio onClose={() => ref.current?.close()} />}
    </dialog>
  );
}

function Studio({ onClose }: { onClose: () => void }) {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const handle = useSettingsStore((s) => s.profileHandle);
  const firstDay = useSettingsStore((s) => s.firstDayOfWeek);
  const now = useNow(60_000);
  const data = useMemo(() => streakCardData(sessions, handle || null, now, firstDay), [sessions, handle, now, firstDay]);
  const [theme, setTheme] = useState<StreakThemeId>("volt-flame");
  const [fonts, setFonts] = useState<StoryFonts | null>(null);
  const [png, setPng] = useState<{ theme: StreakThemeId; blob: Blob } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const thumbs = useRef<Partial<Record<StreakThemeId, HTMLCanvasElement | null>>>({});
  const opts = useMemo(() => ({ theme, hideWatermark: false }), [theme]);
  const blob = png?.theme === theme ? png.blob : null;
  // Image or Video; the streak video is free (it is how a streak gets shown off).
  const [format, setFormat] = useState<"image" | "video">("image");
  const reduceMotion = useReducedMotionConfig();
  const videoKey = useMemo(() => ({ data, opts }), [data, opts]);
  const drawFrame = useMemo(
    () => (fonts && data ? (ctx: CanvasRenderingContext2D, time: number) => renderStreakCard(ctx, data, opts, fonts, time) : null),
    [fonts, data, opts],
  );
  const clip = useStoryVideo({
    key: videoKey,
    draw: drawFrame,
    fileName: data ? streakFileName(data, theme).replace(/\.png$/, "") : "abot-streak",
    shareText: STREAK_SHARE,
  });
  const [videoShareable] = useState(() => canShareFiles(new File([new Uint8Array(1)], "abot.mp4", { type: "video/mp4" })));

  // Video preview: the streak moment in a loop, held on its last frame for a beat.
  useEffect(() => {
    if (!fonts || !data || format !== "video" || reduceMotion) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = ((now - start) / 1000) % (STORY_SECONDS + 0.8);
      const ctx = preview.current?.getContext("2d");
      if (ctx) renderStreakCard(ctx, data, opts, fonts, Math.min(t, STORY_SECONDS));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fonts, data, opts, format, reduceMotion]);

  useEffect(() => {
    let alive = true;
    loadStoryFonts()
      .then((f) => alive && setFonts(f))
      .catch(() => alive && setMessage({ kind: "error", text: t("The card fonts could not be loaded. Close this and try again.") }));
    return () => {
      alive = false;
    };
  }, [t]);

  // The preview, then every thumbnail with the same streak, so the choice is made on the real card.
  useEffect(() => {
    if (!fonts || !data) return;
    const raf = requestAnimationFrame(() => {
      const ctx = preview.current?.getContext("2d");
      if (ctx && (format === "image" || reduceMotion)) renderStreakCard(ctx, data, opts, fonts);
      for (const th of STREAK_THEMES) {
        const c = thumbs.current[th.id];
        const tctx = c?.getContext("2d");
        if (!c || !tctx) continue;
        tctx.setTransform(c.width / STORY_WIDTH, 0, 0, c.width / STORY_WIDTH, 0, 0);
        renderStreakCard(tctx, data, { theme: th.id }, fonts);
        tctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [fonts, data, opts, format, reduceMotion]);

  // The PNG is made ahead of the tap: some browsers only open the share sheet inside the tap itself.
  useEffect(() => {
    if (!fonts || !data) return;
    let alive = true;
    const timer = setTimeout(() => {
      exportStreakPng(data, opts, fonts)
        .then((b) => alive && setPng({ theme: opts.theme, blob: b }))
        .catch(() => alive && setMessage({ kind: "error", text: t("The PNG could not be made on this device.") }));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fonts, data, opts, t]);

  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-text-muted">{t("Finish a workout this week to start a streak you can share.")}</p>
        <Button onClick={onClose}>{t("Close")}</Button>
      </div>
    );
  }

  const fileName = streakFileName(data, theme);
  const ready = blob !== null;

  async function share() {
    if (!blob) return;
    try {
      const r = await shareStoryPng(blob, fileName, STREAK_SHARE);
      if (r === "shared") setMessage({ kind: "info", text: t("Sent to the share sheet.") });
      else if (r !== "cancelled") setMessage({ kind: "error", text: t("This browser cannot share images. Download the PNG and post it from your gallery.") });
    } catch {
      setMessage({ kind: "error", text: t("Sharing failed. Download the PNG and post it from your gallery.") });
    }
  }

  async function download() {
    if (!blob) return;
    try {
      const saved = await downloadStoryPng(blob, fileName);
      setMessage(
        saved.kind === "saved"
          ? { kind: "info", text: t("Saved to your gallery, album ABOT."), saved }
          : { kind: "info", text: t("Saved {file} (1080 × 1920).", { file: fileName }) },
      );
    } catch {
      setMessage({ kind: "error", text: t("The PNG could not be saved.") });
    }
  }

  const current = STREAK_THEMES.find((x) => x.id === theme)!;

  return (
    <div className="mx-auto flex h-full w-full max-w-[520px] flex-col pt-[env(safe-area-inset-top)] pb-[calc(12px+env(safe-area-inset-bottom))]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-2">
        <button type="button" onClick={onClose} aria-label={t("Close")} className="flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text">
          <X aria-hidden="true" size={22} />
        </button>
        <div className="min-w-0 text-center">
          <h2 className="text-sm font-semibold">{t("Share your streak")}</h2>
          <p className="truncate text-xs text-text-muted">
            {current.name}
            {handle ? ` · @${handle}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void (format === "video" ? clip.download() : download())}
          disabled={format === "video" ? clip.video.kind !== "ready" : !ready}
          aria-label={format === "video" ? t("Save video") : t("Download High-Res PNG")}
          className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:opacity-40"
        >
          <Download aria-hidden="true" size={20} />
        </button>
      </header>

      <FormatSwitch value={format} onChange={setFormat} />

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-2">
        <canvas
          ref={preview}
          width={STORY_WIDTH}
          height={STORY_HEIGHT}
          role="img"
          aria-label={t("{theme} streak card: {n}-week streak", { theme: current.name, n: data.weeks })}
          className="block h-full max-h-full w-auto max-w-full rounded-card border border-line bg-surface shadow-2xl"
          style={{ aspectRatio: `${STORY_WIDTH} / ${STORY_HEIGHT}` }}
        />
        {!fonts && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            {t("Preparing the card")}
          </p>
        )}
        {format === "video" && (clip.video.kind === "error" || clip.note) && (
          <div className="absolute inset-x-6 bottom-4 rounded-ctl border border-line bg-black/85 px-3 py-2 backdrop-blur">
            <p role={clip.video.kind === "error" || clip.note?.kind === "error" ? "alert" : "status"} className="text-xs">
              {clip.video.kind === "error" ? clip.video.text : clip.note?.text}
            </p>
          </div>
        )}
        {format === "image" && message && (
          <div className="absolute inset-x-6 bottom-4 flex items-center gap-2 rounded-ctl border border-line bg-black/85 px-3 py-2 backdrop-blur">
            <p role={message.kind === "error" ? "alert" : "status"} className={`min-w-0 flex-1 text-xs ${message.kind === "error" ? "text-failure" : "text-text"}`}>
              {message.text}
            </p>
            {message.saved && (
              <Button variant="ghost" onClick={() => void openSaved(message.saved!)} className="min-h-9 shrink-0 px-2 text-xs">
                <ImageIcon aria-hidden="true" size={14} />
                {t("Open")}
              </Button>
            )}
          </div>
        )}
      </div>

      <ul aria-label={t("Themes")} className="flex h-[136px] shrink-0 snap-x gap-2 overflow-x-auto px-4 pt-2 pb-1">
        {STREAK_THEMES.map((th) => {
          const selected = th.id === theme;
          return (
            <li key={th.id} className="relative h-full shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={th.name}
                onClick={() => {
                  if (th.id !== theme) feedback.tick();
                  setTheme(th.id);
                  setMessage(null);
                }}
                className={`h-full rounded-ctl border-2 p-0.5 transition-colors ${selected ? "border-accent" : "border-transparent hover:border-line-hover"}`}
              >
                <canvas
                  ref={(el) => {
                    thumbs.current[th.id] = el;
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

      <div className="shrink-0 px-4 pt-2">
        {format === "video" ? (
          <VideoActions clip={clip} gate={null} onGate={() => {}} shareable={videoShareable} ready={drawFrame !== null} />
        ) : (
          <Button variant="primary" onClick={() => void share()} disabled={!ready} className="w-full">
            <Share2 aria-hidden="true" size={16} />
            {t("Share")}
          </Button>
        )}
      </div>
    </div>
  );
}
