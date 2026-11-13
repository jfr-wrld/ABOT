"use client";

import { useState } from "react";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { CoverArt } from "./coverPresets";
import { usePhotoPicker } from "./usePhotoPicker";
import { COVER_PRESETS, coverKind } from "@/lib/cover-presets";
import { COVER_TARGET } from "@/lib/photo";
import { useSettingsStore } from "@/store/useSettingsStore";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * The Profile header behind the photo: the lifter's own picture, one of the ten drawn covers,
 * or (by default) the last twelve weeks of volume as a skyline. A button on it opens the picker.
 */
export function ProfileCover({ weeks }: { weeks: number[] }) {
  const t = useT();
  const cover = useSettingsStore((s) => s.profileCover);
  const [open, setOpen] = useState(false);
  const kind = coverKind(cover);
  return (
    // 3:1, the shape a cover image is cropped to, so the crop is what shows.
    <div className="relative aspect-[3/1] overflow-hidden rounded-card border border-line bg-surface">
      <CoverFill value={cover} weeks={weeks} />
      {kind.kind === "skyline" && <span className="label-caps absolute right-14 top-3">{t("12 wk volume")}</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Change cover")}
        aria-haspopup="dialog"
        className="absolute right-2 top-2 flex min-h-11 items-center gap-1.5 rounded-full bg-black/50 px-3.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/65"
      >
        <ImagePlus aria-hidden="true" size={15} />
        {t("Cover")}
      </button>
      <CoverPickerSheet open={open} onClose={() => setOpen(false)} weeks={weeks} />
    </div>
  );
}

/** The current cover, small: for the Edit profile row. */
export function CoverThumb() {
  const cover = useSettingsStore((s) => s.profileCover);
  return <CoverFill value={cover} weeks={[1, 2, 3, 2, 4, 3, 5]} />;
}

/** A cover value drawn into its box: image, preset art, or the volume skyline. */
function CoverFill({ value, weeks }: { value: string | null; weeks: number[] }) {
  const kind = coverKind(value);
  if (kind.kind === "image") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made on the device */}
        <img src={kind.url} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
        {/* A soft fade at the foot, where the avatar sits, so its ring reads on any photo. */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
      </>
    );
  }
  if (kind.kind === "preset") return <CoverArt id={kind.id} className="absolute inset-0" />;
  return <Skyline weeks={weeks} />;
}

/** The default cover: twelve weeks of volume as bars, the current week brightest. */
function Skyline({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 0);
  if (max <= 0) return null;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${weeks.length * 10} 100`} preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-24 w-full">
      {weeks.map((v, i) => {
        const h = Math.max(2, (v / max) * 92);
        return <rect key={i} x={i * 10 + 1.5} y={100 - h} width={7} height={h} rx={1.5} fill="var(--color-accent)" opacity={i === weeks.length - 1 ? 0.55 : 0.16} />;
      })}
    </svg>
  );
}

/** Your own picture, your training, or one of the ten covers; a choice saves at once. */
export function CoverPickerSheet({ open, onClose, weeks }: { open: boolean; onClose: () => void; weeks: number[] }) {
  const t = useT();
  const cover = useSettingsStore((s) => s.profileCover);
  const update = useSettingsStore((s) => s.update);
  const set = (v: string | null) => {
    feedback.tick();
    update({ profileCover: v });
    onClose();
  };
  const upload = usePhotoPicker((url) => set(url), { title: t("Cover image"), facing: "environment", crop: { shape: "rect", target: COVER_TARGET } });
  const options: { value: string | null; label: string }[] = [
    { value: null, label: t("Your training") },
    ...COVER_PRESETS.map((p) => ({ value: `preset:${p.id}`, label: t(p.name) })),
  ];
  const isImage = coverKind(cover).kind === "image";
  // With nothing logged yet, the training option previews sample bars so it shows what it is.
  const preview = weeks.some((v) => v > 0) ? weeks : [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8];
  return (
    <Sheet open={open} onClose={onClose} title={t("Profile cover")}>
      <div className="flex flex-col gap-3">
        {upload.input}
        <div className={`grid gap-2 ${isImage ? "grid-cols-2" : ""}`}>
          <Button variant="primary" disabled={upload.busy} onClick={upload.open}>
            <ImagePlus aria-hidden="true" size={17} />
            {upload.busy ? t("Preparing…") : isImage ? t("Another image") : t("Upload image")}
          </Button>
          {isImage && (
            <Button onClick={() => set(null)}>
              <Trash2 aria-hidden="true" size={17} />
              {t("Remove image")}
            </Button>
          )}
        </div>
        {upload.error && (
          <p role="alert" className="text-xs text-failure">
            {t(upload.error)}
          </p>
        )}
        <ul aria-label={t("Covers")} className="grid grid-cols-2 gap-2">
          {options.map((o) => {
            const on = (cover ?? null) === o.value;
            return (
              <li key={o.value ?? "skyline"}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(o.value)}
                  className={`flex w-full flex-col gap-1 rounded-xl p-1 text-left ${on ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-line-hover"}`}
                >
                  <span className="relative block aspect-[3/1] w-full overflow-hidden rounded-lg bg-surface">
                    <CoverFill value={o.value} weeks={preview} />
                    {on && (
                      <span aria-hidden="true" className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                        <Check size={13} />
                      </span>
                    )}
                  </span>
                  <span className="px-1 pb-0.5 text-xs font-semibold">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
