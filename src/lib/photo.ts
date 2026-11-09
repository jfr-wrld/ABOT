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
