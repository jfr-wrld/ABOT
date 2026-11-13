"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { HEX } from "./ProfileAvatar";
import { clampView, cropRect, initialView, MAX_ZOOM, zoomTo, type CropView, type Size } from "@/lib/crop";
import { cropJpeg, type CropTarget } from "@/lib/photo";
import { useT } from "@/i18n";

/**
 * Fit a picked photo before it is saved: drag to move it, pinch (or the slider) to zoom, inside a
 * frame shaped like where it will show: the hexagon of the profile photo, or the 3:1 cover. The
 * image always fills the frame. Saving crops on the device to the target size.
 */
export function ImageCropSheet({
  file,
  title,
  shape,
  target,
  onDone,
  onCancel,
}: {
  /** The picked photo; null keeps the sheet closed. */
  file: Blob | null;
  title: string;
  shape: "hex" | "rect";
  target: CropTarget;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Size | null>(null);
  const [img, setImg] = useState<{ url: string; size: Size } | null>(null);
  const [view, setView] = useState<CropView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const aspect = target.width / target.height;

  // The picked file as an image, with its natural size.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const el = new Image();
    let live = true;
    el.onload = () => {
      if (live) setImg({ url, size: { w: el.naturalWidth, h: el.naturalHeight } });
    };
    el.onerror = () => {
      if (live) setError("This photo could not be read. Try a JPEG or PNG.");
    };
    el.src = url;
    return () => {
      live = false;
      URL.revokeObjectURL(url);
      setImg(null);
      setView(null);
      setError(null);
    };
  }, [file]);

  // The frame's size on screen, kept current if the sheet resizes.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !file) return;
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientWidth / aspect });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [file, aspect, img]);

  // Centred and just covering once both sizes are known; kept in bounds when the frame changes.
  const v = img && frame ? (view ? clampView(view, img.size, frame) : initialView(img.size, frame)) : null;

  const move = (e: React.PointerEvent) => {
    if (!img || !frame || !v || !pointers.current.has(e.pointerId)) return;
    const prev = [...pointers.current.values()];
    const was = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = [...pointers.current.values()];
    if (now.length >= 2 && prev.length >= 2) {
      // Two fingers: zoom by how far apart they moved, around their midpoint.
      const dist = (p: { x: number; y: number }[]) => Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y);
      const box = frameRef.current!.getBoundingClientRect();
      const mid = { x: (now[0]!.x + now[1]!.x) / 2 - box.left, y: (now[0]!.y + now[1]!.y) / 2 - box.top };
      setView(zoomTo(v, v.zoom * (dist(now) / Math.max(1, dist(prev))), img.size, frame, mid));
      return;
    }
    setView(clampView({ ...v, x: v.x + e.clientX - was.x, y: v.y + e.clientY - was.y }, img.size, frame));
  };

  async function save() {
    if (!file || !img || !frame || !v) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await cropJpeg(file, cropRect(v, img.size, frame), target));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This photo could not be used.");
    } finally {
      setBusy(false);
    }
  }

  const scale = img && frame && v ? Math.max(frame.w / img.size.w, frame.h / img.size.h) * v.zoom : 0;

  return (
    <Sheet
      open={file !== null}
      onClose={onCancel}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onCancel}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={save} disabled={busy || !v}>
            {busy ? t("Preparing…") : t("Use photo")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-muted">{t("Drag to move the photo. Pinch or use the slider to zoom.")}</p>
        <div
          ref={frameRef}
          role="img"
          aria-label={t("Photo crop preview")}
          className="force-dark relative w-full touch-none select-none overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: String(aspect), maxWidth: shape === "hex" ? 320 : undefined, marginInline: "auto" }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }}
          onPointerMove={move}
          onPointerUp={(e) => pointers.current.delete(e.pointerId)}
          onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        >
          {img && v && (
            // eslint-disable-next-line @next/next/no-img-element -- the picked file, shown as it is moved
            <img
              src={img.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
              style={{ width: img.size.w * scale, height: img.size.h * scale, transform: `translate(${v.x}px, ${v.y}px)` }}
            />
          )}
          {/* What will show: the hexagon of the profile photo, or the whole cover with thirds. */}
          {shape === "hex" ? (
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
              <path d={`M0 0 H100 V100 H0 Z ${HEX}`} fill="rgb(0 0 0 / 0.6)" fillRule="evenodd" />
              <path d={HEX} fill="none" stroke="var(--color-accent)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="border border-white/15" />
              ))}
            </span>
          )}
        </div>
        <label className="flex items-center gap-3">
          <ZoomOut aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
          <span className="sr-only">{t("Zoom")}</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={v?.zoom ?? 1}
            disabled={!v}
            onChange={(e) => img && frame && v && setView(zoomTo(v, Number(e.target.value), img.size, frame))}
            className="min-h-11 w-full accent-[var(--color-accent)]"
          />
          <ZoomIn aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
        </label>
        {error && (
          <p role="alert" className="text-xs text-failure">
            {t(error)}
          </p>
        )}
      </div>
    </Sheet>
  );
}
