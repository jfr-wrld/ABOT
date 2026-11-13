"use client";

import { Film, Image as ImageIcon, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProBadge } from "@/components/paywall/ProBadge";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import type { useStoryVideo } from "./useStoryVideo";

/** Image or Video: the same card, still or in motion. `videoPro` marks Video with the PRO badge. */
export function FormatSwitch({ value, onChange, videoPro = false }: { value: "image" | "video"; onChange: (v: "image" | "video") => void; videoPro?: boolean }) {
  const t = useT();
  const options = [
    ["image", t("Image"), ImageIcon],
    ["video", t("Video"), Film],
  ] as const;
  return (
    <div role="radiogroup" aria-label={t("Format")} className="mx-auto grid shrink-0 grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => {
            if (value !== id) feedback.tick();
            onChange(id);
          }}
          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors ${
            value === id ? "bg-surface text-text" : "text-text-muted hover:text-text"
          }`}
        >
          <Icon aria-hidden="true" size={14} />
          {label}
          {id === "video" && videoPro && <ProBadge className="scale-75" />}
        </button>
      ))}
    </div>
  );
}

/**
 * The bottom action in Video: make the clip (a few seconds, with progress and Cancel), then share
 * it. Shared by the workout and streak studios. `gate` opens the paywall instead.
 */
export function VideoActions({
  clip,
  gate,
  onGate,
  shareable,
  ready,
}: {
  clip: ReturnType<typeof useStoryVideo>;
  gate: string | null;
  onGate: () => void;
  shareable: boolean;
  ready: boolean;
}) {
  const t = useT();
  const v = clip.video;
  if (v.kind === "making") {
    const pct = Math.round(v.progress * 100);
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p role="status" className="mb-1.5 text-xs font-semibold">
            {t("Making video… {n}%", { n: pct })}
          </p>
          <div role="progressbar" aria-label={t("Making video")} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Button onClick={clip.cancel} className="shrink-0">
          {t("Cancel")}
        </Button>
      </div>
    );
  }
  if (v.kind === "ready")
    return (
      <>
        <Button variant="primary" onClick={() => void (shareable ? clip.share() : clip.download())} className="min-h-12 w-full text-base">
          <Share2 aria-hidden="true" size={18} />
          {shareable ? t("Share video") : t("Save video")}
        </Button>
        {!shareable && <p className="mt-1.5 text-center text-xs text-text-muted">{t("This browser cannot hand videos to other apps. Save it and post it from your gallery.")}</p>}
      </>
    );
  return (
    <Button variant="primary" onClick={() => (gate ? onGate() : void clip.make())} disabled={!ready} className="min-h-12 w-full text-base">
      <Film aria-hidden="true" size={18} />
      {t("Make video")}
    </Button>
  );
}
