"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { AVATAR_TARGET, squareJpeg, type CropTarget } from "@/lib/photo";
import { ImageCropSheet } from "./ImageCropSheet";
import { isNativeApp } from "@/lib/native/files";
import { openPhotoInput } from "@/lib/native/photo-input";
import { useT } from "@/i18n";

/**
 * The hidden file input behind the avatar. The photo is resized on the phone and never uploaded.
 * With `crop` (the default: the hexagon profile photo), a picked photo first opens the crop
 * sheet, to move and zoom it into place; `crop: null` encodes it at once with `encode`.
 */
export function usePhotoPicker(
  onChange: (url: string | null) => void,
  opts: {
    encode?: (file: File) => Promise<string>;
    title?: string;
    facing?: "user" | "environment";
    crop?: { shape: "hex" | "rect"; target: CropTarget } | null;
  } = {},
) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const crop = opts.crop === undefined ? { shape: "hex" as const, target: AVATAR_TARGET } : opts.crop;
  const [cropping, setCropping] = useState<File | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (crop) {
      setError(null);
      if (!file.type.startsWith("image/")) setError("Pick a photo (JPEG, PNG or WebP).");
      else setCropping(file);
      if (ref.current) ref.current.value = "";
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await (opts.encode ?? squareJpeg)(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("This photo could not be used."));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  // The app's WebView offers no camera in its file picker, so there the avatar asks first.
  const [choosing, setChoosing] = useState(false);
  const choose = (source: "gallery" | "camera") => {
    setChoosing(false);
    openPhotoInput(ref.current, source, opts.facing ?? "user");
  };
  const input = (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        aria-label={opts.title ? t("{title} file", { title: opts.title }) : t("Profile photo file")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {crop && (
        <ImageCropSheet
          file={cropping}
          title={t("Fit your photo")}
          shape={crop.shape}
          target={crop.target}
          onCancel={() => setCropping(null)}
          onDone={(url) => {
            setCropping(null);
            onChange(url);
          }}
        />
      )}
      <Sheet open={choosing} onClose={() => setChoosing(false)} title={opts.title ?? t("Profile photo")}>
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
    </>
  );
  const open = () => (isNativeApp() ? setChoosing(true) : ref.current?.click());
  return { input, open, busy, error };
}
