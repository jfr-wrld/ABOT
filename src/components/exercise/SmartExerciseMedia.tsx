"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ExternalLink, Link2, Pause, Play, Trash2 } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { Button } from "@/components/ui/Button";
import { embedUrl, parseVideoUrl, searchLinks, type ParsedVideo } from "@/lib/videoUrl";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useT } from "@/i18n";
import { useAppActive } from "@/lib/native/app-active";

const TABS = ["Motion", "Video", "Anatomy"] as const;
type Tab = (typeof TABS)[number];

/** Motion, video tutorial and anatomy for one exercise. Players load only when their tab is open. */
export function SmartExerciseMedia({ exercise }: { exercise: Exercise }) {
  const [tab, setTab] = useState<Tab>("Motion");
  const uid = useId().replace(/:/g, "");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const t = useT();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = TABS.indexOf(tab);
    const next =
      e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next]!);
    tabRefs.current[next]?.focus();
  }

  return (
    <section aria-label={t("Exercise media")} className="panel p-2">
      <div role="tablist" aria-label={t("Media type")} className="grid grid-cols-3 gap-1" onKeyDown={onKeyDown}>
        {TABS.map((name, i) => (
          <button
            key={name}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`${uid}-panel`}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            className={`relative h-11 rounded-ctl text-sm font-semibold transition-colors ${
              tab === name
                ? "bg-surface-2 text-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {t(name)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`} className="mt-2">
        {tab === "Motion" && <MotionPanel exercise={exercise} />}
        {tab === "Video" && <VideoPanel exercise={exercise} />}
        {tab === "Anatomy" && (
          <div className="py-2">
            <MuscleMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
          </div>
        )}
      </div>
    </section>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Dataset photos are bright studio shots. Inverting them made walls and skin look wrong, so they
 * keep their real colours, slightly dimmed so they do not glare against the dark UI.
 */
const FRAME_FILTER = "brightness(0.88) contrast(1.06) saturate(0.9)";

/** The exercise's own two photos, start and end, playing as a loop. */
function MotionPanel({ exercise }: { exercise: Exercise }) {
  return <PhotoMotion exercise={exercise} />;
}

function PlayPause({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? t("Pause motion") : t("Play motion")}
      className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
    >
      {playing ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
    </button>
  );
}

function PhotoMotion({ exercise }: { exercise: Exercise }) {
  const urls = exercise.media.motionUrls ?? [];
  const first = urls[0] ? parseVideoUrl(urls[0]) : null;
  const [frame, setFrame] = useState(0);
  // The loop teaches the movement, so it plays with Lite effects too; only the phone's own
  // reduce-motion setting starts it paused.
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [failed, setFailed] = useState(false);
  const isFramePair = urls.length >= 2 && !first;
  const t = useT();

  // Frames only swap while ABOT is in the foreground.
  const appActive = useAppActive();
  useEffect(() => {
    if (!isFramePair || !playing || failed || !appActive) return;
    const timer = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 900);
    return () => clearInterval(timer);
  }, [isFramePair, playing, failed, appActive]);

  if (urls.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-text-muted">{t("No motion images for this exercise.")}</p>;
  }
  if (first?.kind === "file" && first.media === "video") {
    return (
      <video
        src={first.url}
        autoPlay={!prefersReducedMotion()}
        loop
        muted
        playsInline
        controls
        className="aspect-[4/3] w-full rounded-ctl bg-black object-contain"
        aria-label={t("{name} demonstration", { name: exercise.name })}
      />
    );
  }
  if (failed) {
    return (
      <p className="px-2 py-8 text-center text-sm text-text-muted">
        {t("Images need a connection. They load once you are online.")}
      </p>
    );
  }
  const shown = isFramePair ? urls.slice(0, 2) : [urls[0]!];
  return (
    <div>
      <div className="force-dark relative aspect-[4/3] w-full overflow-hidden rounded-ctl bg-black">
        {shown.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- external dataset images, unknown size, static PWA without the image optimizer
          <img
            key={src}
            src={src}
            alt={i === 0 ? t("{name}, start position", { name: exercise.name }) : t("{name}, end position", { name: exercise.name })}
            width={400}
            height={300}
            loading="lazy"
            onError={() => setFailed(true)}
            style={{ filter: FRAME_FILTER }}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 motion-reduce:transition-none ${
              frame === i || !isFramePair ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
      {isFramePair && (
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <span data-testid="motion-phase" aria-live="off" className="text-xs font-semibold text-text-muted">
            {frame === 0 ? t("Start position") : t("End position")}
          </span>
          <PlayPause playing={playing} onToggle={() => setPlaying((p) => !p)} />
        </div>
      )}
    </div>
  );
}

function sourceFor(exercise: Exercise, override: string | undefined): ParsedVideo | null {
  for (const candidate of [
    override,
    exercise.media.customVideoUrl,
    exercise.media.youtubeId ? `https://youtu.be/${exercise.media.youtubeId}` : undefined,
    exercise.media.tiktokUrl,
  ]) {
    const parsed = candidate ? parseVideoUrl(candidate) : null;
    if (parsed) {
      if (parsed.kind === "youtube" && candidate !== override) {
        return { ...parsed, start: parsed.start ?? exercise.media.youtubeStart, end: exercise.media.youtubeEnd };
      }
      return parsed;
    }
  }
  return null;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function VideoPanel({ exercise }: { exercise: Exercise }) {
  const override = useExerciseStore((s) => s.mediaOverrides[exercise.id]?.customVideoUrl);
  const setCustomVideo = useExerciseStore((s) => s.setCustomVideo);
  const online = useOnline();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(override ?? "");
  const [error, setError] = useState<string | null>(null);
  const video = sourceFor(exercise, override);
  const links = searchLinks(exercise.name);
  const inputId = useId();
  const t = useT();

  function save() {
    const parsed = parseVideoUrl(draft);
    if (!parsed) {
      setError(t("Paste a YouTube, YouTube Shorts or TikTok video link, or a direct .mp4, .webm or .gif file."));
      return;
    }
    setCustomVideo(exercise.id, draft.trim());
    setEditing(false);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {!video ? (
        <p className="px-2 pt-4 text-center text-sm text-text-muted">{t("No tutorial video set for this exercise.")}</p>
      ) : !online ? (
        <p className="px-2 py-8 text-center text-sm text-text-muted">{t("Video needs a connection. It plays once you are online.")}</p>
      ) : video.kind === "file" ? (
        video.media === "video" ? (
          <video
            src={video.url}
            autoPlay
            loop
            muted
            playsInline
            controls
            aria-label={t("Video tutorial: {name}", { name: exercise.name })}
            className="aspect-video w-full rounded-ctl bg-black object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied GIF URL
          <img src={video.url} alt={t("Video tutorial: {name}", { name: exercise.name })} width={400} height={300} className="w-full rounded-ctl bg-black object-contain" />
        )
      ) : (
        <div className={`force-dark mx-auto w-full overflow-hidden rounded-ctl bg-black ${video.vertical ? "aspect-[9/16] max-w-[280px]" : "aspect-video"}`}>
          <iframe
            src={embedUrl(video)}
            title={t("Video tutorial: {name}", { name: exercise.name })}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        </div>
      )}

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-2 px-1"
        >
          <label htmlFor={inputId} className="text-sm font-semibold">
            {t("Video link")}
          </label>
          <input
            id={inputId}
            type="url"
            inputMode="url"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder="https://www.youtube.com/shorts/..."
            aria-invalid={error ? true : undefined}
            className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
          />
          {error && (
            <p role="alert" className="text-xs text-failure">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setEditing(false)}>{t("Cancel")}</Button>
            <Button type="submit" variant="primary">
              {t("Save video")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2 px-1">
          <Button
            onClick={() => {
              setDraft(override ?? "");
              setEditing(true);
            }}
            className="flex-1"
          >
            <Link2 aria-hidden="true" size={18} />
            {override ? t("Change video") : t("Set custom video")}
          </Button>
          {override && (
            <Button variant="ghost" onClick={() => setCustomVideo(exercise.id, null)} aria-label={t("Remove custom video")}>
              <Trash2 aria-hidden="true" size={18} />
            </Button>
          )}
        </div>
      )}

      {!video && (
        <div className="grid grid-cols-2 gap-2 px-1 pb-1">
          <a
            href={links.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl border border-line-strong text-sm font-semibold text-text hover:bg-surface-2"
          >
            {t("Search YouTube")}
            <ExternalLink aria-hidden="true" size={16} />
          </a>
          <a
            href={links.tiktok}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl border border-line-strong text-sm font-semibold text-text hover:bg-surface-2"
          >
            {t("Search TikTok")}
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        </div>
      )}
    </div>
  );
}
