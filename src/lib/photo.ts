import { PROFILE_LIMITS } from "@/types/workout";

/**
 * Turns a picked photo into a small square JPEG data URL, entirely on the device: centre crop,
 * scale to `size`, re-encode. Re-encoding also drops EXIF (location, camera) from the original.
 * Throws a readable Error when the file is not an image the browser can decode.
 */
export async function squareJpeg(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo (JPEG, PNG or WebP).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Try a JPEG or PNG.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize photos.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  // Step quality down until it fits the stored limit (a 256px photo almost always fits at 0.82).
  for (const q of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= PROFILE_LIMITS.photoMax) return url;
  }
  throw new Error("This photo is too detailed to store. Try another one.");
}

/**
 * A picked photo as a wide 3:1 JPEG data URL for the Profile cover: centre crop, `width` x
 * `height`, re-encoded on the device (which drops EXIF), quality stepped down until it fits.
 */
export async function wideJpeg(file: File, width = 960, height = 320): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo (JPEG, PNG or WebP).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Try a JPEG or PNG.");
  }
  const crop = coverCrop(bitmap.width, bitmap.height, width / height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize photos.");
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
  bitmap.close();
  for (const q of [0.8, 0.65, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= PROFILE_LIMITS.coverMax) return url;
  }
  throw new Error("This photo is too detailed to store. Try another one.");
}

/** The centred part of a `w` x `h` image with the given aspect ratio (width / height). */
export function coverCrop(w: number, h: number, ratio: number): { x: number; y: number; w: number; h: number } {
  if (w / h > ratio) {
    const cw = Math.round(h * ratio);
    return { x: Math.round((w - cw) / 2), y: 0, w: cw, h };
  }
  const ch = Math.round(w / ratio);
  return { x: 0, y: Math.round((h - ch) / 2), w, h: ch };
}

/** Largest workout photo kept, in bytes: a 1600px JPEG of a gym scene lands well under it. */
export const WORKOUT_PHOTO_MAX_BYTES = 450_000;

/** Scales `width` x `height` down so the longer edge is at most `maxEdge`; never scales up. */
export function fitSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

/**
 * A workout photo as a JPEG Blob with its shape kept: longest edge `maxEdge`, re-encoded on the
 * device, which drops EXIF (and with it the GPS position). Throws the same readable Errors as
 * squareJpeg.
 */
export async function fitJpeg(file: File, maxEdge = 1600): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo (JPEG, PNG or WebP).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Try a JPEG or PNG.");
  }
  const { width, height } = fitSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize photos.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await toJpeg(canvas, q);
    if (blob && blob.size <= WORKOUT_PHOTO_MAX_BYTES) return { blob, width, height };
  }
  throw new Error("This photo is too detailed to store. Try another one.");
}

/** What a crop is saved as: its size, and the longest data URL kept (see PROFILE_LIMITS). */
export interface CropTarget {
  width: number;
  height: number;
  maxLength: number;
}

/** The profile photo: a 256 px square. */
export const AVATAR_TARGET: CropTarget = { width: 256, height: 256, maxLength: PROFILE_LIMITS.photoMax };
/** The profile cover: 960 x 320. */
export const COVER_TARGET: CropTarget = { width: 960, height: 320, maxLength: PROFILE_LIMITS.coverMax };

/**
 * The chosen part of a photo (`rect`, in the photo's own pixels) as a JPEG data URL of the target
 * size, made on the device (EXIF dropped), quality stepped down until it fits.
 */
export async function cropJpeg(file: Blob, rect: { x: number; y: number; w: number; h: number }, target: CropTarget): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Try a JPEG or PNG.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize photos.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, target.width, target.height);
  bitmap.close();
  for (const q of [0.82, 0.7, 0.55, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= target.maxLength) return url;
  }
  throw new Error("This photo is too detailed to store. Try another one.");
}
