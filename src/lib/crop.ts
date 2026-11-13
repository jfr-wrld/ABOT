/**
 * The maths of the photo crop editor (components/profile/ImageCropSheet): an image shown in a
 * frame, covering it at zoom 1, moved and zoomed by the lifter, never leaving a gap in the frame.
 * Kept pure so it is tested without a browser.
 */

export interface CropView {
  /** Zoom over "just covers the frame", 1 to MAX_ZOOM. */
  zoom: number;
  /** Where the image's top-left corner sits in the frame, in frame pixels (0 or less). */
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export const MAX_ZOOM = 4;

/** Image pixels per frame pixel at zoom 1: the scale at which the image just covers the frame. */
export const coverScale = (img: Size, frame: Size) => Math.max(frame.w / img.w, frame.h / img.h);

/** The image centred in the frame at zoom 1. */
export function initialView(img: Size, frame: Size): CropView {
  const s = coverScale(img, frame);
  return { zoom: 1, x: (frame.w - img.w * s) / 2, y: (frame.h - img.h * s) / 2 };
}

/** The view with zoom in range and the image still covering the whole frame. */
export function clampView(v: CropView, img: Size, frame: Size): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
  const s = coverScale(img, frame) * zoom;
  const minX = frame.w - img.w * s;
  const minY = frame.h - img.h * s;
  return { zoom, x: Math.min(0, Math.max(minX, v.x)), y: Math.min(0, Math.max(minY, v.y)) };
}

/** Zooms to `zoom` keeping the image point under `at` (frame pixels; default the centre) still. */
export function zoomTo(v: CropView, zoom: number, img: Size, frame: Size, at = { x: frame.w / 2, y: frame.h / 2 }): CropView {
  const s0 = coverScale(img, frame) * v.zoom;
  const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
  const s1 = coverScale(img, frame) * next;
  const px = (at.x - v.x) / s0;
  const py = (at.y - v.y) / s0;
  return clampView({ zoom: next, x: at.x - px * s1, y: at.y - py * s1 }, img, frame);
}

/** The part of the image inside the frame, in image pixels: what gets saved. */
export function cropRect(v: CropView, img: Size, frame: Size): { x: number; y: number; w: number; h: number } {
  const s = coverScale(img, frame) * v.zoom;
  return { x: -v.x / s, y: -v.y / s, w: frame.w / s, h: frame.h / s };
}
