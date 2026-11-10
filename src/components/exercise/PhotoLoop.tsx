"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { Exercise } from "@/types/workout";
import { BUNDLED_THUMBS } from "@/data/exercise-thumbs.generated";
import { useT } from "@/i18n";
import { useAppActive } from "@/lib/native/app-active";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";

const FRAME_MS = 900;
const isImage = (u: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u);

/**
 * The exercise's two real photos, start and end position, crossfading like a GIF so the movement
 * reads at a glance. Tap the pause button to hold a frame. Falls back to the photo bundled with
 * the app (offline, one frame), then to the equipment icon, so the box is never empty.
 * The loop teaches the movement, so it plays with Lite effects too; only the phone's own
 * reduce-motion setting starts it paused.
 */
export function PhotoLoop({ exercise, className = "" }: { exercise: Exercise; className?: string }) {
  const reduce = useReducedMotion() === true;
  const t = useT();
  const frames = (exercise.media.motionUrls ?? []).filter(isImage).slice(0, 2);
  const [online, setOnline] = useState(true);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const pair = frames.length === 2 && online && !failed;
  const moving = pair && playing && !reduce;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Frames only swap while ABOT is in the foreground.
  const appActive = useAppActive();
  useEffect(() => {
    if (!moving || !appActive) return;
    const timer = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), FRAME_MS);
    return () => clearInterval(timer);
  }, [moving, appActive]);

  const bundled = BUNDLED_THUMBS.has(exercise.id) ? `/thumbs/${exercise.id}.webp` : null;

  return (
    <div className={`force-dark relative overflow-hidden bg-black ${className}`}>
      {pair ? (
        frames.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- dataset photos, static app without the image optimizer
          <img
            key={src}
            src={src}
            alt={i === 0 ? t("{name}, start position", { name: exercise.name }) : t("{name}, end position", { name: exercise.name })}
            width={640}
            height={480}
            onError={() => setFailed(true)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${
              frame === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ))
      ) : bundled ? (
        // eslint-disable-next-line @next/next/no-img-element -- bundled 128 px photo
        <img src={bundled} alt={t("{name}, start position", { name: exercise.name })} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-ink/40">
          <EquipmentIcon equipment={exercise.equipment} size={56} />
        </div>
      )}

      {pair && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
          <span className="flex items-center gap-2" aria-live="off">
            <span aria-hidden="true" className="flex gap-1">
              {[0, 1].map((i) => (
                <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] ${frame === i ? "w-4 bg-accent" : "w-1.5 bg-ink/40"}`} />
              ))}
            </span>
            <span data-testid="hero-phase" className="label-caps !text-text">
              {frame === 0 ? t("Start") : t("End")}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t("Pause photos") : t("Play photos")}
            className="flex size-11 items-center justify-center rounded-full bg-black/50 text-text backdrop-blur hover:bg-black/70"
          >
            {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

