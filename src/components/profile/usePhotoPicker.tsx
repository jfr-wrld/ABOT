"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { squareJpeg } from "@/lib/photo";
import { isNativeApp } from "@/lib/native/files";
import { openPhotoInput } from "@/lib/native/photo-input";
import { useT } from "@/i18n";

/** The hidden file input behind the avatar. The photo is resized on the phone and never uploaded. */
export function usePhotoPicker(
  onChange: (url: string | null) => void,
  opts: { encode?: (file: File) => Promise<string>; title?: string; facing?: "user" | "environment" } = {},
) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function pick(file: File | undefined) {
    if (!file) return;
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
